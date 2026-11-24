/** The separator of the parts of a line ("Beatriz Nunes · Planejamento · 14/03"). */
export const SUMMARY_SEPARATOR = " · ";

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The day and the month of the day of an entry (`YYYY-MM-DD`, no time zone), in the order of the
 * locale: "05/03" in pt-BR. `new Date("2026-03-05")` is midnight UTC and would fall on the previous
 * day in Brazil, so the parts are read as a local date; `Date` carries an impossible day over to the
 * next month, which is checked. A value that is not a calendar date is returned as it came (the same
 * rule as `formatDayMonth` of the assignments module, which a module cannot import).
 */
export function formatEntryDay(value: string, locale: string): string {
  const parts = CALENDAR_DATE.exec(value);
  if (parts === null) return value;

  const [year, month, day] = parts.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  const isCalendarDate =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  if (!isCalendarDate) return value;

  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(date);
}

/**
 * The day and the month of an instant of the API (ISO 8601 with the offset), in the time zone of the
 * browser: "14/03" for 2026-03-14T21:42:00Z in Brazil. A value that is not an instant is returned as
 * it came.
 */
export function formatInstantDay(instant: string, locale: string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return instant;

  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(date);
}

/** The hour and the minutes of an instant, in the time zone of the browser: "18:42". */
export function formatInstantTime(instant: string, locale: string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return instant;

  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}
