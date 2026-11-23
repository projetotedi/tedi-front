import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { LessonListItemResponseDto } from "@api/generated/model";
import { Button } from "@shared/ui";

import {
  formatDay,
  formatPeriodTitle,
  groupLessonsByDay,
  monthGridDays,
} from "../lib/calendar-period";
import { CalendarEvent } from "./CalendarEvent";

/** The most events a day of the month shows: the rest are one button, "+N mais", to open the day. */
export const MAX_EVENTS_PER_DAY = 3;

const DAYS_IN_WEEK = 7;

export interface MonthGridProps {
  /** Any day of the month to draw (`YYYY-MM-DD`). */
  anchor: string;
  /** Today (`YYYY-MM-DD`), to mark it. */
  today: string;
  lessons: LessonListItemResponseDto[];
  /** "+N mais" was pressed: the screen opens that day. */
  onShowDay: (day: string) => void;
}

/**
 * The grid of the month: a table of six weeks of seven days, from the first day of the week that
 * holds the 1st, whose caption is the month for a screen reader. Each day has its number (today
 * is marked, with `aria-current="date"`, and the days of the neighbor months are paler, in a color
 * that still makes 4.5:1) and, under it, up to three events (`CalendarEvent`); a day with more has
 * "+N mais", which asks the screen to open that day. The number is read as the full date, not as a
 * bare "10". Below 704px the table scrolls sideways instead of squeezing the days.
 */
export function MonthGrid({ anchor, today, lessons, onShowDay }: MonthGridProps): ReactElement {
  const { t, i18n } = useTranslation("lessons");
  const locale = i18n.language;
  const days = monthGridDays(anchor, locale);
  const byDay = groupLessonsByDay(lessons);
  const month = anchor.slice(0, 7);
  const weeks = Array.from({ length: days.length / DAYS_IN_WEEK }, (_, index) =>
    days.slice(index * DAYS_IN_WEEK, (index + 1) * DAYS_IN_WEEK),
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-176 table-fixed border-collapse">
        <caption className="sr-only">{formatPeriodTitle("month", anchor, locale)}</caption>
        <thead>
          <tr>
            {weeks[0].map((day) => (
              <th
                key={day}
                scope="col"
                className="border border-tedi-divider px-1 py-2 text-xs font-semibold text-muted uppercase"
              >
                <span aria-hidden="true">{formatDay(day, locale, { weekday: "short" })}</span>
                <span className="sr-only">{formatDay(day, locale, { weekday: "long" })}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((day) => {
                const events = byDay.get(day) ?? [];
                const hidden = events.length - MAX_EVENTS_PER_DAY;
                const isToday = day === today;
                const isOutsideMonth = !day.startsWith(month);

                return (
                  <td key={day} className="h-32 border border-tedi-divider p-1 align-top">
                    <div className="flex flex-col gap-1">
                      <span
                        aria-current={isToday ? "date" : undefined}
                        className={`inline-flex size-7 items-center justify-center self-start rounded-full text-sm font-medium ${
                          isToday
                            ? "bg-accent text-accent-foreground"
                            : isOutsideMonth
                              ? "text-muted"
                              : "text-foreground"
                        }`}
                      >
                        <span aria-hidden="true">{Number(day.slice(8))}</span>
                        <span className="sr-only">
                          {formatDay(day, locale, {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          })}
                        </span>
                      </span>
                      {events.length > 0 ? (
                        <ul className="flex flex-col gap-1">
                          {events.slice(0, MAX_EVENTS_PER_DAY).map((lesson) => (
                            <li key={lesson.id}>
                              <CalendarEvent lesson={lesson} />
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {hidden > 0 ? (
                        <Button
                          variant="ghost"
                          className="justify-start px-2"
                          aria-label={t("calendar.moreLabel", {
                            count: hidden,
                            date: formatDay(day, locale, { day: "numeric", month: "long" }),
                          })}
                          onPress={() => onShowDay(day)}
                        >
                          {t("calendar.more", { count: hidden })}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
