import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type RefObject,
} from "react";
import { Controller, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useCreateAssignment } from "@api/generated/assignments/assignments";
import {
  AssignmentRole,
  AssignmentSource,
  type LessonAssignmentResponseDto,
} from "@api/generated/model";
import { Alert, Button, Dialog, Select, TextField, toast } from "@shared/ui";

import {
  useAssignableClassOptions,
  useAssignableMemberOptions,
  useClassLessonOptions,
  type OptionsState,
} from "../hooks/useNewAssignmentOptions";
import {
  ASSIGNABLE_STATUSES,
  ASSIGNMENT_ROLE_LABEL_KEYS,
  assignmentStatusLabelKey,
} from "../lib/assignment-labels";
import {
  toCreateAssignmentError,
  type AssignmentFieldName,
  type AssignmentIssue,
} from "../lib/assignment-errors";
import { formatDayMonth } from "../lib/format";
import {
  invalidateAfterAssignmentChange,
  invalidateAfterLessonRefused,
} from "../lib/assignment-queries";
import {
  emptyNewAssignmentValues,
  newAssignmentFormSchema,
  toCreateAssignmentBody,
  type NewAssignmentFormInput,
  type NewAssignmentFormValues,
} from "../schemas/new-assignment.schema";

/** The member the form was opened for (from her sheet): it is fixed, and the field shows her name. */
export interface AssignmentMemberContext {
  id: string;
  name: string;
}

/** The class the form was opened for (from the screen of the class): fixed, labelled with its name or code. */
export interface AssignmentClassContext {
  id: string;
  /** What the read-only "Turma" field shows: the name of the class, or its code when it has none. */
  label: string;
}

/** The lesson the form was opened for (from the screen of the lesson): it fixes the class and the lesson. */
export interface AssignmentLessonContext {
  id: string;
  title: string;
  /** The day of the lesson (`YYYY-MM-DD`), which the read-only "Aula" field shows with the title. */
  date: string;
  lessonClass: AssignmentClassContext;
}

/**
 * What the screen that opens the form has already decided about the lesson: a whole lesson (then the
 * class is the one of the lesson), only the class (the lesson is to be chosen among the ones of that
 * class), or nothing (the list of members, where the class and the lesson are to be chosen). A lesson
 * and a class at the same time make no sense, since the lesson has its own class.
 */
export type LessonScope =
  | { lesson: AssignmentLessonContext; lessonClass?: never }
  | { lesson?: never; lessonClass?: AssignmentClassContext };

/** What the screen has decided, in the form the button and the dialog share. The member is independent of the lesson. */
export type AssignmentScope = LessonScope & { member?: AssignmentMemberContext };

export type NewAssignmentDialogProps = AssignmentScope & {
  onClose: () => void;
  onSaved?: (assignment: LessonAssignmentResponseDto) => void;
};

const noop = () => {};

/** The fields of the form, in the order they are on the screen: the one that takes the focus when it is invalid. */
const FIELD_ORDER = ["personId", "classId", "lessonId", "role", "status"] as const;

const ROLES = Object.values(AssignmentRole);

function toRole(value: string): AssignmentRole | "" {
  return ROLES.find((role) => role === value) ?? "";
}

function toStatus(value: string): NewAssignmentFormInput["status"] {
  return ASSIGNABLE_STATUSES.find((status) => status === value) ?? ASSIGNABLE_STATUSES[0];
}

/** A select has no ref to its field, so the focus goes to the button that opens it. */
function focusSelect(wrapper: RefObject<HTMLDivElement | null>): void {
  wrapper.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
}

/** The lists the form asks the API for: each has its own failure and its own "Tentar de novo". */
type OptionsList = "members" | "classes" | "lessons";

interface ListRetryProps {
  /** The list could not be loaded. */
  isFailed: boolean;
  /** The list is being asked again: the button stays, with a spinner, until the answer. */
  isRetrying: boolean;
  /** The message of the failure, which tells what the button retries (there can be more than one on the screen). */
  describedBy: string;
  onRetry: () => void;
}

