import type { LessonResponseDto } from "@api/generated/model";
import { formatCalendarDate } from "@shared/lib/format";

const PROJECT_TIME_ZONE = "America/Sao_Paulo";

export function projectDateOf(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PROJECT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function formatSignedAt(instant: string, lessonDate: string, locale: string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return instant;

  const time = new Intl.DateTimeFormat(locale, {
    timeZone: PROJECT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const day = projectDateOf(date);

  return day === lessonDate ? time : `${formatCalendarDate(day, locale)}, ${time}`;
}

export function formatLessonSummary(
  lesson: Pick<LessonResponseDto, "date" | "title" | "startTime" | "endTime">,
  locale: string,
): string {
  return [
    formatCalendarDate(lesson.date, locale),
    lesson.title,
    `${lesson.startTime}–${lesson.endTime}`,
  ].join(" · ");
}
