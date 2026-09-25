/** Um item da barra de paginação: um número de página ou uma reticência (páginas omitidas). */
export type PageItem = number | "ellipsis-start" | "ellipsis-end";

/** Acima disto a barra omite páginas com reticências; até aqui mostra todas. */
const MAX_PAGES_WITHOUT_ELLIPSIS = 7;

/**
 * Itens da barra de paginação numerada. Até 7 páginas, mostra todas. Com mais, mantém sempre
 * 7 itens (a barra não muda de largura ao navegar): primeira e última página, a página atual
 * com uma vizinha de cada lado e reticências no lugar do que fica de fora.
 *
 * Ex. (página, total): (1, 10) → 1 2 3 4 5 … 10; (5, 10) → 1 … 4 5 6 … 10; (10, 10) → 1 … 6 7 8 9 10.
 */
export function getPageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages <= MAX_PAGES_WITHOUT_ELLIPSIS) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const start = Math.max(2, Math.min(page - 1, totalPages - 4));
  const end = Math.min(totalPages - 1, Math.max(page + 1, 5));

  const items: PageItem[] = [1];
  if (start > 2) items.push("ellipsis-start");
  for (let current = start; current <= end; current += 1) items.push(current);
  if (end < totalPages - 1) items.push("ellipsis-end");
  items.push(totalPages);

  return items;
}
