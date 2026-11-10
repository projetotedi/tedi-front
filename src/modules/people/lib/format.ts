/**
 * Dates of the API come without a time zone (`format: date`, `YYYY-MM-DD`). `new Date("2024-03-01")`
 * would be midnight UTC and fall on the previous day in Brazil, so these are always read as local.
 * For a real instant (`format: date-time`, e.g. `...T13:00:00.000Z`) use `formatInstant`.
 */
function parseLocal(value: string): Date {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [year, month = 1, day = 1] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

/** "01/03/2024" em pt-BR. */
export function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(parseLocal(value));
}

/** "14/03" em pt-BR. */
export function formatDayMonth(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(
    parseLocal(value),
  );
}

/** "14/03/2026, 09:12" em pt-BR. */
export function formatDateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(
    parseLocal(value),
  );
}

/**
 * "20/10/2026, 10:00" in pt-BR, from a real instant (`format: date-time`, ending in `Z`).
 * Without `timeZone` it uses the browser's, which matters because the API returns UTC.
 */
export function formatInstant(value: string, locale: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

/** "Março/2026" em pt-BR, a partir de `YYYY-MM`. */
export function formatMonthYear(value: string, locale: string): string {
  const date = parseLocal(`${value}-01`);
  const month = new Intl.DateTimeFormat(locale, { month: "long" }).format(date);
  return `${month.charAt(0).toLocaleUpperCase(locale)}${month.slice(1)}/${date.getFullYear()}`;
}

/**
 * "(11) 98181-3030" from the 11 digits the API returns; 10 digits (a landline) become
 * "(11) 3333-4444". Any other value is returned as it came.
 */
export function formatPhone(digits: string): string {
  if (/^\d{11}$/.test(digits)) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (/^\d{10}$/.test(digits)) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return digits;
}
