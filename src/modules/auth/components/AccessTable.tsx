import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { MemberListItemResponseDto } from "@api/generated/model";
import pencilIcon from "@shared/assets/icons/pencil.svg";
import trashBinIcon from "@shared/assets/icons/trash-bin.svg";
import { DataTable, type Column } from "@shared/components/DataTable";
import { Badge, Button, Tooltip } from "@shared/ui";

import { useCan } from "../hooks/useCan";
import { MEMBER_ROW_STATUS_TONE, memberRowStatus } from "../lib/member-status";
import { roleBadgeTone } from "../lib/role-label";

export interface AccessTableProps {
  rows: MemberListItemResponseDto[];
  /** Abre "Editar membro" da linha. */
  onEditMember: (row: MemberListItemResponseDto) => void;
  /**
   * Abre "Inativar membro" (GUS-149 e GUS-147). Enquanto a tela não passar isto, a lixeira não
   * aparece: inativar é diferente de desativar o acesso e ainda não tem modal nem rota.
   */
  onDeactivateMember?: (row: MemberListItemResponseDto) => void;
  /**
   * Opens the validation of the registration of a row. Only the rows waiting for validation get
   * the Validar button, and only when this is given: the screen leaves it out for who cannot
   * validate, so the table does not check permissions.
   */
  onValidate?: (row: MemberListItemResponseDto) => void;
  /**
   * Abre a ficha do membro (GUS-145). Clicar nos ícones da linha não chama isto. Sem esta prop a
   * linha não é clicável e não ganha o realce de hover.
   */
  onRowClick?: (row: MemberListItemResponseDto) => void;
}

// Realce de linha do Figma: fundo claro (do DataTable) + barra de 3px da cor de ação à esquerda.
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
  // `MemberListItemResponseDto` ainda não traz a flag `canEdit` por linha: sem ela o diretor
  // (escopo "department") não vê o lápis, e a coordenação (escopo "all") vê em todas.
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
      render: (row) => (
        // Ícones de 16px dentro de botões de 44px (alvo de toque): o Figma desenha só o ícone.
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
