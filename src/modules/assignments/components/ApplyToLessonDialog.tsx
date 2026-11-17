import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactElement } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useApplyToLesson } from "@api/generated/assignments/assignments";
import {
  AssignmentRole,
  type LessonAssignmentResponseDto,
  type OpenLessonResponseDto,
} from "@api/generated/model";
import { Alert, Button, Dialog, RadioGroup, TextArea, toast, type RadioOption } from "@shared/ui";

import { toApplySubmitError, type ApplyErrorKind } from "../lib/application-errors";
import { invalidateAfterApplied } from "../lib/assignment-queries";
import {
  APPLY_ROLE_ORDER,
  lessonLabel,
  ROLE_INLINE_KEYS,
  ROLE_LABEL_KEYS,
} from "../lib/assignment-labels";
import { formatCoverage } from "../lib/coverage";
import { formatLessonDay, formatLessonDayMonth, META_SEPARATOR } from "../lib/format";
import {
  APPLY_NOTE_MAX,
  applyToLessonFormSchema,
  emptyApplyToLessonFormInput,
  toApplyToLessonBody,
  type ApplyToLessonFormInput,
  type ApplyToLessonFormValues,
} from "../schemas/apply-to-lesson.schema";

export interface ApplyToLessonDialogProps {
  /** The lesson with a vacancy as the list showed it: its summary, its coverage and the roles still open. */
  openLesson: OpenLessonResponseDto;
  onClose: () => void;
  onApplied?: (application: LessonAssignmentResponseDto) => void;
}

const ROLE_DESCRIPTION_KEYS = {
  [AssignmentRole.monitor]: "apply.monitorDescription",
  [AssignmentRole.teacher]: "apply.teacherDescription",
} as const satisfies Record<AssignmentRole, string>;

/** The refusals that say the lesson will not take this application: the person can only leave. */
const BLOCKING_ERRORS: ReadonlySet<ApplyErrorKind> = new Set(["alreadyApplied", "lessonClosed"]);

/**
 * The refusals after which what the lists behind the dialog show is out of date, so they are read
 * again: somebody else was faster (the role was filled, the member already holds a place, the
 * lesson closed), or the lesson is gone, and its row has to leave the table of the lessons with a
 * vacancy.
 */
const STALE_LISTS_ERRORS: ReadonlySet<ApplyErrorKind> = new Set([
  "roleFull",
  "alreadyApplied",
  "lessonClosed",
  "lessonNotFound",
]);

function toRole(value: string): AssignmentRole | null {
  return APPLY_ROLE_ORDER.find((role) => role === value) ?? null;
}

/**
 * "Candidatar-se à aula" (F5.5, RF-046): a member asks for a place in a lesson that has a vacancy.
 * It shows the lesson and its vacancies, the role (required) and an optional note for whoever will
 * approve, and the warning that the board or the coordination decides and that nobody is teacher
 * and monitor in the same lesson. Enviar candidatura sends `POST /lessons/:id/applications`.
 *
 * - **The role.** Monitor(a) comes first, as in the Figma. A role with no vacancy is turned off and
 *   says so in its description (`openRoles` of the lesson, or a role the API refused as full while
 *   the dialog was open), so the reason is not only the color. The role starts chosen only when one
 *   is open (a single option has nothing to compare); with two, the person chooses. Sending with
 *   no role is refused on the field, with the focus there, and nothing is sent.
 * - **Success.** The toast says the role and the day and month ("… como monitor(a) em 31/03."), as
 *   the Figma does. The cache is told (the lesson leaves "com vaga" and enters "Minhas próximas
 *   aulas" as "Aguardando confirmação"), and the dialog closes.
 * - **The refusals of the API.** A `VALIDATION_FAILED` that points at a field goes there. 409
 *   `ROLE_FULL` turns that role off, clears the choice and refreshes the lists. 409 `ALREADY_APPLIED`
 *   and `LESSON_IN_PAST`/`LESSON_CANCELLED` show as a warning, turn Enviar candidatura off and refresh
 *   the lists, since what is on the screen behind is out of date. 404 `LESSON_NOT_FOUND` shows as an
 *   alert and refreshes them too, so the row of a lesson that is gone leaves the table behind. The
 *   others show as an alert. Any of them takes the focus.
 * - **While it is on its way** the dialog cannot be closed (X, Esc and Voltar are off) and a
 *   second press is ignored.
 *
 * Mount it only while it is open, so each opening starts clean.
 */
