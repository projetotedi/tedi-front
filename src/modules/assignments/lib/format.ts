/** The separator of the meta lines ("Informática Básica — A · 31/03 (ter) · 09:00–11:00"). */
export const META_SEPARATOR = " · ";

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The parts of a date of the API (`YYYY-MM-DD`, no time zone) as a local date, or `null` when it is
 * not a calendar date. `new Date("2026-03-17")` is midnight UTC and would fall on the previous day
 * in Brazil, so the parts are read as a local date; `Date` carries an impossible day over to the
 * next month ("2026-02-31" is March 3rd), which is checked here.
 */
function parseCalendarDate(value: string): Date | null {
  const parts = CALENDAR_DATE.exec(value);
  if (parts === null) return null;

  const [year, month, day] = parts.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  const isCalendarDate =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;

  return isCalendarDate ? date : null;
}

/**
 * The day of a lesson as the Figma shows it: day and month with the weekday in short form, "17/03
 * (ter)" in pt-BR and "03/17 (Tue)" in en-US. The locale of the browser decides the period the
 * short weekday ends with ("ter."), which is dropped. A value that is not a calendar date is
 * returned as it came: a screen that shows it is better than one that does not open.
 */
export function formatLessonDay(date: string, locale: string): string {
  const parsed = parseCalendarDate(date);
  if (parsed === null) return date;

  const dayAndMonth = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(
    parsed,
  );
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" })
    .format(parsed)
    .replace(/\.$/, "");

  return `${dayAndMonth} (${weekday})`;
}

/**
 * The day an application was sent, from the instant the API answers (`createdAt`, ISO 8601 with
 * the offset), as day and month: "20/03". The day is the one of the person who looks at it, in the
 * time zone of the browser, unless a zone is given. A value that is not an instant is returned as
 * it came.
 */
export function formatSentDate(instant: string, locale: string, timeZone?: string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return instant;

  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", timeZone }).format(
    date,
  );
}
