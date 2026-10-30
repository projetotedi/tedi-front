import type { ReactElement } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useUpdateAccessEnabled } from "@api/generated";
import type { AccessResponseDto } from "@api/generated/model";
import { ConfirmDialog } from "@shared/components/ConfirmDialog";
import { Alert, toast } from "@shared/ui";

import { toAccessActionErrorKey } from "../lib/access-action-error";
import { invalidateAccessList } from "../lib/access-queries";
import { MemberSummary } from "./MemberSummary";

export interface DisableAccessDialogProps {
  access: AccessResponseDto;
  onClose: () => void;
  /** Recebe a pessoa já com o acesso desativado, para a tela que abriu o diálogo se atualizar. */
  onDisabled: (updated: AccessResponseDto) => void;
}

/**
 * Confirma "Desativar acesso": a pessoa deixa de entrar, mas continua no projeto (desativar não é
 * inativar). Quem usa o monta só enquanto está aberto.
 */
export function DisableAccessDialog({
  access,
  onClose,
  onDisabled,
}: DisableAccessDialogProps): ReactElement {
  const { t } = useTranslation("auth");
  const queryClient = useQueryClient();

  const disableAccess = useUpdateAccessEnabled({
    mutation: {
      onSuccess: (updated) => {
        void invalidateAccessList(queryClient);
        toast.success(t("access.toast.accessDisabled", { name: access.name }));
        onDisabled(updated);
        onClose();
      },
    },
  });

  const errorMessage = disableAccess.isError
    ? t(`access.actionErrors.${toAccessActionErrorKey(disableAccess.error)}`)
    : undefined;

  function confirm() {
    if (disableAccess.isPending) return;
    disableAccess.mutate({ id: access.id, data: { enabled: false } });
  }

  return (
    <ConfirmDialog
      isOpen
      title={t("access.disableAccess.title")}
      confirmLabel={t("access.disableAccess.confirm")}
      confirmingLabel={t("access.disableAccess.confirming")}
      cancelLabel={t("access.disableAccess.back")}
      closeLabel={t("access.disableAccess.close")}
      tone="danger"
      isConfirming={disableAccess.isPending}
      errorMessage={errorMessage}
      onConfirm={confirm}
      onCancel={onClose}
    >
      <MemberSummary access={access} />
      <Alert variant="danger">{t("access.disableAccess.warning")}</Alert>
      <p className="text-base text-muted">{t("access.disableAccess.note")}</p>
    </ConfirmDialog>
  );
}
