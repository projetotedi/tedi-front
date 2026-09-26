import type { ListAccessParams } from "@api/generated/model";

import { INVITABLE_ROLES } from "./role-label";

/** Itens por página da lista de membros (o Figma mostra "12 de 16"). */
export const ACCESS_PAGE_SIZE = 12;

/** Espera, em ms, depois da última tecla antes de buscar. */
export const SEARCH_DEBOUNCE_MS = 400;

/** Filtro de papel: todos ou um dos perfis que a coordenação convida (superadmin não é filtrável). */
export type RoleFilter = "all" | (typeof INVITABLE_ROLES)[number];

/** Filtro de status: todos, com acesso ativo ou com acesso desativado. */
export type StatusFilter = "all" | "active" | "inactive";

export interface AccessFilterValues {
  search: string;
  role: RoleFilter;
  status: StatusFilter;
}

export const EMPTY_ACCESS_FILTERS: AccessFilterValues = {
  search: "",
  role: "all",
  status: "all",
};

export function isRoleFilter(value: string): value is RoleFilter {
  return value === "all" || (INVITABLE_ROLES as readonly string[]).includes(value);
}

export function isStatusFilter(value: string): value is StatusFilter {
  return value === "all" || value === "active" || value === "inactive";
}

/**
 * Parâmetros de `GET /access` para os filtros da tela. Filtro vazio não vai na URL: busca em
 * branco, papel "todos" e status "todos" saem como `undefined`.
 */
export function toListAccessParams(filters: AccessFilterValues, page: number): ListAccessParams {
  return {
    page,
    limit: ACCESS_PAGE_SIZE,
    search: filters.search.trim() || undefined,
    role: filters.role === "all" ? undefined : filters.role,
    enabled: filters.status === "all" ? undefined : filters.status === "active",
  };
}
