import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactElement } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useArchiveLessonPlan } from "@api/generated/catalog/catalog";
import type { LessonPlanResponseDto } from "@api/generated/model";
import { Alert, Button, Dialog, TextArea, toast } from "@shared/ui";

import { resolveArchiveField, toSubmitError, type SubmitErrorKind } from "../lib/api-form-errors";
import { invalidateLessonPlans } from "../lib/lesson-plan-queries";
import {
  archiveLessonPlanFormSchema,
  LESSON_PLAN_LIMITS,
  toArchiveBody,
  type ArchiveLessonPlanFormValues,
} from "../schemas/lesson-plan.schema";

export interface ArchiveLessonPlanDialogProps {
  lessonPlanId: string;
  onClose: () => void;
  onArchived?: (plan: LessonPlanResponseDto) => void;
}

export function ArchiveLessonPlanDialog({
  lessonPlanId,
  onClose,
  onArchived,
}: ArchiveLessonPlanDialogProps): ReactElement {
  const { t } = useTranslation("catalog");
  const queryClient = useQueryClient();
  const formId = useId();
  const errorRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const [submitError, setSubmitError] = useState<SubmitErrorKind | null>(null);

  const { control, handleSubmit, setError, setFocus } = useForm<ArchiveLessonPlanFormValues>({
    resolver: zodResolver(archiveLessonPlanFormSchema),
    defaultValues: { reason: "" },
  });

  const archivePlan = useArchiveLessonPlan({
    mutation: {
      onSuccess: () => {
        toast.success(t("toast.archived"));
        void invalidateLessonPlans(queryClient);
      },
    },
  });
  const isPending = archivePlan.isPending;

  useEffect(() => {
    if (submitError !== null) errorRef.current?.focus();
  }, [submitError]);

  function handleError(error: unknown) {
    const result = toSubmitError(error, resolveArchiveField);

    if (result.kind === "fields") {
      for (const { name, message } of result.fields) setError(name, { type: "server", message });
      setFocus(result.fields[0].name);
      return;
    }
    setSubmitError(result.kind);
  }

  function archive(values: ArchiveLessonPlanFormValues) {
    if (isPending || inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmitError(null);

    archivePlan.mutate(
      { id: lessonPlanId, data: toArchiveBody(values) },
      {
        onSuccess: (plan) => {
          onArchived?.(plan);
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
    void handleSubmit(archive)(event);
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("archive.title")}
      closeLabel={t("close")}
      isDismissable={!isPending}
      footer={
        <>
          <Button variant="secondary" isDisabled={isPending} onPress={onClose}>
            {t("archive.back")}
          </Button>
          <Button variant="danger-soft" type="submit" form={formId} isLoading={isPending}>
            {isPending ? t("archive.confirming") : t("archive.confirm")}
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
        <Alert variant="warning" description={t("archive.warningDescription")}>
          {t("archive.warningTitle")}
        </Alert>

        <Controller
          name="reason"
          control={control}
          render={({ field, fieldState }) => (
            <TextArea
              label={t("archive.reason")}
              description={t("archive.reasonHelp")}
              placeholder={t("archive.reasonExample")}
              rows={4}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              autoFocus
              errorMessage={
                fieldState.error?.message
                  ? t(`archive.errors.${fieldState.error.message}`, LESSON_PLAN_LIMITS)
                  : undefined
              }
            />
          )}
        />

        {submitError !== null ? (
          <div ref={errorRef} tabIndex={-1} className="outline-none">
            <Alert variant="error">{t(`errors.${submitError}`)}</Alert>
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}
