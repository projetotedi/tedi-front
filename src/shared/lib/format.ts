/**
 * Duração em minutos no padrão do TEDI: 120 → "2h", 90 → "1h30", 30 → "0h30", 0 → "0h".
 * Negativo leva o sinal na frente do valor absoluto (-90 → "-1h30"); o que arredonda para zero
 * fica sem sinal (-0.4 → "0h").
 */
export function formatHours(minutes: number): string {
  const total = Math.round(minutes);
  const sign = total < 0 ? "-" : "";
  const absolute = Math.abs(total);
  const hours = Math.trunc(absolute / 60);
  const rest = absolute % 60;
  const time = rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}`;
  return `${sign}${time}`;
}

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
