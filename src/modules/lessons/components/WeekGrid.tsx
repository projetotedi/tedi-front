import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { LessonListItemResponseDto } from "@api/generated/model";

import { formatDay, formatPeriodTitle, groupLessonsByDay, weekDays } from "../lib/calendar-period";
import { CalendarEvent } from "./CalendarEvent";

export interface WeekGridProps {
  /** Any day of the week to draw (`YYYY-MM-DD`). */
  anchor: string;
  /** Today (`YYYY-MM-DD`), to mark it. */
  today: string;
  lessons: LessonListItemResponseDto[];
}

/**
 * The week: one column for each of its seven days, from the first day of the week, each with the
 * weekday and the number of the day (today is marked, with `aria-current="date"`) and its lessons in
 * the order they start, with the name of the class (`CalendarEvent`). There is no ruler of hours:
 * the events are read in order, which is simpler to follow than a position on a scale. It is a list
 * of days, named by the dates of the week, so a screen reader goes day by day. Below 768px the
 * columns become one list, one day under the other, and the days with no lesson are left out of it.
 */
export function WeekGrid({ anchor, today, lessons }: WeekGridProps): ReactElement {
  const { i18n } = useTranslation("lessons");
  const locale = i18n.language;
  const byDay = groupLessonsByDay(lessons);

  return (
    <ol
      aria-label={formatPeriodTitle("week", anchor, locale)}
      className="grid grid-cols-1 gap-3 md:grid-cols-7 md:gap-0"
    >
      {weekDays(anchor, locale).map((day) => {
        const events = byDay.get(day) ?? [];

        return (
          <li
            key={day}
            className={`min-w-0 flex-col gap-2 md:flex md:min-h-60 md:border md:border-tedi-divider md:p-2 ${
              events.length === 0 ? "hidden" : "flex"
            }`}
          >
            <h3 className="flex items-center gap-1.5 text-sm font-medium text-muted">
              <span aria-hidden="true" className="uppercase">
                {formatDay(day, locale, { weekday: "short" })}
              </span>
              <span
                aria-current={day === today ? "date" : undefined}
                className={`inline-flex size-7 items-center justify-center rounded-full text-sm font-medium ${
                  day === today ? "bg-accent text-accent-foreground" : "text-foreground"
                }`}
              >
                <span aria-hidden="true">{Number(day.slice(8))}</span>
              </span>
              <span className="sr-only">
                {formatDay(day, locale, { weekday: "long", day: "numeric", month: "long" })}
              </span>
            </h3>
            {events.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {events.map((lesson) => (
                  <li key={lesson.id}>
                    <CalendarEvent lesson={lesson} showClass />
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
