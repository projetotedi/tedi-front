import type { TFunction } from "i18next";

import type { HourEntryResponseDto } from "@api/generated/model";
import type { Column } from "@shared/components/DataTable";
import { formatHours } from "@shared/lib/format";

import { formatDayMonth } from "../lib/entry-format";
import { ENTRY_CATEGORY_LABEL_KEYS } from "../lib/entry-labels";
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
}

/** The headers are in capitals by CSS; the text in the locale stays "Data", "Atividade"… */
function headerClass(width: string): string {
  return `uppercase ${width}`.trim();
}

/**
 * The columns of a list of the person's entries: Data, Atividade, Categoria, Declarado, Validado and
 * Status. The hours are always in the format of the TEDI ("2h30"); a time that was not validated yet
 * is a dash a screen reader reads as "Não informado", and a rejected entry is validated with "0h".
 */
export function entryColumns(
  t: TFunction<"hours">,
  locale: string,
  { widths }: EntryColumnsOptions,
): Column<HourEntryResponseDto>[] {
  return [
    {
      header: t("entries.recent.columns.date"),
      headerClassName: headerClass(widths.date),
      cellClassName: "whitespace-nowrap",
      render: (entry) => formatDayMonth(entry.date, locale),
    },
    {
      header: t("entries.recent.columns.activity"),
      headerClassName: headerClass(widths.activity),
      render: (entry) => <span className="block">{entry.activity}</span>,
    },
    {
      header: t("entries.recent.columns.category"),
      headerClassName: headerClass(widths.category),
      render: (entry) => t(ENTRY_CATEGORY_LABEL_KEYS[entry.category]),
    },
    {
      header: t("entries.recent.columns.declared"),
      headerClassName: headerClass(widths.declared),
      cellClassName: "whitespace-nowrap",
      render: (entry) => formatHours(entry.declaredMinutes),
    },
    {
      header: t("entries.recent.columns.validated"),
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
      header: t("entries.recent.columns.status"),
      headerClassName: headerClass(widths.status),
      cellClassName: "whitespace-nowrap",
      render: (entry) => <EntryStatusTag status={entry.status} />,
    },
  ];
}
