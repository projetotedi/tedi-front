import type { ListAccessParams } from "@api/generated/model";

import { INVITABLE_ROLES } from "./role-label";

export const ACCESS_PAGE_SIZE = 12;

export const SEARCH_DEBOUNCE_MS = 400;

export type RoleFilter = "all" | (typeof INVITABLE_ROLES)[number];

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

export function hasActiveFilters(filters: AccessFilterValues): boolean {
  return filters.search.trim() !== "" || filters.role !== "all" || filters.status !== "all";
}

export function toListAccessParams(filters: AccessFilterValues, page: number): ListAccessParams {
  return {
    page,
    limit: ACCESS_PAGE_SIZE,
    search: filters.search.trim() || undefined,
    role: filters.role === "all" ? undefined : filters.role,
    enabled: filters.status === "all" ? undefined : filters.status === "active",
  };
}
