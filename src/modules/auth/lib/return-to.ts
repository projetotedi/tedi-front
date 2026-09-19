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
 * externo (`//evil.com`, `http://...`, `/\evil.com`, `/%09/evil.com`) ou
 * inválido.
 *
 * Primeiro exige um caminho relativo simples (`/algo`, não `//algo`), o que
 * já barra alvos sem barra inicial e os protocol-relative óbvios. Depois
 * resolve com o parser de URL do próprio browser e compara a origem: alvos
 * como `/\evil.com` (barra invertida) ou `/%09/evil.com` (tab decodificado
 * pelo `URLSearchParams`) continuam começando com uma única barra, mas o
 * parser da WHATWG (o mesmo que o browser usa ao navegar de verdade) os
 * resolve para `http://evil.com` — só o parse pega esse caso, checar
 * prefixo não é suficiente.
 */
export function readReturnTo(search: string): string {
  const params = new URLSearchParams(search);
  const returnTo = params.get("returnTo");

  if (!returnTo) return "/";
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(returnTo, window.location.origin);
  } catch {
    return "/";
  }

  if (url.origin !== window.location.origin) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}
