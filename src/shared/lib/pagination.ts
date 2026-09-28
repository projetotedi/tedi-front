export type PageItem = number | "ellipsis-start" | "ellipsis-end";

const MAX_PAGES_WITHOUT_ELLIPSIS = 7;

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
