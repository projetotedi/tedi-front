export type ListStateVariant = "empty" | "noResults" | "error" | "loading";

export interface ListQueryStatus {
  isPending: boolean;
  isError: boolean;
  /** `undefined` quando ainda não há dados (primeira carga ou erro sem cache). */
  total: number | undefined;
  hasActiveFilters: boolean;
}

export function resolveListState(status: ListQueryStatus): ListStateVariant | null {
  if (status.isPending) return "loading";
  // Falha de refetch com dados em cache mantém a lista na tela.
  if (status.isError && status.total === undefined) return "error";
  if (status.total === 0) return status.hasActiveFilters ? "noResults" : "empty";
  return null;
}
