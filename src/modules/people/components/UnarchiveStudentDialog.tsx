import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useUnarchiveStudent } from "@api/generated/people/people";
import { Alert, Button, Dialog, toast } from "@shared/ui";

import { toStudentActionError, type StudentActionErrorKind } from "../lib/student-errors";
import { invalidateAfterStudentChanged } from "../lib/student-queries";

export interface UnarchiveStudentDialogProps {
  studentId: string;
  onClose: () => void;
}

/** Reativar aluno (GUS-123), with confirmation: the student is back in the active lists. */
export function UnarchiveStudentDialog({
  studentId,
  onClose,
}: UnarchiveStudentDialogProps): ReactElement {
  const { t } = useTranslation("people");
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<StudentActionErrorKind | null>(null);
  const unarchiveStudent = useUnarchiveStudent();
  const isPending = unarchiveStudent.isPending;

  function confirm() {
    if (isPending) return;
    setSubmitError(null);

    unarchiveStudent.mutate(
      { id: studentId },
      {
        onSuccess: () => {
          toast.success(t("student.unarchive.success"));
          void invalidateAfterStudentChanged(queryClient);
          onClose();
        },
        onError: (error) => {
          const result = toStudentActionError(error);
          setSubmitError(result.kind === "fields" ? "unknown" : result.kind);
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
      title={t("student.unarchive.title")}
      closeLabel={t("student.form.close")}
      isDismissable={!isPending}
      footer={
        <>
          <Button variant="secondary" isDisabled={isPending} onPress={onClose}>
            {t("student.unarchive.back")}
          </Button>
          <Button variant="primary" isLoading={isPending} onPress={confirm}>
            {isPending ? t("student.unarchive.confirming") : t("student.unarchive.confirm")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-base">{t("student.unarchive.description")}</p>
        {submitError !== null ? (
          <Alert variant="error">{t(`student.actionErrors.${submitError}`)}</Alert>
        ) : null}
      </div>
    </Dialog>
  );
}
