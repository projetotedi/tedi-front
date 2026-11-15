import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { AccessResponseDto } from "@api/generated/model";
import pencilIcon from "@shared/assets/icons/pencil.svg";
import trashBinIcon from "@shared/assets/icons/trash-bin.svg";
import { DataTable, type Column } from "@shared/components/DataTable";
import { Badge, Button, Tooltip } from "@shared/ui";

import { useCan } from "../hooks/useCan";
import { roleBadgeTone } from "../lib/role-label";

export interface AccessTableProps {
  rows: AccessResponseDto[];
  /** Abre "Editar membro" da linha. */
  onEditMember: (row: AccessResponseDto) => void;
  /**
   * Abre "Inativar membro" (GUS-149 e GUS-147). Enquanto a tela não passar isto, a lixeira não
   * aparece: inativar é diferente de desativar o acesso e ainda não tem modal nem rota.
   */
  onDeactivateMember?: (row: AccessResponseDto) => void;
  /**
   * Abre a ficha do membro (GUS-145). Clicar nos ícones da linha não chama isto. Sem esta prop a
   * linha não é clicável e não ganha o realce de hover.
   */
  onRowClick?: (row: AccessResponseDto) => void;
}

// Realce de linha do Figma: fundo claro (do DataTable) + barra de 3px da cor de ação à esquerda.
const CLICKABLE_ROW_CLASS =
  "hover:shadow-[inset_3px_0_0_var(--accent)] focus-within:shadow-[inset_3px_0_0_var(--accent)]";

export function AccessTable({
  rows,
  onEditMember,
  onDeactivateMember,
  onRowClick,
}: AccessTableProps): ReactElement {
  const { t } = useTranslation(["auth", "common"]);
  // `AccessResponseDto` não traz a flag `canEdit` por linha: sem ela o diretor (escopo "department")
  // não vê o lápis, e a coordenação (escopo "all") vê em todas. A GUS-150 passa a flag por linha.
  const canEdit = useCan("members.edit", { serverGrant: false });
  const canDeactivate = useCan("members.deactivate");

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
      headerClassName: "w-[104px] uppercase",
      render: (row) => (
        // Ícones de 16px dentro de botões de 44px (alvo de toque): o Figma desenha só o ícone.
        <div className="flex gap-1">
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
      tableClassName="table-fixed min-w-[840px]"
      onRowClick={onRowClick}
      rowClassName={onRowClick ? CLICKABLE_ROW_CLASS : undefined}
    />
  );
}
