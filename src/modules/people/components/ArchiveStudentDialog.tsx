import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useArchiveStudent } from "@api/generated/people/people";
import { Alert, Button, Dialog, TextArea, toast } from "@shared/ui";

import { toStudentActionError, type StudentActionErrorKind } from "../lib/student-errors";
import { invalidateAfterStudentChanged } from "../lib/student-queries";
import {
  STUDENT_LIMITS,
  archiveStudentFormSchema,
  type ArchiveStudentFormValues,
} from "../schemas/student.schema";

export interface ArchiveStudentDialogProps {
  studentId: string;
  onClose: () => void;
  onArchived?: () => void;
}

/**
 * Arquivar aluno (RN-27, GUS-123, Figma): the warning that the student leaves the active lists and
 * the enrollments and the history stay, an optional reason and Voltar / Arquivar aluno. A student
 * with an active enrollment is refused (409 `STUDENT_HAS_ACTIVE_ENROLLMENTS`) and the dialog says
 * so as a warning. Opened by the bin of the list and by Arquivar aluno on the record, only for the
 * coordination (`students.archive`).
 */
export function ArchiveStudentDialog({
  studentId,
  onClose,
  onArchived,
}: ArchiveStudentDialogProps): ReactElement {
  const { t } = useTranslation("people");
  const queryClient = useQueryClient();
  const formId = useId();
  const errorRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const [submitError, setSubmitError] = useState<StudentActionErrorKind | null>(null);

  const { control, handleSubmit, setError, setFocus } = useForm<ArchiveStudentFormValues>({
    resolver: zodResolver(archiveStudentFormSchema),
    defaultValues: { reason: "" },
  });

  const archiveStudent = useArchiveStudent();
  const isPending = archiveStudent.isPending;

  useEffect(() => {
    if (submitError !== null) errorRef.current?.focus();
  }, [submitError]);

  function handleError(error: unknown) {
    const result = toStudentActionError(error);
    if (result.kind === "fields") {
      if (result.fields.some((field) => field.name === "reason")) {
        setError("reason", { type: "server", message: "reasonTooLong" });
        setFocus("reason");
        return;
      }
      setSubmitError("unknown");
      return;
    }
    setSubmitError(result.kind);
  }

  function archive(values: ArchiveStudentFormValues) {
    if (isPending || inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmitError(null);
    const reason = values.reason.trim();

    archiveStudent.mutate(
      { id: studentId, data: reason ? { reason } : undefined },
      {
        onSuccess: () => {
          toast.success(t("student.archive.success"));
          void invalidateAfterStudentChanged(queryClient);
          onArchived?.();
          onClose();
        },
        onError: handleError,
        onSettled: () => {
          inFlightRef.current = false;
        },
      },
    );
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("student.archive.title")}
      closeLabel={t("student.form.close")}
      isDismissable={!isPending}
      footer={
        <>
          <Button variant="secondary" isDisabled={isPending} onPress={onClose}>
            {t("student.archive.back")}
          </Button>
          <Button variant="danger-soft" type="submit" form={formId} isLoading={isPending}>
            {isPending ? t("student.archive.confirming") : t("student.archive.confirm")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        aria-busy={isPending}
        onSubmit={(event) => void handleSubmit(archive)(event)}
        className="flex flex-col gap-4"
      >
        <Alert variant="warning" description={t("student.archive.warningDescription")}>
          {t("student.archive.warningTitle")}
        </Alert>

        <Controller
          name="reason"
          control={control}
          render={({ field, fieldState }) => (
            <TextArea
              label={t("student.archive.reason")}
              description={t("student.archive.reasonHelp")}
              rows={3}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              autoFocus
              errorMessage={
                fieldState.error?.message
                  ? t(`student.form.errors.${fieldState.error.message}`, STUDENT_LIMITS)
                  : undefined
              }
            />
          )}
        />

        {submitError !== null ? (
          <div ref={errorRef} tabIndex={-1} className="outline-none">
            <Alert variant={submitError === "hasActiveEnrollments" ? "warning" : "error"}>
              {t(`student.actionErrors.${submitError}`)}
            </Alert>
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}
