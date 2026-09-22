/** Formata uma data ISO no padrão curto (data + hora) do locale informado. */
export function formatDateTime(value: string, locale: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone }).format(
    new Date(value),
  );
}
