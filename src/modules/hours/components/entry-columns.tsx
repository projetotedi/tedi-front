import type { TFunction } from "i18next";

import { HourEntryStatus, type HourEntryResponseDto } from "@api/generated/model";
import type { Column } from "@shared/components/DataTable";
import { formatHours } from "@shared/lib/format";

import { formatDayMonth } from "../lib/entry-format";
import { ENTRY_CATEGORY_LABEL_KEYS } from "../lib/entry-labels";
import { EntryLinkNote } from "./EntryLinkNote";
import { EntryStatusTag } from "./EntryStatusTag";

/** The width of each column, as a class (the measures of the Figma over the width of the table). */
export interface EntryColumnWidths {
  date: string;
  activity: string;
  category: string;
  declared: string;
  validated: string;
  status: string;
}

export interface EntryColumnsOptions {
  widths: EntryColumnWidths;
  /** Shows, under the activity of an adjusted or rejected entry, what the coordination wrote. */
  withReviewNote: boolean;
}

/**
 * The statuses whose entry carries the note of the coordination (the justification of an adjustment,
 * the reason of a rejection), with its color: the yellow of Ajustado and the red of Rejeitado.
 */
const REVIEW_NOTE_CLASSES = {
  [HourEntryStatus.adjusted]: "text-tedi-status-warning-foreground",
  [HourEntryStatus.rejected]: "text-tedi-status-danger-foreground",
} as const;

type ReviewNoteStatus = keyof typeof REVIEW_NOTE_CLASSES;

function hasReviewNote(status: HourEntryStatus): status is ReviewNoteStatus {
  return status === HourEntryStatus.adjusted || status === HourEntryStatus.rejected;
}

/** The headers are in capitals by CSS; the text in the locale stays "Data", "Atividade"… */
function headerClass(width: string): string {
  return `uppercase ${width}`.trim();
}

/**
 * The columns of a list of the person's entries: Data, Atividade, Categoria, Declarado, Validado and
 * Status. The hours are always in the format of the TEDI ("2h30"); a time that was not validated yet
 * is a dash a screen reader reads as "Não informado", and a rejected entry is validated with "0h".
 * Under the activity goes its link (`EntryLinkNote`, GUS-174), with the tag "Aula cancelada".
 * With `withReviewNote`, the justification of an adjustment or the reason of a rejection goes under
 * the activity, in quotes ("Ajustado pela coordenação: “…”").
 */
export function entryColumns(
  t: TFunction<"hours">,
  locale: string,
  { widths, withReviewNote }: EntryColumnsOptions,
): Column<HourEntryResponseDto>[] {
  function reviewNote(entry: HourEntryResponseDto) {
    const { status, reviewNote: note } = entry;
    // The API sends a note only with these statuses; one that comes with another is not shown.
    if (!withReviewNote || note === null || !hasReviewNote(status)) return null;

    return (
      <span className={`mt-0.5 block text-sm ${REVIEW_NOTE_CLASSES[status]}`}>
        {t(`myEntries.reviewNote.${status}`, { note })}
      </span>
    );
  }

  return [
    {
      header: t("entries.columns.date"),
      headerClassName: headerClass(widths.date),
      cellClassName: "whitespace-nowrap",
      render: (entry) => formatDayMonth(entry.date, locale),
    },
    {
      header: t("entries.columns.activity"),
      headerClassName: headerClass(widths.activity),
      render: (entry) => (
        <>
          <span className="block">{entry.activity}</span>
          <EntryLinkNote entry={entry} />
          {reviewNote(entry)}
        </>
      ),
    },
    {
      header: t("entries.columns.category"),
      headerClassName: headerClass(widths.category),
      render: (entry) => t(ENTRY_CATEGORY_LABEL_KEYS[entry.category]),
    },
    {
      header: t("entries.columns.declared"),
      headerClassName: headerClass(widths.declared),
      cellClassName: "whitespace-nowrap",
      render: (entry) => formatHours(entry.declaredMinutes),
    },
    {
      header: t("entries.columns.validated"),
      headerClassName: headerClass(widths.validated),
      cellClassName: "whitespace-nowrap",
      render: (entry) =>
        entry.validatedMinutes === null ? (
          <>
            <span aria-hidden="true">{t("details.empty", { ns: "common" })}</span>
            <span className="sr-only">{t("details.notInformed", { ns: "common" })}</span>
          </>
        ) : (
          formatHours(entry.validatedMinutes)
        ),
    },
    {
      header: t("entries.columns.status"),
      headerClassName: headerClass(widths.status),
      cellClassName: "whitespace-nowrap",
      render: (entry) => <EntryStatusTag status={entry.status} />,
    },
  ];
}
