import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { LessonListItemResponseDto } from "@api/generated/model";

import { formatDay, groupLessonsByDay } from "../lib/calendar-period";
import { CalendarEvent } from "./CalendarEvent";

export interface CalendarAgendaProps {
  /** The days the agenda goes through (`YYYY-MM-DD`), in order: the days of the month. */
  days: string[];
  lessons: LessonListItemResponseDto[];
}

/**
 * The agenda of the month, the "Lista" of the calendar: only the days that have a lesson, in order,
 * each one a heading with the full date and, under it, its lessons in the order they start, with the
 * name of the class (`CalendarEvent`). It draws nothing when no day of `days` has a lesson: the
 * screen says that the period is empty.
 */
export function CalendarAgenda({ days, lessons }: CalendarAgendaProps): ReactElement | null {
  const { i18n } = useTranslation("lessons");
  const byDay = groupLessonsByDay(lessons);
  const daysWithLessons = days.filter((day) => byDay.has(day));

  if (daysWithLessons.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {daysWithLessons.map((day) => (
        <section key={day} aria-labelledby={`agenda-day-${day}`}>
          <h3
            id={`agenda-day-${day}`}
            className="mb-2 text-base font-semibold first-letter:uppercase"
          >
            {formatDay(day, i18n.language, { weekday: "long", day: "numeric", month: "long" })}
          </h3>
          <ul className="flex flex-col gap-2">
            {(byDay.get(day) ?? []).map((lesson) => (
              <li key={lesson.id}>
                <CalendarEvent lesson={lesson} showClass />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
