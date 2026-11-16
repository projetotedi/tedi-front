const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A date of the API (`format: date`, `YYYY-MM-DD`, with no time zone) in the short form of the
 * locale: "03/03/2026" in pt-BR. `new Date("2026-03-03")` is midnight UTC and would fall on the
 * previous day in Brazil, so the parts are read as a local date. A value that is not a calendar
 * date is returned as it came: a screen that shows it is better than one that does not open.
 */
export function formatCalendarDate(value: string, locale: string): string {
  const parts = CALENDAR_DATE.exec(value);
  if (parts === null) return value;

  const [year, month, day] = parts.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  // `Date` carries an impossible day over to the next month ("2026-02-31" is March 3rd).
  const isCalendarDate =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  if (!isCalendarDate) return value;

  return new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(date);
}

/**
 * The day of a real instant (`format: date-time`, such as `2026-10-01T13:00:00.000Z`) in the short
 * form of the locale. Without `timeZone` it is the day in the browser's time zone, which matters
 * because the API sends UTC.
 */
export function formatInstantDate(value: string, locale: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeZone }).format(new Date(value));
}

/** A fraction from 0 to 1 as a whole percentage: 0.89 becomes "89%". */
export function formatPercent(fraction: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(
    fraction,
  );
}
