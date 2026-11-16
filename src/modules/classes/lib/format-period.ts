const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
};

/**
 * `YYYY-MM-DD` read at local midnight. `new Date("2026-03-03")` is read as UTC, which in a time
 * zone behind it shows the day before.
 */
function toLocalDate(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

/** The period of a class in the short format of the screens: "03/03/26 - 27/05/26" in pt-BR. */
export function formatPeriod(startDate: string, endDate: string, locale: string): string {
  const formatter = new Intl.DateTimeFormat(locale, DATE_FORMAT);

  return `${formatter.format(toLocalDate(startDate))} - ${formatter.format(toLocalDate(endDate))}`;
}
