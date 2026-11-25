import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useUnarchiveClass } from "@api/generated/classes/classes";
import { Alert, Button, Dialog, toast } from "@shared/ui";

import { toClassActionError, type ClassActionErrorKind } from "../lib/class-errors";
import { invalidateAfterClassChanged } from "../lib/class-queries";

export interface UnarchiveClassDialogProps {
  classId: string;
  onClose: () => void;
}

/**
 * Reativar turma (RN-27, GUS-133): a confirmation, since the class goes back to the active lists.
 * Opened from the row of an archived class in the list.
 */
export function UnarchiveClassDialog({
  classId,
  onClose,
}: UnarchiveClassDialogProps): ReactElement {
  const { t } = useTranslation("classes");
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<ClassActionErrorKind | null>(null);
  const unarchiveClass = useUnarchiveClass();
  const isPending = unarchiveClass.isPending;

  function confirm() {
    if (isPending) return;
    setSubmitError(null);

    unarchiveClass.mutate(
      { id: classId },
      {
        onSuccess: (reactivated) => {
          toast.success(t("unarchiveDialog.success"));
          void invalidateAfterClassChanged(queryClient, reactivated);
          onClose();
        },
        onError: (error) => setSubmitError(toClassActionError(error)),
      },
    );
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("unarchiveDialog.title")}
      closeLabel={t("close")}
      isDismissable={!isPending}
      footer={
        <>
          <Button variant="secondary" isDisabled={isPending} onPress={onClose}>
            {t("unarchiveDialog.back")}
          </Button>
          <Button variant="primary" isLoading={isPending} onPress={confirm}>
            {isPending ? t("unarchiveDialog.confirming") : t("unarchiveDialog.confirm")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-base">{t("unarchiveDialog.description")}</p>
        {submitError !== null ? (
          <Alert variant="error">{t(`actionErrors.${submitError}`)}</Alert>
        ) : null}
      </div>
    </Dialog>
  );
}
