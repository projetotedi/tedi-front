export const LOGIN_PATH = "/login";

export type SessionEndReason = "expired";

interface LocationLike {
  pathname: string;
  search: string;
  hash: string;
}

/**
 * Monta o alvo de `/login?returnTo=<rota codificada>[&reason=expired]`.
 * Não aninha `returnTo` quando `location` já é `/login` (evita
 * `/login?returnTo=%2Flogin%3FreturnTo%3D...`).
 */
export function buildLoginPath(location: LocationLike, reason?: SessionEndReason): string {
  const params: string[] = [];

  if (location.pathname !== LOGIN_PATH) {
    const target = `${location.pathname}${location.search}${location.hash}`;
    params.push(`returnTo=${encodeURIComponent(target)}`);
  }

  if (reason) params.push(`reason=${encodeURIComponent(reason)}`);

  return params.length > 0 ? `${LOGIN_PATH}?${params.join("&")}` : LOGIN_PATH;
}

/**
 * Lê e valida `returnTo` de `location.search`. Devolve "/" quando ausente,
 * externo (`//evil.com`, `http://...`) ou inválido.
 */
export function readReturnTo(search: string): string {
  const params = new URLSearchParams(search);
  const returnTo = params.get("returnTo");

  if (!returnTo) return "/";
  // "/rota" é seguro; "//evil.com" e "https://evil.com" (ou qualquer esquema) não são —
  // devem começar com uma única barra para ficar dentro do próprio app.
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) return "/";

  return returnTo;
}
