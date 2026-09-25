import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { AccessResponseDto } from "@api/generated/model";
import { DataTable, type Column } from "@shared/components/DataTable";
import { Badge } from "@shared/ui";

import { roleBadgeTone, roleLabelKey } from "../lib/role-label";

export interface AccessTableProps {
  rows: AccessResponseDto[];
}

/**
 * Tabela de membros com acesso ao TEDI, com as seis colunas do Figma. Só apresenta as linhas
 * que recebe: busca, filtros, paginação e estados de carga ficam na `AccessPage`.
 *
 * Membro, Papel e Status vêm da API. Departamentos e Função principal não existem no back
 * (ficam vazias) e Ações é da GUS-88 (também vazia); as colunas existem para manter a grade do
 * desenho.
 *
 * Larguras: as do Figma (235, 147, 279, 279, 132, 73) mais o respiro de 10px de cada lado das
 * células internas, com a última coluna sem largura para absorver a folga à direita, como no
 * desenho. `min-w-[1245px]` é a largura total do Figma; abaixo dela a tabela rola na horizontal.
 */
export function AccessTable({ rows }: AccessTableProps): ReactElement {
  const { t } = useTranslation("auth");

  const columns: Column<AccessResponseDto>[] = [
    {
      header: t("access.people.columns.member"),
      headerClassName: "w-[245px] uppercase",
      render: (row) => row.name,
    },
    {
      header: t("access.people.columns.role"),
      headerClassName: "w-[167px] uppercase",
      render: (row) => {
        const key = roleLabelKey(row.role);
        return key ? <Badge tone={roleBadgeTone(row.role)}>{t(key)}</Badge> : null;
      },
    },
    {
      header: t("access.people.columns.departments"),
      // Sem `uppercase`: no Figma este cabeçalho está em caixa normal (mantido idêntico).
      headerClassName: "w-[299px]",
      render: () => null,
    },
    {
      header: t("access.people.columns.mainFunction"),
      headerClassName: "w-[299px] uppercase",
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
      tableClassName="table-fixed min-w-[1245px]"
    />
  );
}
