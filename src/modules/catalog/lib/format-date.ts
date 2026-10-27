/** Short date for the screen ("01/10/2026" in pt-BR), in the time zone of the browser. */
export function formatDate(isoDate: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(new Date(isoDate));
}
