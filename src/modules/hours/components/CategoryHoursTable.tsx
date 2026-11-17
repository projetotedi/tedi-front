import type { ReactElement, Ref } from "react";
import { useTranslation } from "react-i18next";

import type { HoursCategoryTotalDto, HoursSummaryResponseDto } from "@api/generated/model";
import { DataTable, type Column } from "@shared/components/DataTable";
import { ListState } from "@shared/components/ListState";
import { formatHours } from "@shared/lib/format";
import { Card } from "@shared/ui";

import { CATEGORY_LABEL_KEYS, CATEGORY_ORDER } from "../lib/bank-labels";
import { PendingHours } from "./PendingHours";

export interface CategoryHoursTableProps {
  summary: HoursSummaryResponseDto | undefined;
  isLoading: boolean;
  /** The title of the card, which takes the focus when the view of the member opens. */
  titleRef: Ref<HTMLSpanElement>;
}

/**
 * "Horas por categoria do membro": the hours and the pending hours of each category the member has
 * entries in, in the order of the contract. The column Observação of the Figma is out until the API
 * sends its text (GUS-173); the three columns keep the places of the Figma.
 */
export function CategoryHoursTable({
  summary,
  isLoading,
  titleRef,
}: CategoryHoursTableProps): ReactElement {
  const { t } = useTranslation("hours");
  const rows = (summary?.byCategory ?? [])
    .filter((row) => row.entries > 0)
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));

  const columns: Column<HoursCategoryTotalDto>[] = [
    {
      header: t("bank.categories.category"),
      headerClassName: "w-[22%] uppercase",
      render: (row) => t(CATEGORY_LABEL_KEYS[row.category]),
    },
    {
      header: t("bank.categories.hours"),
      headerClassName: "w-[13%] uppercase",
      render: (row) => formatHours(row.declaredMinutes),
    },
    {
      header: t("bank.categories.pending"),
      headerClassName: "uppercase",
      render: (row) => <PendingHours minutes={row.pendingMinutes} />,
    },
  ];

  return (
    <Card
      className="rounded-3xl"
      title={
        <span ref={titleRef} tabIndex={-1} className="outline-none">
          {t("bank.categories.title")}
        </span>
      }
    >
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.category}
        caption={t("bank.categories.caption")}
        tableClassName="table-fixed min-w-140"
      />
      {isLoading ? <ListState variant="loading" title={t("bank.categories.loading")} /> : null}
      {!isLoading && rows.length === 0 ? (
        <ListState variant="empty" title={t("bank.categories.empty")} />
      ) : null}
    </Card>
  );
}
