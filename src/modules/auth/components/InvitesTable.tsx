import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useListInvites } from "@api/generated";
import { InviteListItemDtoStatus, type InviteListItemDto } from "@api/generated/model";
import { DataTable, type Column } from "@shared/components/DataTable";
import { formatDateTime } from "@shared/lib/format-date";
import { Alert, Badge, Button, Skeleton, type BadgeProps } from "@shared/ui";

import { roleLabelKey } from "../lib/role-label";

const STATUS_TONE: Record<InviteListItemDtoStatus, BadgeProps["tone"]> = {
  [InviteListItemDtoStatus.pending]: "warning",
  [InviteListItemDtoStatus.used]: "success",
  [InviteListItemDtoStatus.expired]: "neutral",
  [InviteListItemDtoStatus.revoked]: "danger",
};

/**
 * Aba "Convites": listagem dos convites gerados (`GET /invites`, sem paginação). Nunca mostra
 * token nem URL — o `InviteListItemDto` da listagem não os traz.
 */
export function InvitesTable(): ReactElement {
  const { t, i18n } = useTranslation("auth");
  const query = useListInvites();

  const columns: Column<InviteListItemDto>[] = [
    {
      header: t("access.invites.columns.role"),
      render: (row) => {
        const key = roleLabelKey(row.role);
        return key ? t(key) : "—";
      },
    },
    {
      header: t("access.invites.columns.type"),
      render: (row) => t(`access.invites.type.${row.type}`),
    },
    {
      header: t("access.invites.columns.status"),
      render: (row) => (
        <Badge tone={STATUS_TONE[row.status]}>{t(`access.invites.status.${row.status}`)}</Badge>
      ),
    },
    {
      header: t("access.invites.columns.expiresAt"),
      render: (row) => formatDateTime(row.expiresAt, i18n.language),
    },
  ];

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-2">
        <p role="status">{t("access.invites.loading")}</p>
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Alert variant="error">{t("access.invites.error")}</Alert>
        <Button variant="secondary" onPress={() => void query.refetch()}>
          {t("access.invites.retry")}
        </Button>
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      rows={query.data}
      rowKey={(row) => row.id}
      caption={t("access.invites.caption")}
      emptyMessage={t("access.invites.empty")}
    />
  );
}