export function ApplyToLessonDialog({
  openLesson,
  onClose,
  onApplied,
}: ApplyToLessonDialogProps): ReactElement {
  const { t, i18n } = useTranslation("assignments");
  const queryClient = useQueryClient();
  const formId = useId();
  const errorId = useId();
  const errorRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const [submitError, setSubmitError] = useState<ApplyErrorKind | null>(null);
  const [fullRoles, setFullRoles] = useState<ReadonlySet<AssignmentRole>>(() => new Set());
  const { lesson, coverage, openRoles } = openLesson;

  const hasVacancy = (role: AssignmentRole) => openRoles.includes(role) && !fullRoles.has(role);
  const availableRoles = APPLY_ROLE_ORDER.filter(hasVacancy);

  const { control, handleSubmit, setError, setFocus, setValue } = useForm<
    ApplyToLessonFormInput,
    unknown,
    ApplyToLessonFormValues
  >({
    resolver: zodResolver(applyToLessonFormSchema),
    defaultValues: {
      ...emptyApplyToLessonFormInput(),
      // A single place to choose from has nothing to compare with: it comes chosen (F6).
      ...(availableRoles.length === 1 ? { role: availableRoles[0] } : {}),
    },
  });

  const applyToLesson = useApplyToLesson({
    // The cache is told even if the dialog is gone by the time the answer arrives.
    mutation: { onSuccess: () => void invalidateAfterApplied(queryClient, lesson.id) },
  });
  const isPending = applyToLesson.isPending;
  const isBlocked = submitError !== null && BLOCKING_ERRORS.has(submitError);
  const canSubmit = !isBlocked && availableRoles.length > 0;

  useEffect(() => {
    if (submitError !== null) errorRef.current?.focus();
  }, [submitError]);

  function handleError(error: unknown, role: AssignmentRole) {
    const result = toApplySubmitError(error);

    if (result.kind === "fields") {
      for (const { name, message } of result.fields) setError(name, { type: "server", message });
      setFocus(result.fields[0].name);
      return;
    }

    if (result.kind === "roleFull") {
      setFullRoles((current) => new Set(current).add(role));
      setValue("role", null);
    }
    if (STALE_LISTS_ERRORS.has(result.kind)) void invalidateAfterApplied(queryClient, lesson.id);
    setSubmitError(result.kind);
  }

  function apply(values: ApplyToLessonFormValues) {
    if (isPending || inFlightRef.current || !canSubmit) return;
    inFlightRef.current = true;
    setSubmitError(null);

    applyToLesson.mutate(
      { id: lesson.id, data: toApplyToLessonBody(values) },
      {
        onSuccess: (application) => {
          toast.success(t("apply.toastTitle"), {
            description: t("apply.toastDescription", {
              role: t(ROLE_INLINE_KEYS[values.role]),
              day: formatLessonDayMonth(lesson.date, i18n.language),
            }),
          });
          onApplied?.(application);
          onClose();
        },
        onError: (error) => handleError(error, values.role),
        onSettled: () => {
          inFlightRef.current = false;
        },
      },
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    void handleSubmit(apply)(event);
  }

  const roleOptions: RadioOption[] = APPLY_ROLE_ORDER.map((role) => {
    const description = t(ROLE_DESCRIPTION_KEYS[role]);

    return {
      value: role,
      label: t(ROLE_LABEL_KEYS[role]),
      description: hasVacancy(role)
        ? description
        : t("apply.descriptionWithoutVacancy", { description, reason: t("apply.noVacancy") }),
      isDisabled: !hasVacancy(role),
    };
  });

  const meta = [
    lesson.class.name,
    formatLessonDay(lesson.date, i18n.language),
    t("timeRange", { start: lesson.startTime, end: lesson.endTime }),
    lesson.location,
  ]
    .filter((part): part is string => part !== null && part !== "")
    .join(META_SEPARATOR);

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("apply.title")}
      closeLabel={t("close")}
      isDismissable={!isPending}
      footer={
        <>
          <Button variant="secondary" isDisabled={isPending} onPress={onClose}>
            {t("apply.back")}
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={formId}
            isLoading={isPending}
            isDisabled={!canSubmit && !isPending}
            aria-describedby={!canSubmit && submitError !== null ? errorId : undefined}
          >
            {isPending ? t("apply.submitting") : t("apply.submit")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        aria-busy={isPending}
        onSubmit={onSubmit}
        className="flex flex-col gap-4"
      >
        {/* The dialog body is `text-muted`, which is 4,2:1 on this background: the text takes the foreground color. */}
        <div className="flex flex-col gap-1 rounded-xl bg-surface-secondary p-3 text-foreground">
          <p className="text-base font-semibold">{lessonLabel(lesson, t)}</p>
          <p className="text-sm text-pretty">{meta}</p>
          <p className="text-sm">
            {t("coverage.vacancies", { coverage: formatCoverage(coverage, t) })}
          </p>
        </div>

        <Controller
          name="role"
          control={control}
          render={({ field, fieldState }) => (
            <RadioGroup
              label={t("apply.role")}
              orientation="horizontal"
              options={roleOptions}
              value={field.value}
              onChange={(value) => field.onChange(toRole(value))}
              name={field.name}
              inputRef={field.ref}
              isRequired
              errorMessage={
                fieldState.error?.message
                  ? t(`apply.fieldErrors.${fieldState.error.message}`)
                  : undefined
              }
            />
          )}
        />

        <Controller
          name="note"
          control={control}
          render={({ field, fieldState }) => (
            <TextArea
              label={t("apply.note")}
              description={t("apply.noteHint")}
              placeholder={t("apply.notePlaceholder")}
              rows={3}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              errorMessage={
                fieldState.error?.message
                  ? t(`apply.fieldErrors.${fieldState.error.message}`, { max: APPLY_NOTE_MAX })
                  : undefined
              }
            />
          )}
        />

        <Alert variant="info">{t("apply.info")}</Alert>

        {submitError !== null ? (
          <div id={errorId} ref={errorRef} tabIndex={-1} className="outline-none">
            <Alert variant={isBlocked ? "warning" : "error"}>
              {t(`apply.errors.${submitError}`)}
            </Alert>
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}
