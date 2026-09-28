import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { AccessResponseDto } from "@api/generated/model";
import { DataTable, type Column } from "@shared/components/DataTable";
import { Badge } from "@shared/ui";

import { roleBadgeTone } from "../lib/role-label";

export interface AccessTableProps {
  rows: AccessResponseDto[];
}

export function AccessTable({ rows }: AccessTableProps): ReactElement {
  const { t } = useTranslation(["auth", "common"]);

  const columns: Column<AccessResponseDto>[] = [
    {
      header: t("access.people.columns.member"),
      headerClassName: "w-[245px] uppercase",
      render: (row) => row.name,
    },
    {
      header: t("access.people.columns.role"),
      headerClassName: "w-[167px] uppercase",
      render: (row) =>
        row.role ? (
          <Badge tone={roleBadgeTone(row.role)}>{t(`roles.${row.role}`, { ns: "common" })}</Badge>
        ) : null,
    },
    {
      header: t("access.people.columns.departments"),
      // Sem `uppercase`: no Figma este cabeçalho está em caixa normal (mantido idêntico).
      render: () => null,
    },
    {
      header: t("access.people.columns.mainFunction"),
      headerClassName: "uppercase",
      render: () => null,
    },
    {
      header: t("access.people.columns.status"),
      headerClassName: "w-[152px] uppercase",
      render: (row) => (
        <Badge tone={row.accessEnabled ? "success" : "neutral"}>
          {t(row.accessEnabled ? "access.people.status.active" : "access.people.status.inactive")}
        </Badge>
      ),
    },
    {
      header: t("access.people.columns.actions"),
      headerClassName: "uppercase",
      render: () => null,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      caption={t("access.people.caption")}
      emptyMessage={t("access.people.empty")}
      tableClassName="table-fixed min-w-[900px]"
    />
  );
}
