import {
  MemberRegistrationStatus,
  MemberStatus,
  type ListMembersParams,
} from "@api/generated/model";

import { INVITABLE_ROLES } from "./role-label";

/** Rows per page of the list of members. */
export const MEMBERS_PAGE_SIZE = 12;

/** How long the search waits after the last keystroke before it goes to the URL. */
export const MEMBER_SEARCH_DEBOUNCE_MS = 400;

/** The contract limits `search` to 100 characters (`ListMembersParams`); a longer text answers 400. */
export const MEMBER_SEARCH_MAX_LENGTH = 100;

/** The keys of the URL that the list of members reads (GUS-150). */
export const MEMBER_FILTER_KEYS = ["search", "role", "status", "page"] as const;

export type MemberFilterKey = (typeof MEMBER_FILTER_KEYS)[number];

export type MemberRoleFilter = "" | (typeof INVITABLE_ROLES)[number];

/**
 * What the Status filter offers. `pending` is a registration waiting for validation ("A validar"),
 * which the API keeps apart from the participation (`active`, `inactive`). The empty string is
 * "Todos".
 */
export type MemberStatusFilter = "" | "active" | "inactive" | "pending";

const MEMBER_STATUS_FILTERS = ["active", "inactive", "pending"] as const;

/** What the screen keeps in the URL, as text: the empty string is "no filter". */
export interface MemberFilterValues {
  search: string;
  role: MemberRoleFilter;
  status: MemberStatusFilter;
  page: number;
}

/**
 * The parameters of `listMembers` behind each option of the Status filter.
 *
 * Ativo asks for `enabled=true` as well as `status=active`: the API says a registration that is
 * pending or rejected is `status=active` too, and only an approved one has access enabled.
 */
const STATUS_PARAMS = {
  "": {},
  active: { status: MemberStatus.active, enabled: true },
  inactive: { status: MemberStatus.inactive },
  pending: { registrationStatus: MemberRegistrationStatus.pending },
} as const satisfies Record<
  MemberStatusFilter,
  Pick<ListMembersParams, "status" | "enabled" | "registrationStatus">
>;

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | "" {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : "";
}

/**
 * The filters of the URL, with anything unknown read as "no filter" (a hand-typed or old link must
 * not break the screen) and the page from 1.
 */
export function readMemberFilters(params: URLSearchParams): MemberFilterValues {
  const page = Number(params.get("page"));

  return {
    search: params.get("search") ?? "",
    role: oneOf(params.get("role"), INVITABLE_ROLES),
    status: oneOf(params.get("status"), MEMBER_STATUS_FILTERS),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/**
 * Whether any filter narrows the list: the screen tells "no member yet" from "no result" by it.
 * The page is not a filter, and a search made only of spaces is not one either.
 */
export function hasActiveMemberFilters(filters: MemberFilterValues): boolean {
  return filters.search.trim() !== "" || filters.role !== "" || filters.status !== "";
}

/**
 * The parameters of `listMembers` for the filters of the screen and the size of a page. The search
 * is trimmed and cut at the limit of the contract (the box keeps what was typed), and trimmed again
 * because the cut can end on a space.
 */
export function toListMembersParams(filters: MemberFilterValues, limit: number): ListMembersParams {
  const search = filters.search.trim().slice(0, MEMBER_SEARCH_MAX_LENGTH).trim();

  return {
    page: filters.page,
    limit,
    ...(search ? { search } : {}),
    ...(filters.role ? { role: filters.role } : {}),
    ...STATUS_PARAMS[filters.status],
  };
}

/**
 * The URL after one filter changed: the empty value leaves the URL, and any change other than the
 * page sends the list back to page 1. Whatever else is in the URL stays.
 */
export function withMemberFilter(
  params: URLSearchParams,
  key: MemberFilterKey,
  value: string,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value) next.set(key, value);
  else next.delete(key);
  if (key !== "page") next.delete("page");
  return next;
}

/** The URL with every filter of the list removed (Limpar filtros). */
export function withoutMemberFilters(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of MEMBER_FILTER_KEYS) next.delete(key);
  return next;
}
