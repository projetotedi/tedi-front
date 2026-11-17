import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import type { AccessResponseDto } from "@api/generated/model";
import { DataTable, type Column } from "@shared/components/DataTable";
import { Badge, Button } from "@shared/ui";

import { memberDetailPath } from "../lib/member-path";
import { roleBadgeTone } from "../lib/role-label";

export interface AccessTableProps {
  rows: AccessResponseDto[];
  /**
   * Abre a ficha do membro (GUS-145). Clicar nos ícones da linha não chama isto. Sem esta prop a
   * linha não é clicável e não ganha o realce de hover.
   */
  onRowClick?: (row: AccessResponseDto) => void;
}

// Realce de linha do Figma: fundo claro (do DataTable) + barra de 3px da cor de ação à esquerda.
const CLICKABLE_ROW_CLASS =
  "hover:shadow-[inset_3px_0_0_var(--accent)] focus-within:shadow-[inset_3px_0_0_var(--accent)]";

function KebabIcon(): ReactElement {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="8" cy="3" r="1.25" />
      <circle cx="8" cy="8" r="1.25" />
      <circle cx="8" cy="13" r="1.25" />
    </svg>
  );
}

export function AccessTable({ rows, onRowClick }: AccessTableProps): ReactElement {
  const { t } = useTranslation(["auth", "common"]);

  const columns: Column<AccessResponseDto>[] = [
    {
      header: t("access.people.columns.member"),
      headerClassName: "w-[245px] uppercase",
      // O nome é o caminho do teclado e do leitor de tela até a ficha: a linha (`<tr>`) não recebe foco.
      render: (row) => (
        <Link
          to={memberDetailPath(row.id)}
          className="inline-flex min-h-11 items-center rounded-sm font-medium underline-offset-2 hover:underline outline-hidden focus-visible:ring-3 focus-visible:ring-focus"
        >
          {row.name}
        </Link>
      ),
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
      header: t("access.people.columns.department"),
      headerClassName: "uppercase",
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
      // Ainda sem ação: o menu da linha é da GUS-88.
      render: (row) => (
        <Button
          isIconOnly
          variant="ghost"
          aria-label={t("access.people.rowActions", { name: row.name })}
        >
          <KebabIcon />
        </Button>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      caption={t("access.people.caption")}
      tableClassName="table-fixed min-w-[840px]"
      onRowClick={onRowClick}
      rowClassName={onRowClick ? CLICKABLE_ROW_CLASS : undefined}
    />
  );
}
