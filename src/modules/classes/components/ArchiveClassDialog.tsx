import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactElement } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useArchiveClass } from "@api/generated/classes/classes";
import { Alert, Button, Dialog, TextArea, toast } from "@shared/ui";

import { toClassActionError, type ClassActionErrorKind } from "../lib/class-errors";
import { invalidateAfterClassChanged } from "../lib/class-queries";
import {
  ARCHIVE_CLASS_LIMITS,
  archiveClassFormSchema,
  toArchiveClassBody,
  type ArchiveClassFormValues,
} from "../schemas/archive-class.schema";

export interface ArchiveClassDialogProps {
  classId: string;
  onClose: () => void;
}

function isReasonError(error: unknown): boolean {
  const shape = (typeof error === "object" && error !== null ? error : {}) as {
    statusCode?: unknown;
    error?: unknown;
    details?: unknown;
  };

  return (
    shape.statusCode === 400 &&
    shape.error === "VALIDATION_FAILED" &&
    Array.isArray(shape.details) &&
    shape.details.some((detail) => (detail as { field?: unknown } | null)?.field === "reason")
  );
}

/**
 * Arquivar turma (RN-27, GUS-133), as in the Figma: the warning that the class leaves the active
 * lists but keeps its lessons, attendance and enrollments, an optional reason and Voltar /
 * Arquivar turma. The reason goes to the API only when it was filled in. A class that still has
 * students is refused by the API (409 `CLASS_HAS_ACTIVE_ENROLLMENTS`), and the dialog says why and
 * stays open. Opened from the bin of the list.
 */
export function ArchiveClassDialog({ classId, onClose }: ArchiveClassDialogProps): ReactElement {
  const { t } = useTranslation("classes");
  const queryClient = useQueryClient();
  const formId = useId();
  const errorRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const [submitError, setSubmitError] = useState<ClassActionErrorKind | null>(null);

  const { control, handleSubmit, setError, setFocus } = useForm<ArchiveClassFormValues>({
    resolver: zodResolver(archiveClassFormSchema),
    defaultValues: { reason: "" },
  });

  const archiveClass = useArchiveClass();
  const isPending = archiveClass.isPending;

  useEffect(() => {
    if (submitError !== null) errorRef.current?.focus();
  }, [submitError]);

  function archive(values: ArchiveClassFormValues) {
    if (isPending || inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmitError(null);

    archiveClass.mutate(
      { id: classId, data: toArchiveClassBody(values) },
      {
        onSuccess: (archived) => {
          toast.success(t("archiveDialog.success"));
          void invalidateAfterClassChanged(queryClient, archived);
          onClose();
        },
        onError: (error) => {
          if (isReasonError(error)) {
            setError("reason", { type: "server", message: "reasonTooLong" });
            setFocus("reason");
            return;
          }
          setSubmitError(toClassActionError(error));
        },
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
      title={t("archiveDialog.title")}
      closeLabel={t("close")}
      isDismissable={!isPending}
      footer={
        <>
          <Button variant="secondary" isDisabled={isPending} onPress={onClose}>
            {t("archiveDialog.back")}
          </Button>
          <Button variant="danger-soft" type="submit" form={formId} isLoading={isPending}>
            {isPending ? t("archiveDialog.confirming") : t("archiveDialog.confirm")}
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
        <Alert variant="warning" description={t("archiveDialog.warningDescription")}>
          {t("archiveDialog.warningTitle")}
        </Alert>

        <Controller
          name="reason"
          control={control}
          render={({ field, fieldState }) => (
            <TextArea
              label={t("archiveDialog.reason")}
              description={t("archiveDialog.reasonHelp")}
              placeholder={t("archiveDialog.reasonExample")}
              rows={4}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              autoFocus
              errorMessage={
                fieldState.error?.message
                  ? t(`archiveDialog.errors.${fieldState.error.message}`, ARCHIVE_CLASS_LIMITS)
                  : undefined
              }
            />
          )}
        />

        {submitError !== null ? (
          <div ref={errorRef} tabIndex={-1} className="outline-none">
            <Alert variant="error">{t(`actionErrors.${submitError}`)}</Alert>
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}
