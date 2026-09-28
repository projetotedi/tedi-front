export interface I18nText {
  ns: string;
  key: string;
}

export interface RouteHandle {
  headerTitle?: I18nText;
}

/** O React Router tipa `handle` como `unknown`: valida a forma. */
export function getHeaderTitle(handle: unknown): I18nText | undefined {
  if (typeof handle !== "object" || handle === null) return undefined;

  const { headerTitle } = handle as { headerTitle?: unknown };
  if (typeof headerTitle !== "object" || headerTitle === null) return undefined;

  const { ns, key } = headerTitle as Partial<Record<keyof I18nText, unknown>>;
  if (typeof ns !== "string" || typeof key !== "string") return undefined;

  return { ns, key };
}
