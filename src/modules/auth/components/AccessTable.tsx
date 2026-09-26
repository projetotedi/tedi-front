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
 * Larguras a partir de `3xl` (1800px, onde o frame de 1920px cabe): as do Figma (235, 147, 279,
 * 279, 132, 73) mais o respiro de 10px de cada lado das células internas, com a última coluna
 * sem largura para absorver a folga à direita, como no desenho (tabela de 1245px). Abaixo de
 * `3xl` as colunas vazias (Departamentos e Função principal) perdem a largura fixa e dividem o
 * que sobra com Ações; sem isso a coluna Status ficaria fora da tela em notebooks e com zoom.
 * A tabela só rola na horizontal abaixo de 900px.
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
      headerClassName: "3xl:w-[299px]",
      render: () => null,
    },
    {
      header: t("access.people.columns.mainFunction"),
      headerClassName: "uppercase 3xl:w-[299px]",
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
      tableClassName="table-fixed min-w-[900px] 3xl:min-w-[1245px]"
    />
  );
}
