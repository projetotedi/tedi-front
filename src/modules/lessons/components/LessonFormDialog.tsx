import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type RefObject,
} from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import {
  getListCourseLessonPlansQueryKey,
  useListCourseLessonPlans,
} from "@api/generated/catalog/catalog";
import { useCreateLesson, useGetLesson, useUpdateLesson } from "@api/generated/lessons/lessons";
import { LessonStatus, type LessonResponseDto } from "@api/generated/model";
import { formatCalendarDate } from "@shared/lib/format";
import { Alert, Button, Dialog, Select, TextArea, TextField, toast } from "@shared/ui";

import {
  CREATE_LESSON_FIELDS,
  EDIT_LESSON_FIELDS,
  toLessonSubmitError,
  type LessonAlertErrorKind,
} from "../lib/lesson-errors";
import { fetchLessonPlanPrefill } from "../lib/lesson-plan-prefill";
import { applySavedLesson, invalidateLesson } from "../lib/lesson-queries";
import { EDITABLE_LESSON_STATUSES, LESSON_STATUS_LABEL_KEYS } from "../lib/lesson-status";
import {
  emptyLessonFormValues,
  LESSON_LIMITS,
  lessonFormSchema,
  NO_LESSON_PLAN,
  toCreateLessonBody,
  toLessonFormValues,
  toUpdateLessonBody,
  type LessonFormValues,
} from "../schemas/lesson.schema";
import { LessonLoadError, LessonLoadingPlaceholder } from "./LessonDialogStates";

/**
 * The class a new lesson is for. There is no list of classes in the contract to choose from, so
 * the new-lesson dialog only opens with the class already decided (from the screen of the class),
 * and the "Turma" field shows it without letting it change.
 */
export interface LessonClassContext {
  id: string;
  /** What the read-only "Turma" field shows: the name of the class, or its code when it has none. */
  label: string;
  /** The course of the class: its sequence of lesson plans is what the origin select offers. */
  courseId: string;
  /** The first day of the class (`YYYY-MM-DD`): the earliest day a lesson of it can have. */
  startDate: string;
  /** The last day of the class (`YYYY-MM-DD`): the latest day a lesson of it can have. */
  endDate: string;
}

interface DialogCallbacks {
  onClose: () => void;
  onSaved?: (lesson: LessonResponseDto) => void;
}

export type LessonFormDialogProps =
  | (DialogCallbacks & { mode: "create"; lessonClass: LessonClassContext })
  | (DialogCallbacks & { mode: "edit"; lessonId: string });

type LessonFormTarget =
  | { mode: "create"; lessonClass: LessonClassContext }
  | { mode: "edit"; lesson: LessonResponseDto };

const noop = () => {};

/** A select has no ref to its field, so the focus goes to the button that opens it. */
function focusSelect(wrapper: RefObject<HTMLDivElement | null>): void {
  wrapper.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
}

interface LessonFormProps {
  formId: string;
  target: LessonFormTarget;
  onPendingChange: (isPending: boolean) => void;
  onLockedChange: (isLocked: boolean) => void;
  onSaved: (lesson: LessonResponseDto) => void;
}

