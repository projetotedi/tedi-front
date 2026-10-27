/** Tira as barras finais, exceto a da raiz ("/"). */
function trimTrailingSlash(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

/**
 * Qual dos `paths` representa a rota `pathname`. Um caminho casa quando é igual a `pathname`
 * ou o prefixo dele por segmento (`/classes` casa `/classes` e `/classes/abc`, mas não
 * `/classesx`); havendo mais de um, vale o mais longo (`/lessons/calendar` vence `/lessons`).
 * A barra final de `pathname` é ignorada e a comparação não diferencia maiúsculas, como o
 * roteador. Sem nenhum casamento, devolve `null`.
 */
export function findActivePath(paths: readonly string[], pathname: string): string | null {
  const current = trimTrailingSlash(pathname).toLowerCase();
  let best: string | null = null;

  for (const path of paths) {
    const candidate = path.toLowerCase();
    const matches = current === candidate || current.startsWith(`${candidate}/`);

    if (matches && (best === null || path.length > best.length)) best = path;
  }

  return best;
}
