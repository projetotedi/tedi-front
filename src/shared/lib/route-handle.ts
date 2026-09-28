/**
 * `handle` das rotas autenticadas. O AppLayout lê o `title` da rota mais interna que o
 * declarar e o usa como título da topbar e da aba.
 */
export interface RouteHandle {
  /** Chave de i18n com namespace (ex.: "people:profile.title"). */
  title: string;
}

function isRouteHandle(handle: unknown): handle is RouteHandle {
  return (
    typeof handle === "object" &&
    handle !== null &&
    typeof (handle as { title?: unknown }).title === "string"
  );
}

/** Título da rota mais interna que declara `handle.title`; null se nenhuma declara. */
export function findRouteTitle(matches: readonly { handle: unknown }[]): string | null {
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const { handle } = matches[index];
    if (isRouteHandle(handle)) return handle.title;
  }
  return null;
}