/**
 * "Tentar de novo" of a list that could not be loaded, below the status region that says it. It is
 * a `secondary` button of the usual 44px, named by the `retry` text and described by the message, so
 * two lists that failed at once are not two buttons with the same name.
 */
function ListRetry({
  isFailed,
  isRetrying,
  describedBy,
  onRetry,
}: ListRetryProps): ReactElement | null {
  const { t } = useTranslation("assignments");

  if (!isFailed && !isRetrying) return null;

  return (
    <Button
      variant="secondary"
      className="self-start"
      isLoading={isRetrying}
      aria-describedby={describedBy}
      onPress={onRetry}
    >
      {t("retry")}
    </Button>
  );
}

/**
 * "Nova alocação de membro" (F5.2, RF-047): the member, the class and the lesson of the class, the
 * role in the lesson (teacher or monitor) and the status of the assignment, in the order of the
 * Figma, with "Cancelar" and "Salvar alocação".
 *
 * The screen that opens it can already have decided some of it. **The member** (from her sheet): the
 * field shows her name and cannot change, and the list of members is not even asked (F3). **The
 * class** (from the screen of a class) or **the lesson** (from the screen of a lesson): the fields
 * show them and cannot change. What is not decided is chosen: the members are the ones that can be
 * assigned, the classes come from the lessons from today on (F2) and the lessons are the ones of the
 * chosen class, without the cancelled ones; changing the class clears the lesson. The role starts
 * empty and the status starts as confirmed, which the person sees (F5).
 *
 * The request is `POST /lessons/:id/assignments`, with the member, the role and the status (no note,
 * F6). On success the cache is told (`invalidateAfterAssignmentChange`, so the coverage of the lesson
 * and the lists change with no reload), the toast says so, `onSaved` gets the assignment and the
 * dialog closes.
 *
 * Refusals: the rules of the system (409 `DUPLICATE_ROLE_IN_LESSON`, `LESSON_TEACHER_TAKEN`,
 * `LESSON_CANCELLED` and `MEMBER_INACTIVE`) are a warning, which takes the focus, keeps the dialog
 * open and goes away when a field changes, so the person decides what to do about it. An error that
 * points at a field goes to the field, with the focus there; the others are an alert that takes the
 * focus. While the request is on its way the dialog cannot be closed (X, Esc and Cancelar are off)
 * and a second press is ignored.
 *
 * A list of options that could not be loaded (the members, the classes or the lessons of the class) says
 * so in its status region, with a "Tentar de novo" that asks it again, and the focus goes to the select
 * when it loads. The message does not ask for anything the person cannot do: the class, for instance,
 * is fixed when the dialog comes from its screen.
 *
 * It is mounted only while it is open, so each opening starts clean.
 */
