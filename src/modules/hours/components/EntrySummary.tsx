import type { TFunction } from "i18next";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { HourEntryOrigin, type MemberHourEntryResponseDto } from "@api/generated/model";

import { formatEntryDay, formatInstantDay } from "../lib/bank-format";
import { CATEGORY_LABEL_KEYS } from "../lib/bank-labels";

export interface EntrySummaryProps {
  entry: MemberHourEntryResponseDto;
  /** The third line: who logged it and the status, or the current status in the history. */
  detail: string;
}

/**
 * The box at the top of Ajustar, Rejeitar and Histórico: who, which category and which day, the
 * activity, and a line of detail.
 */
export function EntrySummary({ entry, detail }: EntrySummaryProps): ReactElement {
  const { t, i18n } = useTranslation("hours");

  return (
    // The body of the dialog is `text-muted`: the box takes the foreground color.
    <div className="flex flex-col gap-1.5 rounded-xl bg-tedi-surface-subtle px-4 py-3.5 text-foreground">
      <p className="text-base font-semibold">
        {t("review.entrySummary.line", {
          name: entry.member?.name ?? t("bank.members.removed"),
          category: t(CATEGORY_LABEL_KEYS[entry.category]),
          date: formatEntryDay(entry.date, i18n.language),
        })}
      </p>
      <p className="text-base">{entry.activity}</p>
      <p className="text-sm text-muted">{detail}</p>
    </div>
  );
}

/**
 * Who logged the entry and when (`createdAt`, in the time zone of the browser): the member herself,
 * someone on her behalf (the DTO has no name for who did it), or the attendance of a lesson.
 */
export function loggedByText(
  entry: MemberHourEntryResponseDto,
  t: TFunction<"hours">,
  locale: string,
): string {
  const date = formatInstantDay(entry.createdAt, locale);

  switch (entry.origin) {
    case HourEntryOrigin.manual:
      return t("review.entrySummary.loggedBySelf", { date });
    case HourEntryOrigin.on_behalf:
      return t("review.entrySummary.loggedOnBehalf", { date });
    case HourEntryOrigin.attendance:
      return t("review.entrySummary.loggedByAttendance", { date });
    default: {
      const exhaustive: never = entry.origin;
      return exhaustive;
    }
  }
}
