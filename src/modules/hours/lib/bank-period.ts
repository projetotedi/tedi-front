/*
 * The Período of the bank of hours is a month, `YYYY-MM`, the value the URL keeps (`?period=`).
 * Every block of the screen asks the API for its first and its last day.
 */

const PERIOD = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** The API takes dates from 2000-01-01 on. */
const FIRST_YEAR = 2000;

interface PeriodParts {
  year: number;
  month: number;
}

function toPeriod({ year, month }: PeriodParts): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

/** The year and the month of a period, or `null` when it is not one (or is before 2000). */
function parsePeriod(value: string): PeriodParts | null {
  const parts = PERIOD.exec(value);
  if (parts === null) return null;

  const year = Number(parts[1]);
  return year < FIRST_YEAR ? null : { year, month: Number(parts[2]) };
}

/** The month of `now` on the calendar of the person: "2026-03". */
export function currentPeriod(now: Date = new Date()): string {
  return toPeriod({ year: now.getFullYear(), month: now.getMonth() + 1 });
}

/**
 * The period of the URL when it is a month from 2000 to the current one; anything else (missing,
 * malformed, in the future, before 2000) is the current month. The strings compare as months
 * because the format is fixed.
 */
export function resolvePeriod(value: string | null, now: Date = new Date()): string {
  const current = currentPeriod(now);
  if (value === null || parsePeriod(value) === null || value > current) return current;
  return value;
}

/** The month `months` away from `period`, back when negative: 2026-03 and -3 → 2025-12. */
export function shiftPeriod(period: string, months: number): string {
  const [year, month] = period.split("-").map(Number);
  const index = year * 12 + month - 1 + months;
  return toPeriod({ year: Math.floor(index / 12), month: (index % 12) + 1 });
}

/** The first and the last day of the month, as the API takes them: 2026-02 → 01 to 28. */
export function periodRange(period: string): { from: string; to: string } {
  const [year, month] = period.split("-").map(Number);
  // Day 0 of the next month is the last day of this one (leap years included).
  const lastDay = new Date(year, month, 0).getDate();

  return { from: `${period}-01`, to: `${period}-${String(lastDay).padStart(2, "0")}` };
}

/**
 * Every month from `first` to `last`, the newest first. A `first` after `last`, or one that is not a
 * month, gives only `last`.
 */
export function periodsBetween(first: string, last: string): string[] {
  const start = parsePeriod(first);
  if (start === null || first > last) return [last];

  const periods: string[] = [];
  let [year, month] = last.split("-").map(Number);
  for (let period = last; period >= first; period = toPeriod({ year, month })) {
    periods.push(period);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }

  return periods;
}

/**
 * The month by name, with a capital letter, and the year of a period: { month: "Março", year:
 * "2026" } in pt-BR, the same as `formatMonthYear` of the people module.
 */
export function periodParts(period: string, locale: string): { month: string; year: string } {
  const [year, month] = period.split("-").map(Number);
  const name = new Intl.DateTimeFormat(locale, { month: "long" }).format(
    new Date(year, month - 1, 1),
  );

  return {
    month: `${name.charAt(0).toLocaleUpperCase(locale)}${name.slice(1)}`,
    year: String(year),
  };
}
