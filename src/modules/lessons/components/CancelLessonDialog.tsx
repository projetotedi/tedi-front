import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactElement } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useCancelLesson } from "@api/generated/lessons/lessons";
import type { LessonResponseDto } from "@api/generated/model";
import { Alert, Button, Dialog, TextArea, toast } from "@shared/ui";

import {
  CANCEL_LESSON_FIELDS,
  toLessonSubmitError,
  type LessonAlertErrorKind,
} from "../lib/lesson-errors";
import { applySavedLesson, invalidateLesson } from "../lib/lesson-queries";
import {
  cancelLessonFormSchema,
  LESSON_LIMITS,
  toCancelLessonBody,
  type CancelLessonFormValues,
} from "../schemas/lesson.schema";
import { RequiredLabel } from "./RequiredLabel";

export interface CancelLessonDialogProps {
  lessonId: string;
  onClose: () => void;
  onCancelled?: (lesson: LessonResponseDto) => void;
}

/**
 * "Cancelar aula" (F3.5, RF-044): the reason, which is required, and the warning of what cancelling
 * does (the hours already logged are reversed, RN-07, and the lesson stays on the calendar, marked as
 * cancelled). The warning is the static kind of alert, not the red one of the Figma: a red alert is a
 * live region and would be read together with the title of the dialog. The text has no number of
 * members, because there is no allocation yet. Cancelar aula (`danger`) sends
 * `PATCH /lessons/:id/cancel`, and on success the toast says so, the cache of the lesson becomes
 * the answer (it is cancelled now) and the dialog closes.
 *
 * An empty reason, or one with only spaces, is refused on the field, with the focus there, and
 * nothing is sent. The errors of the API go to the reason (a `VALIDATION_FAILED` that points at it)
 * or show as an alert that takes the focus; a lesson that was already cancelled shows as a warning
 * and turns Cancelar aula off. While the request is on its way the dialog cannot be closed (X, Esc
 * and Voltar are off) and a second press is ignored.
 */
export function CancelLessonDialog({
  lessonId,
  onClose,
  onCancelled,
}: CancelLessonDialogProps): ReactElement {
  const { t } = useTranslation("lessons");
  const queryClient = useQueryClient();
  const formId = useId();
  const errorRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const [submitError, setSubmitError] = useState<LessonAlertErrorKind | null>(null);

  const { control, handleSubmit, setError, setFocus } = useForm<CancelLessonFormValues>({
    resolver: zodResolver(cancelLessonFormSchema),
    defaultValues: { reason: "" },
  });

  const cancelLesson = useCancelLesson({
    mutation: { onSuccess: (lesson) => void applySavedLesson(queryClient, lesson) },
  });
  const isPending = cancelLesson.isPending;
  const isAlreadyCancelled = submitError === "lessonCancelled";

  useEffect(() => {
    if (submitError !== null) errorRef.current?.focus();
  }, [submitError]);

  function handleError(error: unknown) {
    const result = toLessonSubmitError(error, CANCEL_LESSON_FIELDS);

    if (result.kind === "fields") {
      for (const { name, message } of result.fields) setError(name, { type: "server", message });
      setFocus(result.fields[0].name);
      return;
    }

    if (result.kind === "lessonCancelled" || result.kind === "lessonNotFound") {
      void invalidateLesson(queryClient, lessonId);
    }
    setSubmitError(result.kind);
  }

  function cancel(values: CancelLessonFormValues) {
    if (isPending || inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmitError(null);

    cancelLesson.mutate(
      { id: lessonId, data: toCancelLessonBody(values) },
      {
        onSuccess: (lesson) => {
          toast.success(t("toast.cancelled"));
          onCancelled?.(lesson);
          onClose();
        },
        onError: handleError,
        onSettled: () => {
          inFlightRef.current = false;
        },
      },
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    void handleSubmit(cancel)(event);
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("cancel.title")}
      closeLabel={t("close")}
      isDismissable={!isPending}
      footer={
        <>
          <Button variant="secondary" isDisabled={isPending} onPress={onClose}>
            {t("cancel.back")}
          </Button>
          <Button
            variant="danger"
            type="submit"
            form={formId}
            isLoading={isPending}
            isDisabled={isAlreadyCancelled}
          >
            {isPending ? t("cancel.submitting") : t("cancel.submit")}
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
        <Alert variant="warning" description={t("cancel.warningDescription")}>
          {t("cancel.warningTitle")}
        </Alert>

        <Controller
          name="reason"
          control={control}
          render={({ field, fieldState }) => (
            <TextArea
              label={<RequiredLabel>{t("cancel.reason")}</RequiredLabel>}
              description={t("cancel.reasonHint")}
              rows={4}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              isRequired
              autoFocus
              errorMessage={
                fieldState.error?.message
                  ? t(`fieldErrors.${fieldState.error.message}`, {
                      reasonMax: LESSON_LIMITS.cancelReasonMax,
                    })
                  : undefined
              }
            />
          )}
        />

        {submitError !== null ? (
          <div ref={errorRef} tabIndex={-1} className="outline-none">
            <Alert variant={isAlreadyCancelled ? "warning" : "error"}>
              {t(`errors.${submitError}`)}
            </Alert>
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}
