import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { MemberListItemResponseDto } from "@api/generated/model";
import { DataTable, type Column } from "@shared/components/DataTable";
import { Badge, Button } from "@shared/ui";

import { MEMBER_ROW_STATUS_TONE, memberRowStatus } from "../lib/member-status";
import { roleBadgeTone } from "../lib/role-label";

export interface AccessTableProps {
  rows: MemberListItemResponseDto[];
  /**
   * Opens the validation of the registration of a row. Only the rows waiting for validation get
   * the Validar button, and only when this is given: the screen leaves it out for who cannot
   * validate, so the table does not check permissions.
   */
  onValidate?: (row: MemberListItemResponseDto) => void;
}

function KebabIcon(): ReactElement {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="8" cy="3" r="1.25" />
      <circle cx="8" cy="8" r="1.25" />
      <circle cx="8" cy="13" r="1.25" />
    </svg>
  );
}

/**
 * The table of the list of members, with the six columns of the Figma: Membro, Papel, Departamento,
 * Função principal, Status and Ações. Department and main function come from the API; a missing one
 * shows a dash to who sees it and "Não informado" to who hears it. The Status column says "A
 * validar" for a registration waiting for validation (with the Validar button in Ações) and
 * "Recusado" for a refused one.
 */
export function AccessTable({ rows, onValidate }: AccessTableProps): ReactElement {
  const { t } = useTranslation(["auth", "common"]);

  function renderOptionalText(value: string | null | undefined): ReactNode {
    if (value) return value;

    return (
      <>
        <span aria-hidden="true">{t("details.empty", { ns: "common" })}</span>
        <span className="sr-only">{t("details.notInformed", { ns: "common" })}</span>
      </>
    );
  }

  const columns: Column<MemberListItemResponseDto>[] = [
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
      header: t("access.people.columns.department"),
      headerClassName: "uppercase",
      render: (row) => renderOptionalText(row.department?.name),
    },
    {
      header: t("access.people.columns.mainFunction"),
      headerClassName: "uppercase",
      render: (row) => renderOptionalText(row.mainFunction),
    },
    {
      header: t("access.people.columns.status"),
      headerClassName: "w-[152px] uppercase",
      render: (row) => {
        const status = memberRowStatus(row);

        return (
          <Badge tone={MEMBER_ROW_STATUS_TONE[status]}>{t(`access.people.status.${status}`)}</Badge>
        );
      },
    },
    {
      header: t("access.people.columns.actions"),
      headerClassName: "w-[160px] uppercase",
      // The menu of the row is GUS-88's; until then the kebab has no action.
      render: (row) => (
        <div className="flex items-center gap-1">
          {onValidate && memberRowStatus(row) === "pending" ? (
            <Button
              variant="secondary"
              aria-label={t("access.people.validateLabel", { name: row.name })}
              onPress={() => onValidate(row)}
            >
              {t("access.people.validate")}
            </Button>
          ) : null}
          <Button
            isIconOnly
            variant="ghost"
            aria-label={t("access.people.rowActions", { name: row.name })}
          >
            <KebabIcon />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      caption={t("access.people.caption")}
      tableClassName="table-fixed min-w-[960px]"
    />
  );
}
