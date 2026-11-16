import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactElement } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useGetLesson, useRescheduleLesson } from "@api/generated/lessons/lessons";
import { LessonStatus, type LessonResponseDto } from "@api/generated/model";
import { formatCalendarDate } from "@shared/lib/format";
import { Alert, Button, Dialog, TextArea, TextField, toast } from "@shared/ui";

import {
  RESCHEDULE_LESSON_FIELDS,
  toLessonSubmitError,
  type LessonAlertErrorKind,
} from "../lib/lesson-errors";
import { applySavedLesson, invalidateLesson } from "../lib/lesson-queries";
import {
  LESSON_LIMITS,
  rescheduleLessonFormSchema,
  toRescheduleFormValues,
  toRescheduleLessonBody,
  type RescheduleLessonFormValues,
} from "../schemas/lesson.schema";
import { LessonLoadError, LessonLoadingPlaceholder } from "./LessonDialogStates";
import { RequiredLabel } from "./RequiredLabel";

export interface RescheduleLessonDialogProps {
  lessonId: string;
  onClose: () => void;
  onRescheduled?: (lesson: LessonResponseDto) => void;
}

interface RescheduleFormProps {
  formId: string;
  lesson: LessonResponseDto;
  onPendingChange: (isPending: boolean) => void;
  onLockedChange: (isLocked: boolean) => void;
  onRescheduled: (lesson: LessonResponseDto) => void;
}

function RescheduleForm({
  formId,
  lesson,
  onPendingChange,
  onLockedChange,
  onRescheduled,
}: RescheduleFormProps): ReactElement {
  const { t, i18n } = useTranslation("lessons");
  const queryClient = useQueryClient();
  const errorRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const [submitError, setSubmitError] = useState<LessonAlertErrorKind | null>(null);
  // Read once, when the form opens: a lesson that was already cancelled cannot be rescheduled. One
  // that gets cancelled while the form is open keeps the form, and the API refuses the save with 409.
  const [wasCancelledAtOpen] = useState(() => lesson.status === LessonStatus.cancelled);

  const period = {
    start: formatCalendarDate(lesson.class.startDate, i18n.language),
    end: formatCalendarDate(lesson.class.endDate, i18n.language),
  };

  const { control, handleSubmit, setError, setFocus } = useForm<RescheduleLessonFormValues>({
    resolver: zodResolver(rescheduleLessonFormSchema),
    defaultValues: toRescheduleFormValues(lesson),
  });

  const rescheduleLesson = useRescheduleLesson({
    mutation: { onSuccess: (saved) => void applySavedLesson(queryClient, saved) },
  });
  const isPending = rescheduleLesson.isPending;

  useEffect(() => {
    if (wasCancelledAtOpen) onLockedChange(true);
  }, [wasCancelledAtOpen, onLockedChange]);

  useEffect(() => {
    if (submitError !== null) errorRef.current?.focus();
  }, [submitError]);

  function errorText(message: string | undefined): string | undefined {
    return message
      ? t(`fieldErrors.${message}`, {
          ...LESSON_LIMITS,
          ...period,
          reasonMax: LESSON_LIMITS.rescheduleReasonMax,
        })
      : undefined;
  }

  function handleError(error: unknown) {
    const result = toLessonSubmitError(error, RESCHEDULE_LESSON_FIELDS);

    if (result.kind === "fields") {
      for (const { name, message } of result.fields) setError(name, { type: "server", message });
      setFocus(result.fields[0].name);
      return;
    }

    if (result.kind === "lessonCancelled" || result.kind === "lessonNotFound") {
      void invalidateLesson(queryClient, lesson.id);
    }
    if (result.kind === "lessonCancelled") onLockedChange(true);
    setSubmitError(result.kind);
  }

  function reschedule(values: RescheduleLessonFormValues) {
    if (isPending || inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmitError(null);
    onPendingChange(true);

    rescheduleLesson.mutate(
      { id: lesson.id, data: toRescheduleLessonBody(values) },
      {
        onSuccess: (saved) => {
          // The first day the lesson had is kept by the API in `originalDate`. Should an answer ever
          // come without it, the day the lesson had on the screen is the original one.
          const originalDate = saved.originalDate ?? lesson.date;
          toast.success(
            t("toast.rescheduled", {
              originalDate: formatCalendarDate(originalDate, i18n.language),
            }),
          );
          onRescheduled(saved);
        },
        onError: handleError,
        onSettled: () => {
          inFlightRef.current = false;
          onPendingChange(false);
        },
      },
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    void handleSubmit(reschedule)(event);
  }

  if (wasCancelledAtOpen) return <Alert variant="warning">{t("errors.lessonCancelled")}</Alert>;

  return (
    <form
      id={formId}
      noValidate
      aria-busy={isPending}
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-6"
    >
      <div className="sm:col-span-2">
        <Controller
          name="date"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              label={<RequiredLabel>{t("reschedule.date")}</RequiredLabel>}
              type="date"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              description={t("form.periodHint", period)}
              isRequired
              autoFocus
              errorMessage={errorText(fieldState.error?.message)}
            />
          )}
        />
      </div>

      <div className="sm:col-span-2">
        <Controller
          name="startTime"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              label={<RequiredLabel>{t("reschedule.startTime")}</RequiredLabel>}
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
      </div>

      <div className="sm:col-span-2">
        <Controller
          name="endTime"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              label={<RequiredLabel>{t("reschedule.endTime")}</RequiredLabel>}
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
      </div>

      <div className="sm:col-span-3">
        <Controller
          name="location"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              label={t("reschedule.location")}
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

      <div className="sm:col-span-3">
        <Controller
          name="reason"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              label={t("reschedule.reason")}
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

      <div className="sm:col-span-6">
        <Controller
          name="note"
          control={control}
          render={({ field, fieldState }) => (
            <TextArea
              label={t("reschedule.note")}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              rows={3}
              errorMessage={errorText(fieldState.error?.message)}
            />
          )}
        />
      </div>

      <div className="sm:col-span-6">
        <Alert
          variant="info"
          description={
            lesson.originalDate === null
              ? t("reschedule.infoCurrentDate", {
                  date: formatCalendarDate(lesson.date, i18n.language),
                })
              : t("reschedule.infoOriginalDate", {
                  date: formatCalendarDate(lesson.originalDate, i18n.language),
                })
          }
        >
          {t("reschedule.infoTitle")}
        </Alert>
      </div>

      {submitError !== null ? (
        <div ref={errorRef} tabIndex={-1} className="outline-none sm:col-span-6">
          <Alert variant={submitError === "lessonCancelled" ? "warning" : "error"}>
            {t(`errors.${submitError}`)}
          </Alert>
        </div>
      ) : null}
    </form>
  );
}

