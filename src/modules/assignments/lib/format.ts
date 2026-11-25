/** The separator of the meta lines ("Informática Básica — A · 31/03 (ter) · 09:00–11:00"). */
export const META_SEPARATOR = " · ";

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The parts of a date of the API (`format: date`, `YYYY-MM-DD`, no time zone) as a local date, or
 * `null` when it is not a calendar date. `new Date("2026-03-10")` is midnight UTC and would fall on
 * the previous day in Brazil, so the parts are read as a local date; `Date` carries an impossible
 * day over to the next month ("2026-02-31" is March 3rd), which is checked here.
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

function formatDayAndMonth(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(date);
}

/**
 * The day and the month of a date of the API, in the order of the locale: "10/03" in pt-BR for
 * 2026-03-10. It is the form the cards of the allocations use (the Figma shows "10/03", with no
 * year, because an allocation is read next to the lesson it is for), and the one the toast of an
 * application says the day with. A value that is not a calendar date is returned as it came, the
 * same rule as `formatCalendarDate`: a screen that shows it is better than one that does not open.
 */
export function formatDayMonth(value: string, locale: string): string {
  const parsed = parseCalendarDate(value);
  return parsed === null ? value : formatDayAndMonth(parsed, locale);
}

/**
 * The day of a lesson as "Minhas aulas" shows it: day and month with the weekday in short form,
 * "17/03 (ter)" in pt-BR and "03/17 (Tue)" in en-US. The locale of the browser decides the period
 * the short weekday ends with ("ter."), which is dropped. A value that is not a calendar date is
 * returned as it came.
 */
export function formatLessonDay(date: string, locale: string): string {
  const parsed = parseCalendarDate(date);
  if (parsed === null) return date;

  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" })
    .format(parsed)
    .replace(/\.$/, "");

  return `${formatDayAndMonth(parsed, locale)} (${weekday})`;
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

/**
 * Today as a date of the API (`YYYY-MM-DD`), on the calendar of the machine of the person: the
 * lessons "from today on" are the ones from the day the person is looking at, not from the day it
 * already is in UTC. `now` is a parameter so a test does not depend on the clock.
 */
export function todayIsoDate(now: Date = new Date()): string {
  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
