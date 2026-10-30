import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useListInvites } from "@api/generated";
import { InviteType, ListInvitesStatus, type InviteListItemDto } from "@api/generated/model";
import { DataTable, type Column } from "@shared/components/DataTable";
import { Alert, Button, Dialog } from "@shared/ui";

import { formatInviteDateTime } from "../lib/access-format";
import { RevokeInviteDialog } from "./RevokeInviteDialog";

export interface PendingInvitesDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

/**
 * Convites pendentes: links de cadastro e de redefinição de senha que ainda não foram usados nem
 * venceram. Lê a mesma consulta do botão "Convites pendentes (N)", então a contagem acompanha
 * a lista. Revogar pede confirmação e é um modal por cima deste.
 */
export function PendingInvitesDialog({
  isOpen,
  onOpenChange,
}: PendingInvitesDialogProps): ReactElement {
  const { t, i18n } = useTranslation(["auth", "common"]);
  const { data, isPending, isError } = useListInvites({ status: ListInvitesStatus.pending });
  const [revoking, setRevoking] = useState<InviteListItemDto | null>(null);

  function roleLabel(invite: InviteListItemDto): string {
    if (invite.type === InviteType.password_reset) return t("access.pendingInvites.passwordReset");
    return invite.role ? t(`roles.${invite.role}`, { ns: "common" }) : "";
  }

  function dateTime(iso: string): string {
    return formatInviteDateTime(iso, i18n.language);
  }

  const columns: Column<InviteListItemDto>[] = [
    {
      header: t("access.pendingInvites.columns.role"),
      headerClassName: "uppercase",
      render: roleLabel,
    },
    {
      header: t("access.pendingInvites.columns.createdAt"),
      headerClassName: "w-[140px] uppercase",
      render: (invite) => dateTime(invite.createdAt),
    },
    {
      header: t("access.pendingInvites.columns.expiresAt"),
      headerClassName: "w-[140px] uppercase",
      render: (invite) => dateTime(invite.expiresAt),
    },
    {
      header: t("access.pendingInvites.columns.actions"),
      headerClassName: "w-[120px] uppercase",
      render: (invite) => (
        <Button
          variant="danger-soft"
          className="rounded-3xl px-4"
          aria-label={
            invite.type === InviteType.password_reset
              ? t("access.pendingInvites.revokeForPasswordReset", {
                  date: dateTime(invite.createdAt),
                })
              : t("access.pendingInvites.revokeFor", {
                  role: roleLabel(invite),
                  date: dateTime(invite.createdAt),
                })
          }
          onPress={() => setRevoking(invite)}
        >
          {t("access.pendingInvites.revoke")}
        </Button>
      ),
    },
  ];

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        size="wide"
        title={
          data
            ? t("access.pendingInvites.title", { count: data.length })
            : t("access.pendingInvites.titlePending")
        }
        description={t("access.pendingInvites.description")}
        closeLabel={t("access.pendingInvites.close")}
        footer={
          <Button onPress={() => onOpenChange(false)}>{t("access.pendingInvites.close")}</Button>
        }
      >
        <div className="flex flex-col gap-4">
          {data ? (
            <DataTable
              columns={columns}
              rows={data}
              rowKey={(invite) => invite.id}
              caption={t("access.pendingInvites.caption")}
              emptyMessage={t("access.pendingInvites.empty")}
            />
          ) : isPending ? (
            <p role="status" className="text-base text-muted">
              {t("access.pendingInvites.loading")}
            </p>
          ) : isError ? (
            <Alert variant="error">{t("access.pendingInvites.error")}</Alert>
          ) : null}
          <Alert variant="warning">{t("access.pendingInvites.notice")}</Alert>
        </div>
      </Dialog>

      {revoking ? <RevokeInviteDialog invite={revoking} onClose={() => setRevoking(null)} /> : null}
    </>
  );
}
