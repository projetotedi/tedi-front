import { useState, type ReactElement, type Ref } from "react";
import { useTranslation } from "react-i18next";

import type { HoursCategoryTotalDto, HoursSummaryResponseDto } from "@api/generated/model";
import { useCan } from "@modules/auth";
import { DataTable, type Column } from "@shared/components/DataTable";
import { ListState } from "@shared/components/ListState";
import { formatHours } from "@shared/lib/format";
import { Button, Card } from "@shared/ui";

import { CATEGORY_LABEL_KEYS, CATEGORY_ORDER } from "../lib/bank-labels";
import { CategoryNoteText } from "./CategoryNoteText";
import { EditCategoryNoteDialog } from "./EditCategoryNoteDialog";
import { PendingHours } from "./PendingHours";

export interface CategoryHoursTableProps {
  summary: HoursSummaryResponseDto | undefined;
  isLoading: boolean;
  /** The title of the card, which takes the focus when the view of the member opens. */
  titleRef: Ref<HTMLSpanElement>;
  /** The member whose hours these are: the person the observations are written about. */
  memberId: string;
  /** Her name, said by the dialog of the observation; `undefined` while it is not known. */
  memberName: string | undefined;
}

// The rows have 56px, as in the Figma. Without the button, the 16px above and below give it (the
// default of the table, 10px, gives 44px). With the button, 44px high, the cell takes 6px. The `!` is
// there because the default of the table, `py-2.5`, comes later in the CSS than `py-1.5` and would
// win: the row would be 64px.
const CELL_CLASS = { plain: "py-4", withButton: "py-1.5!" } as const;

/**
 * "Horas por categoria do membro": the hours, the pending hours and the observation of the
 * coordination of each category the member has entries or an observation in, in the order of the
 * contract. A category with an observation and no entry in the period stays, with 0h: the
 * observation is not tied to the period (GUS-191, D2).
 *
 * Who reviews hours (`hours.review` over this member: the coordination, never on her own hours) also
 * gets "Adicionar" or "Editar" in the cell Observação, which opens the dialog of the observation of
 * that category. The director sees the column without the button.
 */
export function CategoryHoursTable({
  summary,
  isLoading,
  titleRef,
  memberId,
  memberName,
}: CategoryHoursTableProps): ReactElement {
  const { t } = useTranslation("hours");
  const canEditNotes = useCan("hours.review", { personId: memberId });
  const [editing, setEditing] = useState<HoursCategoryTotalDto | null>(null);
  const cellClass = canEditNotes ? CELL_CLASS.withButton : CELL_CLASS.plain;
  const rows = (summary?.byCategory ?? [])
    .filter((row) => row.entries > 0 || row.note !== null)
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));

  const columns: Column<HoursCategoryTotalDto>[] = [
    {
      header: t("bank.categories.category"),
      headerClassName: "w-[22%] uppercase",
      cellClassName: cellClass,
      render: (row) => t(CATEGORY_LABEL_KEYS[row.category]),
    },
    {
      header: t("bank.categories.hours"),
      headerClassName: "w-[13%] uppercase",
      cellClassName: cellClass,
      render: (row) => formatHours(row.declaredMinutes),
    },
    {
      header: t("bank.categories.pending"),
      headerClassName: "w-[13%] uppercase",
      cellClassName: cellClass,
      render: (row) => <PendingHours minutes={row.pendingMinutes} />,
    },
    {
      header: t("bank.categories.note"),
      headerClassName: "uppercase",
      cellClassName: cellClass,
      render: (row) => (
        <div className="flex items-center justify-between gap-3">
          <CategoryNoteText note={row.note} />
          {canEditNotes ? (
            <Button
              variant="ghost"
              aria-label={t(
                row.note === null
                  ? "bank.categories.addNoteLabel"
                  : "bank.categories.editNoteLabel",
                { category: t(CATEGORY_LABEL_KEYS[row.category]) },
              )}
              onPress={() => setEditing(row)}
            >
              {t(row.note === null ? "bank.categories.addNote" : "bank.categories.editNote")}
            </Button>
          ) : null}
        </div>
      ),
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
        tableClassName="table-fixed min-w-180"
      />
      {isLoading ? <ListState variant="loading" title={t("bank.categories.loading")} /> : null}
      {!isLoading && rows.length === 0 ? (
        <ListState variant="empty" title={t("bank.categories.empty")} />
      ) : null}
      {editing === null ? null : (
        <EditCategoryNoteDialog
          memberId={memberId}
          memberName={memberName}
          category={editing.category}
          note={editing.note}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}