function LessonForm({
  formId,
  target,
  onPendingChange,
  onLockedChange,
  onSaved,
}: LessonFormProps): ReactElement {
  const { t, i18n } = useTranslation("lessons");
  const queryClient = useQueryClient();
  const errorRef = useRef<HTMLDivElement>(null);
  const planFieldRef = useRef<HTMLDivElement>(null);
  const statusFieldRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const selectedPlanRef = useRef(NO_LESSON_PLAN);
  const [submitError, setSubmitError] = useState<LessonAlertErrorKind | null>(null);
  const [isObjectiveUnavailable, setIsObjectiveUnavailable] = useState(false);
  // Read once, when the form opens: a lesson that was already cancelled has nothing to edit. One
  // that gets cancelled while the form is open keeps the form (and what was typed), and the API
  // refuses the save with 409, which the form shows as a warning.
  const [wasCancelledAtOpen] = useState(
    () => target.mode === "edit" && target.lesson.status === LessonStatus.cancelled,
  );

  const isEdit = target.mode === "edit";
  const classRef = target.mode === "create" ? target.lessonClass : target.lesson.class;
  const classLabel =
    target.mode === "create"
      ? target.lessonClass.label
      : target.lesson.class.name || target.lesson.class.code;
  const courseId = target.mode === "create" ? target.lessonClass.courseId : "";
  const period = {
    start: formatCalendarDate(classRef.startDate, i18n.language),
    end: formatCalendarDate(classRef.endDate, i18n.language),
  };

  const { control, handleSubmit, setError, setFocus, setValue, getValues } =
    useForm<LessonFormValues>({
      resolver: zodResolver(lessonFormSchema),
      defaultValues:
        target.mode === "edit" ? toLessonFormValues(target.lesson) : emptyLessonFormValues(),
    });

  // The options of the origin select: the sequence of the course of the class, without the plans
  // that were archived after they entered it (an archived plan cannot originate a lesson, RN-27).
  const sequenceQuery = useListCourseLessonPlans(courseId, { query: { enabled: !isEdit } });
  const planItems = useMemo(
    () => (sequenceQuery.data?.items ?? []).filter((item) => item.archivedAt === null),
    [sequenceQuery.data],
  );
  const planOptions = useMemo(
    () => [
      { id: NO_LESSON_PLAN, label: t("form.noLessonPlan") },
      ...planItems.map((item) => ({ id: item.lessonPlanId, label: item.title })),
    ],
    [planItems, t],
  );
  const createLesson = useCreateLesson({
    mutation: { onSuccess: (lesson) => void applySavedLesson(queryClient, lesson) },
  });
  const updateLesson = useUpdateLesson({
    mutation: { onSuccess: (lesson) => void applySavedLesson(queryClient, lesson) },
  });
  const isPending = createLesson.isPending || updateLesson.isPending;

  useEffect(() => {
    if (wasCancelledAtOpen) onLockedChange(true);
  }, [wasCancelledAtOpen, onLockedChange]);

  useEffect(() => {
    if (submitError !== null) errorRef.current?.focus();
  }, [submitError]);

  function errorText(message: string | undefined, extra: object = {}): string | undefined {
    return message
      ? t(`fieldErrors.${message}`, { ...LESSON_LIMITS, ...period, ...extra })
      : undefined;
  }

  function focusField(name: (typeof CREATE_LESSON_FIELDS | typeof EDIT_LESSON_FIELDS)[number]) {
    if (name === "lessonPlanId") focusSelect(planFieldRef);
    else if (name === "status") focusSelect(statusFieldRef);
    else setFocus(name);
  }

  function handleError(error: unknown) {
    const result = toLessonSubmitError(error, isEdit ? EDIT_LESSON_FIELDS : CREATE_LESSON_FIELDS);

    if (result.kind === "fields") {
      for (const { name, message } of result.fields) setError(name, { type: "server", message });
      // The plan the person chose may have been archived or moved since the options were loaded.
      if (result.fields.some(({ name }) => name === "lessonPlanId")) {
        void queryClient.invalidateQueries({
          queryKey: getListCourseLessonPlansQueryKey(courseId),
        });
      }
      focusField(result.fields[0].name);
      return;
    }

    if (target.mode === "edit" && ["lessonCancelled", "lessonNotFound"].includes(result.kind)) {
      void invalidateLesson(queryClient, target.lesson.id);
    }
    if (result.kind === "lessonCancelled") onLockedChange(true);
    setSubmitError(result.kind);
  }

  /**
   * Choosing a plan fills the title and the objective with the ones of the plan (RN-18): the title
   * at once, from the item of the sequence, and then both from the plan itself, since the item has
   * no objective. The answer of a plan that the person has since replaced by another is ignored, and
   * so is whatever the person typed after choosing: the answer never overwrites that. If the plan
   * cannot be read the title stays and the objective says so. "Sem plano" leaves the fields as they
   * are.
   */
  async function applyPlan(lessonPlanId: string) {
    selectedPlanRef.current = lessonPlanId;
    setIsObjectiveUnavailable(false);

    const item = planItems.find((candidate) => candidate.lessonPlanId === lessonPlanId);
    if (item === undefined) return;

    const objectiveWhenChosen = getValues("objective");
    setValue("title", item.title, { shouldValidate: true });

    try {
      const prefill = await fetchLessonPlanPrefill(queryClient, lessonPlanId);
      if (selectedPlanRef.current !== lessonPlanId) return;

      if (getValues("title") === item.title) {
        setValue("title", prefill.title, { shouldValidate: true });
      }
      if (getValues("objective") === objectiveWhenChosen) {
        setValue("objective", prefill.objective, { shouldValidate: true });
      }
    } catch {
      if (selectedPlanRef.current === lessonPlanId) setIsObjectiveUnavailable(true);
    }
  }

  function save(values: LessonFormValues) {
    if (isPending || inFlightRef.current) return;

    // The position goes with the plan, from the sequence as it is now: the API checks that the plan
    // is at exactly that position. A plan that is no longer an option cannot be sent.
    let sequenceOrder: number | null = null;
    if (target.mode === "create" && values.lessonPlanId !== NO_LESSON_PLAN) {
      const item = planItems.find((candidate) => candidate.lessonPlanId === values.lessonPlanId);
      if (item === undefined) {
        setError("lessonPlanId", { type: "server", message: "lessonPlanUnavailable" });
        focusField("lessonPlanId");
        return;
      }
      sequenceOrder = item.position;
    }

    inFlightRef.current = true;
    setSubmitError(null);
    onPendingChange(true);

    const callbacks = {
      onSuccess: (lesson: LessonResponseDto) => {
        toast.success(t(target.mode === "create" ? "toast.created" : "toast.updated"));
        onSaved(lesson);
      },
      onError: handleError,
      onSettled: () => {
        inFlightRef.current = false;
        onPendingChange(false);
      },
    };

    if (target.mode === "create") {
      createLesson.mutate(
        { data: toCreateLessonBody(values, { classId: target.lessonClass.id, sequenceOrder }) },
        callbacks,
      );
    } else {
      updateLesson.mutate({ id: target.lesson.id, data: toUpdateLessonBody(values) }, callbacks);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    void handleSubmit(save)(event);
  }

  if (wasCancelledAtOpen) return <Alert variant="warning">{t("errors.lessonCancelled")}</Alert>;

  return (
    <form
      id={formId}
      noValidate
      aria-busy={isPending}
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2"
    >
      <TextField label={t("form.class")} value={classLabel} onChange={noop} isRequired isReadOnly />

      {target.mode === "create" ? (
        <Controller
          name="lessonPlanId"
          control={control}
          render={({ field, fieldState }) => (
            <div ref={planFieldRef} className="flex flex-col gap-2">
              <Select
                label={t("form.lessonPlan")}
                options={planOptions}
                value={field.value}
                onChange={(lessonPlanId) => {
                  field.onChange(lessonPlanId);
                  void applyPlan(lessonPlanId);
                }}
                onBlur={field.onBlur}
                name={field.name}
                isDisabled={sequenceQuery.isPending}
                description={sequenceQuery.isPending ? t("form.lessonPlansLoading") : undefined}
                errorMessage={errorText(fieldState.error?.message)}
              />
              {/* The failure comes after the field is on the screen, so it goes in a status region
                  that stays mounted (see the hint of the objective). */}
              <Alert variant="info">
                {sequenceQuery.isError ? t("form.lessonPlansError") : null}
              </Alert>
            </div>
          )}
        />
      ) : (
        <TextField
          label={t("form.lessonPlan")}
          value={target.lesson.lessonPlan?.title ?? t("form.noLessonPlan")}
          onChange={noop}
          description={t("form.originLockedHint")}
          isReadOnly
        />
      )}

      <div className="sm:col-span-2">
        <Controller
          name="title"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              label={t("form.title")}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              isRequired
              autoFocus
              errorMessage={errorText(fieldState.error?.message)}
            />
          )}
        />
      </div>

      <div className="flex flex-col gap-2 sm:col-span-2">
        <Controller
          name="objective"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              label={t("form.objective")}
              value={field.value}
              onChange={(value) => {
                setIsObjectiveUnavailable(false);
                field.onChange(value);
              }}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              errorMessage={errorText(fieldState.error?.message)}
            />
          )}
        />
        {/* A status region that stays mounted: a hint that appears after the plan answers is announced,
            and a `description` of the field that is born later does not reach `aria-describedby`. */}
        <Alert variant="info">
          {isObjectiveUnavailable ? t("form.objectiveUnavailable") : null}
        </Alert>
      </div>

      {target.mode === "create" ? (
        <Controller
          name="date"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              label={t("form.date")}
              type="date"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              description={t("form.periodHint", period)}
              isRequired
              errorMessage={errorText(fieldState.error?.message)}
            />
          )}
        />
      ) : (
        <TextField
          label={t("form.date")}
          type="date"
          value={target.lesson.date}
          onChange={noop}
          description={t("form.scheduleLockedHint")}
          isRequired
          isReadOnly
        />
      )}

      <Controller
        name="location"
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            label={t("form.location")}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
            inputRef={field.ref}
            errorMessage={errorText(fieldState.error?.message)}
          />
        )}
      />

      {target.mode === "create" ? (
        <>
          <Controller
            name="startTime"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                label={t("form.startTime")}
                type="time"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                inputRef={field.ref}
                isRequired
                errorMessage={errorText(fieldState.error?.message)}
              />
            )}
          />
          <Controller
            name="endTime"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                label={t("form.endTime")}
                type="time"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                inputRef={field.ref}
                isRequired
                errorMessage={errorText(fieldState.error?.message)}
              />
            )}
          />
        </>
      ) : (
        <>
          <TextField
            label={t("form.startTime")}
            type="time"
            value={target.lesson.startTime}
            onChange={noop}
            description={t("form.scheduleLockedHint")}
            isRequired
            isReadOnly
          />
          <TextField
            label={t("form.endTime")}
            type="time"
            value={target.lesson.endTime}
            onChange={noop}
            description={t("form.scheduleLockedHint")}
            isRequired
            isReadOnly
          />
        </>
      )}

      <Controller
        name="expectedStudents"
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            label={t("form.expectedStudents")}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
            inputRef={field.ref}
            inputMode="numeric"
            errorMessage={errorText(fieldState.error?.message, { max: LESSON_LIMITS.studentsMax })}
          />
        )}
      />

      <Controller
        name="expectedMonitors"
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            label={t("form.expectedMonitors")}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
            inputRef={field.ref}
            inputMode="numeric"
            errorMessage={errorText(fieldState.error?.message, {
              max: LESSON_LIMITS.monitorsMax,
            })}
          />
        )}
      />

      <div className="sm:col-span-2">
        <Controller
          name="subject"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              label={t("form.subject")}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              errorMessage={errorText(fieldState.error?.message)}
            />
          )}
        />
      </div>

      {isEdit ? (
        <>
          <Controller
            name="status"
            control={control}
            render={({ field, fieldState }) => (
              <div ref={statusFieldRef}>
                <Select
                  label={t("form.status")}
                  options={EDITABLE_LESSON_STATUSES.map((status) => ({
                    id: status,
                    label: t(LESSON_STATUS_LABEL_KEYS[status]),
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  errorMessage={errorText(fieldState.error?.message)}
                />
              </div>
            )}
          />
          <div className="hidden sm:block" aria-hidden="true" />

          <div className="sm:col-span-2">
            <Controller
              name="postNotes"
              control={control}
              render={({ field, fieldState }) => (
                <TextArea
                  label={t("form.postNotes")}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  inputRef={field.ref}
                  rows={4}
                  errorMessage={errorText(fieldState.error?.message)}
                />
              )}
            />
          </div>
        </>
      ) : null}

      {submitError !== null ? (
        <div ref={errorRef} tabIndex={-1} className="outline-none sm:col-span-2">
          <Alert variant={submitError === "lessonCancelled" ? "warning" : "error"}>
            {t(`errors.${submitError}`)}
          </Alert>
        </div>
      ) : null}
    </form>
  );
}

/**
 * "Nova aula" and "Editar aula" (F3.2, F3.3): the same form, empty for a new lesson and filled for
 * an existing one, in the order of the Figma.
 *
 * **New lesson** opens with the class decided (`lessonClass`, read-only: there is no list of classes
 * to choose from) and offers as origin the sequence of its course, without the archived plans, plus
 * "Sem plano (aula avulsa)". Choosing a plan fills the title and the objective, which stay editable,
 * and the lesson is created with the position of the plan in the sequence. The date is checked by the
 * API (inside the period of the class, 400 `LESSON_OUTSIDE_CLASS_PERIOD`) and the hint under it says
 * which period it is. The status and the post-lesson notes are not asked: the lesson is born planned
 * and its notes are written after it.
 *
 * **Edit** loads the lesson (`getLesson`). The class, the origin, the date and the times show as
 * read-only fields, with the way to change the date and the times (Remarcar aula): the PATCH only
 * carries what can change here, and the status can be set to planned, confirmed or done (cancelling
 * is its own dialog). A lesson that is already cancelled shows only the warning, with Salvar aula off.
 *
 * Field errors of the API go to the field, with the focus there; a lesson that was cancelled in the
 * meantime shows as a warning, takes the focus and turns Salvar aula off; the other errors show as an
 * alert that takes the focus, and the next try clears it. While the request is on its way the dialog
 * cannot be closed (X, Esc and Cancelar are off) and a second press is ignored.
 */
export function LessonFormDialog(props: LessonFormDialogProps): ReactElement {
  const { onClose, onSaved } = props;
  const { t } = useTranslation("lessons");
  const formId = useId();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const lessonId = props.mode === "edit" ? props.lessonId : "";
  const lessonQuery = useGetLesson(lessonId, { query: { enabled: props.mode === "edit" } });
  const lesson = lessonQuery.data;
  const isReady = props.mode === "create" || lesson !== undefined;

  function handleSaved(saved: LessonResponseDto) {
    onSaved?.(saved);
    onClose();
  }

  function renderBody(): ReactElement {
    if (props.mode === "create") {
      return (
        <LessonForm
          key={props.lessonClass.id}
          formId={formId}
          target={{ mode: "create", lessonClass: props.lessonClass }}
          onPendingChange={setIsSubmitting}
          onLockedChange={setIsLocked}
          onSaved={handleSaved}
        />
      );
    }

    if (lessonQuery.isPending) return <LessonLoadingPlaceholder label={t("form.loading")} />;

    if (lesson === undefined) {
      return (
        <LessonLoadError
          error={lessonQuery.error}
          isRetrying={lessonQuery.isFetching}
          onRetry={() => void lessonQuery.refetch()}
        />
      );
    }

    return (
      <LessonForm
        key={lesson.id}
        formId={formId}
        target={{ mode: "edit", lesson }}
        onPendingChange={setIsSubmitting}
        onLockedChange={setIsLocked}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={props.mode === "create" ? t("form.newTitle") : t("form.editTitle")}
      closeLabel={t("close")}
      size="wide"
      isDismissable={!isSubmitting}
      footer={
        <>
          <Button variant="secondary" isDisabled={isSubmitting} onPress={onClose}>
            {t("form.cancel")}
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={formId}
            isLoading={isSubmitting}
            isDisabled={!isReady || isLocked}
          >
            {isSubmitting ? t("form.saving") : t("form.save")}
          </Button>
        </>
      }
    >
      {renderBody()}
    </Dialog>
  );
}
