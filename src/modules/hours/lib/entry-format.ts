const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A date of the API (`format: date`, `YYYY-MM-DD`, no time zone) as a local date, or `null` when it
 * is not a calendar date. `new Date("2026-03-10")` is midnight UTC and would fall on the previous day
 * in Brazil, so the parts are read as a local date; `Date` carries an impossible day over to the next
 * month ("2026-02-31" is March 3rd), which is checked here.
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

function toIsoDate(year: number, monthIndex: number, day: number): string {
  return [
    String(year).padStart(4, "0"),
    String(monthIndex + 1).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

/** Whether `value` is a day that exists, written as the API writes it (`YYYY-MM-DD`). */
export function isCalendarDate(value: string): boolean {
  return parseCalendarDate(value) !== null;
}

/**
 * The day and the month of a date of the API, in the order of the locale: "14/03" in pt-BR. A value
 * that is not a calendar date is returned as it came: a screen that shows it is better than one that
 * does not open.
 */
export function formatDayMonth(value: string, locale: string): string {
  const date = parseCalendarDate(value);
  if (date === null) return value;

  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(date);
}

/** The month and the year of a `YYYY-MM`, capitalised: "Março/2026" in pt-BR. */
export function formatMonthYear(month: string, locale: string): string {
  const date = parseCalendarDate(`${month}-01`);
  if (date === null) return month;

  const name = new Intl.DateTimeFormat(locale, { month: "long" }).format(date);
  return `${name.charAt(0).toLocaleUpperCase(locale)}${name.slice(1)}/${date.getFullYear()}`;
}

/**
 * Today as a date of the API, on the calendar of the machine of the person (not the day it already
 * is in UTC). `now` is a parameter so a test does not depend on the clock.
 */
export function todayIsoDate(now: Date = new Date()): string {
  return toIsoDate(now.getFullYear(), now.getMonth(), now.getDate());
}

export interface MonthPeriod {
  /** `YYYY-MM`. */
  month: string;
  /** The first day of the month, `YYYY-MM-DD`. */
  from: string;
  /** The last day of the month, `YYYY-MM-DD`. */
  to: string;
}

/** The month of `now`, on the calendar of the machine, from its first to its last day. */
export function monthPeriod(now: Date = new Date()): MonthPeriod {
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  // Day 0 of the next month is the last day of this one.
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const from = toIsoDate(year, monthIndex, 1);

  return { month: from.slice(0, 7), from, to: toIsoDate(year, monthIndex, lastDay) };
}
