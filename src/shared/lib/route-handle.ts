/** Texto de interface guardado como referência de i18n (namespace + chave), não como string. */
export interface I18nText {
  ns: string;
  key: string;
}

/**
 * O que um módulo pode declarar em `handle` de uma rota para o layout autenticado. O cabeçalho
 * mostra `headerTitle` da rota mais interna que o declara (ver `useHeaderTitle` no `app/`).
 */
export interface RouteHandle {
  headerTitle?: I18nText;
}

/**
 * Lê `headerTitle` do `handle` de uma rota. O React Router tipa `handle` como `unknown`, então
 * valida a forma em vez de assumir: qualquer coisa fora do formato vira `undefined`.
 */
export function getHeaderTitle(handle: unknown): I18nText | undefined {
  if (typeof handle !== "object" || handle === null) return undefined;

  const { headerTitle } = handle as { headerTitle?: unknown };
  if (typeof headerTitle !== "object" || headerTitle === null) return undefined;

  const { ns, key } = headerTitle as Partial<Record<keyof I18nText, unknown>>;
  if (typeof ns !== "string" || typeof key !== "string") return undefined;

  return { ns, key };
}
