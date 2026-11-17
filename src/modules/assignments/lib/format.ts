const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The day and the month of a date of the API (`format: date`, `YYYY-MM-DD`, with no time zone), in
 * the order of the locale: "10/03" in pt-BR for 2026-03-10. It is the form the cards of the
 * allocations use (the Figma shows "10/03", with no year, because an allocation is read next to
 * the lesson it is for). The parts are read as a local date, since `new Date("2026-03-10")` is
 * midnight UTC and would fall on the previous day in Brazil. A value that is not a calendar date is
 * returned as it came, the same rule as `formatCalendarDate`: a screen that shows it is better than
 * one that does not open.
 */
export function formatDayMonth(value: string, locale: string): string {
  const parts = CALENDAR_DATE.exec(value);
  if (parts === null) return value;

  const [year, month, day] = parts.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  // `Date` carries an impossible day over to the next month ("2026-02-31" is March 3rd).
  const isCalendarDate =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  if (!isCalendarDate) return value;

  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(date);
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