/**
 * "Remarcar aula" (F3.3): moves a lesson to another day and time. It loads the lesson (`getLesson`)
 * to open with the times and the place it has now and the new date empty, since the new date has to
 * be chosen. The new date, the start and the end are required (the contract asks for the end too);
 * the place is kept unless it is cleared, and the reason and the note are optional (the reason is
 * free text, as the contract has it, and not the list of the Figma). The info under the fields
 * says the original date stays on record: the one the lesson has now, or the first one if it was
 * rescheduled before.
 *
 * Remarcar aula sends `PATCH /lessons/:id/reschedule`; on success the answer, with `originalDate`,
 * becomes the detail of the lesson in the cache, and the toast says which day was the original one.
 * A date outside the period of the class (400) goes to the date field, with the period in the
 * message and the focus there; an end that is not after the start (400), to the end field; a lesson
 * that was cancelled in the meantime shows as a warning and turns Remarcar aula off; the other errors
 * show as an alert that takes the focus. While the request is on its way the dialog cannot be closed
 * and a second press is ignored.
 */
export function RescheduleLessonDialog({
  lessonId,
  onClose,
  onRescheduled,
}: RescheduleLessonDialogProps): ReactElement {
  const { t } = useTranslation("lessons");
  const formId = useId();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const lessonQuery = useGetLesson(lessonId);
  const lesson = lessonQuery.data;

  function handleRescheduled(saved: LessonResponseDto) {
    onRescheduled?.(saved);
    onClose();
  }

  function renderBody(): ReactElement {
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
      <RescheduleForm
        key={lesson.id}
        formId={formId}
        lesson={lesson}
        onPendingChange={setIsSubmitting}
        onLockedChange={setIsLocked}
        onRescheduled={handleRescheduled}
      />
    );
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("reschedule.title")}
      closeLabel={t("close")}
      size="wide"
      isDismissable={!isSubmitting}
      footer={
        <>
          <Button variant="secondary" isDisabled={isSubmitting} onPress={onClose}>
            {t("reschedule.back")}
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={formId}
            isLoading={isSubmitting}
            isDisabled={lesson === undefined || isLocked}
          >
            {isSubmitting ? t("reschedule.submitting") : t("reschedule.submit")}
          </Button>
        </>
      }
    >
      {renderBody()}
    </Dialog>
  );
}
