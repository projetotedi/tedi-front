import type { TFunction } from "i18next";
import type { ReactNode } from "react";

import type { MemberHourEntryResponseDto } from "@api/generated/model";
import type { Column } from "@shared/components/DataTable";
import { formatHours } from "@shared/lib/format";
import { Badge, Checkbox } from "@shared/ui";

import { formatEntryDay } from "../lib/bank-format";
import { CATEGORY_LABEL_KEYS, memberNameOf } from "../lib/bank-labels";

type Entry = MemberHourEntryResponseDto;

/** What the columns of who reviews need: the selection of the page and the actions of each row. */
export interface ReviewColumnsOptions {
  /** The rows of the page that can be selected (the person's own entry cannot). */
  selectable: Entry[];
  /** The selected rows among `selectable`. */
  selectedRows: Entry[];
  canReviewEntry: (entry: Entry) => boolean;
  /** A validation is on its way: the boxes are turned off. */
  isBusy: boolean;
  onSelectAll: (isSelected: boolean) => void;
  onToggle: (entry: Entry, isSelected: boolean) => void;
  renderActions: (entry: Entry) => ReactNode;
}

// The widths of the Figma: with the box and the actions, and, for the director, without them.
const REVIEW_WIDTHS = {
  date: "w-[9%]",
  member: "w-[16%]",
  activity: "w-[26%]",
  category: "w-[14%]",
  hours: "w-[8%]",
};
const READ_WIDTHS = {
  date: "w-[12%]",
  member: "w-[22%]",
  activity: "w-[36%]",
  category: "w-[18%]",
  hours: "w-[12%]",
};

/**
 * The columns of the queue: date, member, activity, category and hours, and, for who reviews
 * (`review`), the box of the batch first and the actions last.
 */
export function pendingEntryColumns(
  t: TFunction<"hours">,
  locale: string,
  review: ReviewColumnsOptions | null,
): Column<Entry>[] {
  const widths = review === null ? READ_WIDTHS : REVIEW_WIDTHS;

  const entryColumns: Column<Entry>[] = [
    {
      header: t("review.date"),
      headerClassName: `${widths.date} uppercase`,
      cellClassName: "whitespace-nowrap",
      render: (row) => formatEntryDay(row.date, locale),
    },
    {
      header: t("review.member"),
      headerClassName: `${widths.member} uppercase`,
      render: (row) =>
        row.member === null ? (
          <span className="text-muted">{memberNameOf(row, t)}</span>
        ) : (
          row.member.name
        ),
    },
    {
      header: t("review.activity"),
      headerClassName: `${widths.activity} uppercase`,
      render: (row) => row.activity,
    },
    {
      header: t("review.category"),
      headerClassName: `${widths.category} uppercase`,
      render: (row) => <Badge tone="info">{t(CATEGORY_LABEL_KEYS[row.category])}</Badge>,
    },
    {
      header: t("review.hours"),
      headerClassName: `${widths.hours} uppercase`,
      render: (row) => formatHours(row.declaredMinutes),
    },
  ];

  if (review === null) return entryColumns;

  const { selectable, selectedRows, canReviewEntry, isBusy } = review;
  const selectedIds = new Set(selectedRows.map((row) => row.id));

  return [
    {
      header: t("review.select"),
      headerClassName: "w-11",
      headerContent: (
        <Checkbox
          isLabelHidden
          label={t("review.selectAll")}
          isSelected={selectable.length > 0 && selectedRows.length === selectable.length}
          isIndeterminate={selectedRows.length > 0 && selectedRows.length < selectable.length}
          isDisabled={selectable.length === 0 || isBusy}
          onChange={review.onSelectAll}
        />
      ),
      render: (row) => (
        <Checkbox
          isLabelHidden
          label={t("review.selectEntry", {
            name: memberNameOf(row, t),
            date: formatEntryDay(row.date, locale),
          })}
          isSelected={selectedIds.has(row.id)}
          isDisabled={!canReviewEntry(row) || isBusy}
          onChange={(isSelected) => review.onToggle(row, isSelected)}
        />
      ),
    },
    ...entryColumns,
    {
      header: t("review.actions"),
      headerClassName: "w-[24%] uppercase",
      render: review.renderActions,
    },
  ];
}
