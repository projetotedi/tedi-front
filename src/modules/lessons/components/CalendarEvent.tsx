import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { LessonStatus, type LessonListItemResponseDto } from "@api/generated/model";

import { calendarEventClasses } from "../lib/calendar-colors";
import { lessonDetailPath } from "../lib/lesson-paths";
import { LESSON_STATUS_LABEL_KEYS } from "../lib/lesson-status";

export interface CalendarEventProps {
  lesson: LessonListItemResponseDto;
  /** Shows the name of the class under the title: the week and the agenda have room for it, the cell of the month does not. */
  showClass?: boolean;
}

/**
 * One lesson on the calendar: a link to its screen, in the color of its class (`class.colorIndex`),
 * with the time and the title. It is named by all it says (time, title, class and status), since
 * the color alone says nothing to a screen reader, and the status is never only a color either: a
 * cancelled lesson is struck through and carries the word "Cancelada". The block is 44px high at
 * least, the target of the touch, and shows a ring when it has the focus. Everything in it is 14px
 * (`text-sm`), the name of the class and the word "Cancelada" included: nothing smaller, and the
 * 100px of a day of the month, which is the narrowest place it goes, still holds "Cancelada".
 */
export function CalendarEvent({ lesson, showClass = false }: CalendarEventProps): ReactElement {
  const { t } = useTranslation("lessons");
  const isCancelled = lesson.status === LessonStatus.cancelled;
  const time = t("classLessons.timeRange", { start: lesson.startTime, end: lesson.endTime });

  return (
    <Link
      to={lessonDetailPath(lesson.id)}
      aria-label={t("calendar.eventLabel", {
        time,
        title: lesson.title,
        className: lesson.class.name,
        status: t(LESSON_STATUS_LABEL_KEYS[lesson.status]),
      })}
      className={`flex min-h-11 flex-col gap-0.5 rounded-md px-2 py-1 text-sm leading-snug outline-hidden hover:brightness-95 focus-visible:ring-3 focus-visible:ring-focus ${calendarEventClasses(lesson.class.colorIndex)}`}
    >
      <span className="font-semibold">{time}</span>
      <span className={`break-words ${isCancelled ? "line-through" : ""}`.trim()}>
        {lesson.title}
      </span>
      {showClass ? <span className="text-sm break-words">{lesson.class.name}</span> : null}
      {isCancelled ? (
        <span className="text-sm font-semibold">{t("calendar.cancelledTag")}</span>
      ) : null}
    </Link>
  );
}
