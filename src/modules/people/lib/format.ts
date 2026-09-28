/**
 * Datas do mock chegam sem fuso (`YYYY-MM-DD` ou `YYYY-MM-DDTHH:mm`). `new Date("2024-03-01")`
 * seria meia-noite UTC e cairia no dia anterior no Brasil, então a leitura é sempre local.
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

/** "Março/2026" em pt-BR, a partir de `YYYY-MM`. */
export function formatMonthYear(value: string, locale: string): string {
  const date = parseLocal(`${value}-01`);
  const month = new Intl.DateTimeFormat(locale, { month: "long" }).format(date);
  return `${month.charAt(0).toLocaleUpperCase(locale)}${month.slice(1)}/${date.getFullYear()}`;
}