export function NewAssignmentDialog({
  member,
  lesson,
  lessonClass,
  onClose,
  onSaved,
}: NewAssignmentDialogProps): ReactElement {
  const { t, i18n } = useTranslation("assignments");
  const queryClient = useQueryClient();
  const formId = useId();
  const issueRef = useRef<HTMLDivElement>(null);
  const memberFieldRef = useRef<HTMLDivElement>(null);
  const classFieldRef = useRef<HTMLDivElement>(null);
  const lessonFieldRef = useRef<HTMLDivElement>(null);
  const roleFieldRef = useRef<HTMLDivElement>(null);
  const statusFieldRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const listMessageId = useId();
  const [issue, setIssue] = useState<AssignmentIssue | null>(null);
  // The lists that "Tentar de novo" is asking again: the button stays on the screen until the answer.
  const [retrying, setRetrying] = useState<OptionsList[]>([]);

  // A lesson has its own class, so it is the one that fixes it.
  const fixedClass = lesson?.lessonClass ?? lessonClass;
  const fieldRefs = {
    personId: memberFieldRef,
    classId: classFieldRef,
    lessonId: lessonFieldRef,
    role: roleFieldRef,
    status: statusFieldRef,
  } satisfies Record<(typeof FIELD_ORDER)[number], RefObject<HTMLDivElement | null>>;
  // The fields an error of the API can point at, in screen order: the member and the lesson only
  // when the form lets them be chosen.
  const apiFields: AssignmentFieldName[] = [
    ...(member === undefined ? (["personId"] as const) : []),
    ...(lesson === undefined ? (["lessonId"] as const) : []),
    "role",
    "status",
  ];

  const { control, handleSubmit, setError, setValue } = useForm<
    NewAssignmentFormInput,
    unknown,
    NewAssignmentFormValues
  >({
    resolver: zodResolver(newAssignmentFormSchema),
    defaultValues: emptyNewAssignmentValues({
      memberId: member?.id,
      classId: fixedClass?.id,
      lessonId: lesson?.id,
    }),
  });
  const [classId, lessonId] = useWatch({ control, name: ["classId", "lessonId"] });

  const members = useAssignableMemberOptions({ enabled: member === undefined });
  const classes = useAssignableClassOptions({ enabled: fixedClass === undefined });
  const lessons = useClassLessonOptions(classId, { enabled: lesson === undefined });

  const createAssignment = useCreateAssignment({
    mutation: {
      // The cache is told even if the dialog is gone by the time the answer arrives.
      onSuccess: (_assignment, { id, data }) =>
        void invalidateAfterAssignmentChange(queryClient, {
          lessonId: id,
          personId: data.personId,
        }),
    },
  });
  const isPending = createAssignment.isPending;

  useEffect(() => {
    if (issue !== null) issueRef.current?.focus();
  }, [issue]);

  // A lesson that leaves the options (the API said it is cancelled, or it is gone) leaves the field
  // too: the select could not show it, and the form would still send it.
  const { isPending: lessonsPending, isError: lessonsError, options: lessonOptions } = lessons;
  useEffect(() => {
    if (lesson !== undefined || lessonId === "" || lessonsPending || lessonsError) return;
    if (!lessonOptions.some((option) => option.id === lessonId)) setValue("lessonId", "");
  }, [lesson, lessonId, lessonsPending, lessonsError, lessonOptions, setValue]);

  // The first field the person can change takes the focus when the dialog opens.
  const firstEditable =
    member === undefined
      ? "personId"
      : fixedClass === undefined
        ? "classId"
        : lesson === undefined
          ? "lessonId"
          : "role";

  function fieldError(message: string | undefined): string | undefined {
    if (!message) return undefined;
    // A message the form does not know (a rule of the generated schema) is the generic one.
    const isKnown =
      message === "required" || message === "memberNotFound" || message === "serverInvalid";
    return t(`fieldErrors.${isKnown ? message : "serverInvalid"}`);
  }

  /** What the status region under a select says: the list could not be loaded, or there is nothing in it. */
  function optionsMessage(
    state: OptionsState,
    name: "members" | "classes" | "lessons",
  ): string | null {
    if (state.isError) return t(`newAssignment.${name}Error`);
    if (!state.isPending && state.options.length === 0) return t(`newAssignment.${name}Empty`);
    return null;
  }

  /**
   * "Tentar de novo" of a list that failed: asks it again. The query leaves the error to be pending
   * while it runs, so the button is kept for as long as `retrying` says (a button that goes away takes
   * the focus with it). When the list loads, the button goes and the focus it had goes to the select
   * that now has options, unless the person moved it meanwhile; when it fails again the button is
   * still there, with the focus.
   */
  async function retryList(
    name: OptionsList,
    state: OptionsState,
    wrapper: RefObject<HTMLDivElement | null>,
  ) {
    if (retrying.includes(name)) return;
    setRetrying((current) => [...current, name]);

    const { isError } = await state.refetch();

    const active = document.activeElement;
    const hadFocus = active === document.body || wrapper.current?.contains(active) === true;
    if (!isError && hadFocus) focusSelect(wrapper);
    setRetrying((current) => current.filter((item) => item !== name));
  }

  function focusFirstInvalid(errors: FieldErrors<NewAssignmentFormInput>) {
    const name = FIELD_ORDER.find((field) => errors[field] !== undefined);
    if (name !== undefined) focusSelect(fieldRefs[name]);
  }

  function handleError(error: unknown, sentLessonId: string) {
    const result = toCreateAssignmentError(error, apiFields);

    if (result.kind === "fields") {
      for (const { name, message } of result.fields) setError(name, { type: "server", message });
      focusSelect(fieldRefs[result.fields[0].name]);
      return;
    }

    // The lesson that was refused leaves the options: it is cancelled, or it is gone.
    const isLessonRefused =
      (result.kind === "warning" && result.warning === "lessonCancelled") ||
      (result.kind === "alert" && result.alert === "lessonNotFound");
    if (isLessonRefused) void invalidateAfterLessonRefused(queryClient, sentLessonId);

    setIssue(result);
  }

  function save(values: NewAssignmentFormValues) {
    if (isPending || inFlightRef.current) return;
    inFlightRef.current = true;
    setIssue(null);

    createAssignment.mutate(
      { id: values.lessonId, data: toCreateAssignmentBody(values) },
      {
        onSuccess: (assignment) => {
          toast.success(t("toast.created"));
          onSaved?.(assignment);
          onClose();
        },
        onError: (error) => handleError(error, values.lessonId),
        onSettled: () => {
          inFlightRef.current = false;
        },
      },
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    void handleSubmit(save, focusFirstInvalid)(event);
  }

  const roleOptions = ROLES.map((role) => ({
    id: role,
    label: t(ASSIGNMENT_ROLE_LABEL_KEYS[role]),
  }));
  const statusOptions = ASSIGNABLE_STATUSES.map((status) => ({
    id: status,
    label: t(assignmentStatusLabelKey(status, AssignmentSource.direct)),
  }));

  // What the lesson field says while there is nothing to choose from yet.
  const lessonHint =
    classId === ""
      ? t("newAssignment.chooseClassFirst")
      : lessons.isPending
        ? t("newAssignment.lessonsLoading")
        : undefined;
  const lessonsMessage = classId === "" ? null : optionsMessage(lessons, "lessons");

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("newAssignment.title")}
      closeLabel={t("close")}
      isDismissable={!isPending}
      footer={
        <>
          <Button variant="secondary" isDisabled={isPending} onPress={onClose}>
            {t("newAssignment.cancel")}
          </Button>
          <Button variant="primary" type="submit" form={formId} isLoading={isPending}>
            {isPending ? t("newAssignment.submitting") : t("newAssignment.submit")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        aria-busy={isPending}
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2"
      >
        {member === undefined ? (
          <Controller
            name="personId"
            control={control}
            render={({ field, fieldState }) => (
              <div ref={memberFieldRef} className="flex flex-col gap-2">
                <Select
                  label={t("newAssignment.member")}
                  placeholder={t("newAssignment.placeholders.member")}
                  options={members.options}
                  value={field.value === "" ? null : field.value}
                  onChange={(value) => {
                    setIssue(null);
                    field.onChange(value);
                  }}
                  onBlur={field.onBlur}
                  name={field.name}
                  description={members.isPending ? t("newAssignment.membersLoading") : undefined}
                  errorMessage={fieldError(fieldState.error?.message)}
                  isRequired
                  autoFocus={firstEditable === "personId"}
                />
                {/* The failure comes after the field is on the screen, so it goes in a status region
                    that stays mounted: one that is born filled is not announced. */}
                <Alert variant="info" id={`${listMessageId}-members`}>
                  {optionsMessage(members, "members")}
                </Alert>
                <ListRetry
                  isFailed={members.isError}
                  isRetrying={retrying.includes("members")}
                  describedBy={`${listMessageId}-members`}
                  onRetry={() => void retryList("members", members, memberFieldRef)}
                />
              </div>
            )}
          />
        ) : (
          <TextField
            label={t("newAssignment.member")}
            value={member.name}
            onChange={noop}
            isRequired
            isReadOnly
          />
        )}
        <div className="hidden sm:block" aria-hidden="true" />

        {fixedClass === undefined ? (
          <Controller
            name="classId"
            control={control}
            render={({ field, fieldState }) => (
              <div ref={classFieldRef} className="flex flex-col gap-2">
                <Select
                  label={t("newAssignment.class")}
                  placeholder={t("newAssignment.placeholders.class")}
                  options={classes.options}
                  value={field.value === "" ? null : field.value}
                  onChange={(value) => {
                    setIssue(null);
                    field.onChange(value);
                    // The lessons are the ones of the class: the one that was chosen is not of this one.
                    setValue("lessonId", "");
                  }}
                  onBlur={field.onBlur}
                  name={field.name}
                  description={classes.isPending ? t("newAssignment.classesLoading") : undefined}
                  errorMessage={fieldError(fieldState.error?.message)}
                  isRequired
                  autoFocus={firstEditable === "classId"}
                />
                <Alert variant="info" id={`${listMessageId}-classes`}>
                  {optionsMessage(classes, "classes")}
                </Alert>
                <ListRetry
                  isFailed={classes.isError}
                  isRetrying={retrying.includes("classes")}
                  describedBy={`${listMessageId}-classes`}
                  onRetry={() => void retryList("classes", classes, classFieldRef)}
                />
              </div>
            )}
          />
        ) : (
          <TextField
            label={t("newAssignment.class")}
            value={fixedClass.label}
            onChange={noop}
            isRequired
            isReadOnly
          />
        )}

        {lesson === undefined ? (
          <Controller
            name="lessonId"
            control={control}
            render={({ field, fieldState }) => (
              <div ref={lessonFieldRef} className="flex flex-col gap-2">
                <Select
                  label={t("newAssignment.lesson")}
                  placeholder={t("newAssignment.placeholders.lesson")}
                  options={lessons.options}
                  value={field.value === "" ? null : field.value}
                  onChange={(value) => {
                    setIssue(null);
                    field.onChange(value);
                  }}
                  onBlur={field.onBlur}
                  name={field.name}
                  description={lessonHint}
                  errorMessage={fieldError(fieldState.error?.message)}
                  isDisabled={classId === ""}
                  isRequired
                  autoFocus={firstEditable === "lessonId"}
                />
                <Alert variant="info" id={`${listMessageId}-lessons`}>
                  {lessonsMessage}
                </Alert>
                <ListRetry
                  isFailed={lessons.isError}
                  isRetrying={retrying.includes("lessons")}
                  describedBy={`${listMessageId}-lessons`}
                  onRetry={() => void retryList("lessons", lessons, lessonFieldRef)}
                />
              </div>
            )}
          />
        ) : (
          <TextField
            label={t("newAssignment.lesson")}
            value={`${formatDayMonth(lesson.date, i18n.language)} · ${lesson.title}`}
            onChange={noop}
            isRequired
            isReadOnly
          />
        )}

        <Controller
          name="role"
          control={control}
          render={({ field, fieldState }) => (
            <div ref={roleFieldRef}>
              <Select
                label={t("newAssignment.role")}
                placeholder={t("newAssignment.placeholders.role")}
                options={roleOptions}
                value={field.value === "" ? null : field.value}
                onChange={(value) => {
                  setIssue(null);
                  field.onChange(toRole(value));
                }}
                onBlur={field.onBlur}
                name={field.name}
                errorMessage={fieldError(fieldState.error?.message)}
                isRequired
                autoFocus={firstEditable === "role"}
              />
            </div>
          )}
        />

        <Controller
          name="status"
          control={control}
          render={({ field, fieldState }) => (
            <div ref={statusFieldRef}>
              <Select
                label={t("newAssignment.status")}
                options={statusOptions}
                value={field.value}
                onChange={(value) => {
                  setIssue(null);
                  field.onChange(toStatus(value));
                }}
                onBlur={field.onBlur}
                name={field.name}
                errorMessage={fieldError(fieldState.error?.message)}
              />
            </div>
          )}
        />

        {issue !== null ? (
          <div ref={issueRef} tabIndex={-1} className="outline-none sm:col-span-2">
            {issue.kind === "warning" ? (
              <Alert variant="warning">{t(`warnings.${issue.warning}`)}</Alert>
            ) : (
              <Alert variant="error">{t(`errors.${issue.alert}`)}</Alert>
            )}
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}
