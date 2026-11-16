export { formatCalendarDate } from "@shared/lib/format";

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
