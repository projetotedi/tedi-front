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

/** Today in the time zone of the project (America/Sao_Paulo), as `YYYY-MM-DD`. `now` is for the tests. */
export function todayCalendarDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}
