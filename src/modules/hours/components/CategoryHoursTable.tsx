import { useState, type ReactElement, type Ref } from "react";
import { useTranslation } from "react-i18next";

import type { HoursCategoryTotalDto, HoursSummaryResponseDto } from "@api/generated/model";
import { DataTable, type Column } from "@shared/components/DataTable";
import { ListState } from "@shared/components/ListState";
import { formatHours } from "@shared/lib/format";
import { Button, Card } from "@shared/ui";

import { useReviewPermission } from "../hooks/useReviewPermission";
import { CATEGORY_LABEL_KEYS, CATEGORY_ORDER } from "../lib/bank-labels";
import { CategoryNoteDialog } from "./CategoryNoteDialog";
import { PendingHours } from "./PendingHours";

export interface CategoryHoursTableProps {
  personId: string;
  summary: HoursSummaryResponseDto | undefined;
  isLoading: boolean;
  /** The title of the card, which takes the focus when the view of the member opens. */
  titleRef: Ref<HTMLSpanElement>;
}

// The rows have no buttons: the 16px above and below give the 56px rows of the Figma (the default of
// the table, 10px, gives 44px).
const CELL_CLASS = "py-4";

/**
 * "Horas por categoria do membro": the hours and the pending hours of each category the member has
 * entries or an observation in, in the order of the contract. Who reviews hours edits the
 * observation (GUS-173).
 */
export function CategoryHoursTable({
  personId,
  summary,
  isLoading,
  titleRef,
}: CategoryHoursTableProps): ReactElement {
  const { t } = useTranslation("hours");
  const { canReview } = useReviewPermission();
  const [editing, setEditing] = useState<HoursCategoryTotalDto | null>(null);
  const rows = (summary?.byCategory ?? [])
    .filter((row) => row.entries > 0 || row.note !== null)
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));

  const columns: Column<HoursCategoryTotalDto>[] = [
    {
      header: t("bank.categories.category"),
      headerClassName: "w-[22%] uppercase",
      cellClassName: CELL_CLASS,
      render: (row) => t(CATEGORY_LABEL_KEYS[row.category]),
    },
    {
      header: t("bank.categories.hours"),
      headerClassName: "w-[13%] uppercase",
      cellClassName: CELL_CLASS,
      render: (row) => formatHours(row.declaredMinutes),
    },
    {
      header: t("bank.categories.pending"),
      headerClassName: "w-[20%] uppercase",
      cellClassName: CELL_CLASS,
      render: (row) => <PendingHours minutes={row.pendingMinutes} />,
    },
    {
      header: t("bank.categories.note"),
      headerClassName: "uppercase",
      cellClassName: `${CELL_CLASS} break-words whitespace-pre-line`,
      render: (row) =>
        row.note ?? (
          <>
            <span aria-hidden="true">—</span>
            <span className="sr-only">{t("bank.categories.noNote")}</span>
          </>
        ),
    },
  ];

  if (canReview) {
    columns.push({
      header: t("bank.categories.actions"),
      headerClassName: "w-[15%] uppercase",
      cellClassName: "py-1.5",
      render: (row) => (
        <Button
          variant="secondary"
          aria-label={t("bank.categories.editNoteLabel", {
            category: t(CATEGORY_LABEL_KEYS[row.category]),
          })}
          onPress={() => setEditing(row)}
        >
          {t("bank.categories.editNote")}
        </Button>
      ),
    });
  }

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
        tableClassName="table-fixed min-w-180"
      />
      {isLoading ? <ListState variant="loading" title={t("bank.categories.loading")} /> : null}
      {!isLoading && rows.length === 0 ? (
        <ListState variant="empty" title={t("bank.categories.empty")} />
      ) : null}
      {editing !== null ? (
        <CategoryNoteDialog personId={personId} total={editing} onClose={() => setEditing(null)} />
      ) : null}
    </Card>
  );
}
