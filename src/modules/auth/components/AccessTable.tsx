import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import type { MemberListItemResponseDto } from "@api/generated/model";
import pencilIcon from "@shared/assets/icons/pencil.svg";
import trashBinIcon from "@shared/assets/icons/trash-bin.svg";
import { DataTable, type Column } from "@shared/components/DataTable";
import { Badge, Button, Tooltip } from "@shared/ui";

import { useCan } from "../hooks/useCan";
import { memberDetailPath } from "../lib/member-path";
import { MEMBER_ROW_STATUS_TONE, memberRowStatus } from "../lib/member-status";
import { roleBadgeTone } from "../lib/role-label";

export interface AccessTableProps {
  rows: MemberListItemResponseDto[];
  /** Opens "Editar membro" for the row. */
  onEditMember: (row: MemberListItemResponseDto) => void;
  /**
   * Opens "Inativar membro" (GUS-149 and GUS-147). While the screen does not pass this, the trash
   * icon is hidden: deactivating a member is different from disabling login access and has no modal
   * or route yet.
   */
  onDeactivateMember?: (row: MemberListItemResponseDto) => void;
  /**
   * Opens the validation of the registration of a row. Only the rows waiting for validation get
   * the Validar button, and only when this is given: the screen leaves it out for who cannot
   * validate, so the table does not check permissions.
   */
  onValidate?: (row: MemberListItemResponseDto) => void;
  /**
   * Opens the detail screen of a member (GUS-145). Clicking the links or action buttons of the row
   * does not call this. Without this prop the row is not clickable and gets no hover highlight.
   */
  onRowClick?: (row: MemberListItemResponseDto) => void;
}

// Row highlight of the Figma: light background (from DataTable) + 3px accent bar on the left.
const CLICKABLE_ROW_CLASS =
  "hover:shadow-[inset_3px_0_0_var(--accent)] focus-within:shadow-[inset_3px_0_0_var(--accent)]";

/**
 * The table of the list of members, with the six columns of the Figma: Membro, Papel, Departamento,
 * Função principal, Status and Ações. Department and main function come from the API; a missing one
 * shows a dash to who sees it and "Não informado" to who hears it. The Status column says "A
 * validar" for a registration waiting for validation (with the Validar button in Ações) and
 * "Recusado" for a refused one.
 */
export function AccessTable({
  rows,
  onEditMember,
  onDeactivateMember,
  onValidate,
  onRowClick,
}: AccessTableProps): ReactElement {
  const { t } = useTranslation(["auth", "common"]);
  // `MemberListItemResponseDto` does not carry a per-row `canEdit` flag yet: without it the
  // director ("department" scope) sees no pencil, and the coordinator ("all" scope) sees it on all.
  const canEdit = useCan("members.edit", { serverGrant: false });
  const canDeactivate = useCan("members.deactivate");

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
      // The name is the keyboard and screen reader path to the member screen: `<tr>` does not take focus.
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
      render: (row) => (
        // 16px icons inside 44px buttons (touch target): the Figma draws only the icon.
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
          {canEdit ? (
            <Tooltip content={t("access.people.actions.editTooltip")}>
              <Button
                isIconOnly
                variant="ghost"
                aria-label={t("access.people.actions.edit", { name: row.name })}
                onPress={() => onEditMember(row)}
              >
                <img src={pencilIcon} alt="" aria-hidden="true" width={16} height={16} />
              </Button>
            </Tooltip>
          ) : null}
          {canDeactivate && onDeactivateMember ? (
            <Tooltip content={t("access.people.actions.deactivateTooltip")}>
              <Button
                isIconOnly
                variant="ghost"
                aria-label={t("access.people.actions.deactivateMember", { name: row.name })}
                onPress={() => onDeactivateMember(row)}
              >
                <img src={trashBinIcon} alt="" aria-hidden="true" width={16} height={16} />
              </Button>
            </Tooltip>
          ) : null}
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
      onRowClick={onRowClick}
      rowClassName={onRowClick ? CLICKABLE_ROW_CLASS : undefined}
    />
  );
}
