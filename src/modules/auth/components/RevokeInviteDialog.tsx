import type { ReactElement } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useRevokeInvite } from "@api/generated";
import { InviteType, type InviteListItemDto } from "@api/generated/model";
import { ConfirmDialog } from "@shared/components/ConfirmDialog";
import { toast } from "@shared/ui";

import { toInviteActionErrorKey } from "../lib/access-action-error";
import { formatInviteDateTime } from "../lib/access-format";
import { invalidatePendingInvites } from "../lib/access-queries";

export interface RevokeInviteDialogProps {
  invite: InviteListItemDto;
  onClose: () => void;
}

/**
 * Confirma a revogação de um convite pendente (convite de cadastro ou link de redefinição de
 * senha). Revogar invalida o link na hora e não tem volta. Quem usa o monta só enquanto está aberto.
 */
export function RevokeInviteDialog({ invite, onClose }: RevokeInviteDialogProps): ReactElement {
  const { t, i18n } = useTranslation(["auth", "common"]);
  const queryClient = useQueryClient();

  const revokeInvite = useRevokeInvite({
    mutation: {
      onSuccess: () => {
        void invalidatePendingInvites(queryClient);
        toast.success(t("access.toast.inviteRevoked"));
        onClose();
      },
      onError: (error) => {
        // Já usado, já revogado ou sumido: a linha não deveria mais estar na lista.
        if (toInviteActionErrorKey(error) === "inviteGone") {
          void invalidatePendingInvites(queryClient);
        }
      },
    },
  });

  const date = formatInviteDateTime(invite.createdAt, i18n.language);
  const body =
    invite.type === InviteType.password_reset
      ? t("access.pendingInvites.confirm.bodyPasswordReset", { date })
      : t("access.pendingInvites.confirm.body", {
          role: invite.role ? t(`roles.${invite.role}`, { ns: "common" }) : "",
          date,
        });

  const errorMessage = revokeInvite.isError
    ? t(`access.actionErrors.${toInviteActionErrorKey(revokeInvite.error)}`)
    : undefined;

  function confirm() {
    if (revokeInvite.isPending) return;
    revokeInvite.mutate({ id: invite.id });
  }

  return (
    <ConfirmDialog
      isOpen
      title={t("access.pendingInvites.confirm.title")}
      confirmLabel={t("access.pendingInvites.confirm.confirm")}
      confirmingLabel={t("access.pendingInvites.confirm.confirming")}
      cancelLabel={t("access.pendingInvites.confirm.back")}
      closeLabel={t("access.pendingInvites.close")}
      tone="danger"
      isConfirming={revokeInvite.isPending}
      errorMessage={errorMessage}
      onConfirm={confirm}
      onCancel={onClose}
    >
      <p className="text-base text-foreground">{body}</p>
    </ConfirmDialog>
  );
}
