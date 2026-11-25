import { describe, expect, it } from "vitest";

import {
  hasActiveMemberFilters,
  MEMBER_FILTER_KEYS,
  MEMBER_SEARCH_DEBOUNCE_MS,
  MEMBER_SEARCH_MAX_LENGTH,
  MEMBERS_PAGE_SIZE,
  readMemberFilters,
  toListMembersParams,
  withMemberFilter,
  withoutMemberFilters,
  type MemberFilterValues,
} from "../lib/member-filters";

const read = (query: string) => readMemberFilters(new URLSearchParams(query));

function filters(overrides: Partial<MemberFilterValues> = {}): MemberFilterValues {
  return { search: "", role: "", status: "", page: 1, ...overrides };
}

describe("readMemberFilters", () => {
  it("reads every filter of the URL", () => {
    expect(read("search=Ana&role=director&status=pending&page=3")).toEqual({
      search: "Ana",
      role: "director",
      status: "pending",
      page: 3,
    });
  });

  it("reads an empty URL as no filter, on page 1", () => {
    expect(read("")).toEqual({ search: "", role: "", status: "", page: 1 });
  });

  it.each(["member", "director", "coordinator"])("reads role %s", (role) => {
    expect(read(`role=${role}`).role).toBe(role);
  });

  it.each(["active", "inactive", "pending"])("reads status %s", (status) => {
    expect(read(`status=${status}`).status).toBe(status);
  });

  it("reads anything unknown as no filter, so an old or hand-typed link does not break the screen", () => {
    expect(read("role=superadmin&status=rejected")).toMatchObject({ role: "", status: "" });
    expect(read("role=Diretor&status=Ativo")).toMatchObject({ role: "", status: "" });
    expect(read("role=&status=")).toMatchObject({ role: "", status: "" });
  });

  it.each(["0", "-2", "abc", "1.5", ""])("reads page %j as page 1", (page) => {
    expect(read(`page=${page}`).page).toBe(1);
  });

  it("keeps the search as typed, spaces included", () => {
    expect(read("search=%20Ana%20").search).toBe(" Ana ");
  });
});

describe("hasActiveMemberFilters", () => {
  it("is false with no filter", () => {
    expect(hasActiveMemberFilters(filters())).toBe(false);
  });

  it("does not count the page", () => {
    expect(hasActiveMemberFilters(filters({ page: 4 }))).toBe(false);
  });

  it("does not count a search made only of spaces", () => {
    expect(hasActiveMemberFilters(filters({ search: "   " }))).toBe(false);
  });

  it("is true with a search text, a role or a status", () => {
    expect(hasActiveMemberFilters(filters({ search: "Ana" }))).toBe(true);
    expect(hasActiveMemberFilters(filters({ role: "director" }))).toBe(true);
    expect(hasActiveMemberFilters(filters({ status: "inactive" }))).toBe(true);
  });
});

describe("toListMembersParams", () => {
  it("sends only the page and the limit when no filter is set", () => {
    expect(toListMembersParams(filters(), MEMBERS_PAGE_SIZE)).toEqual({ page: 1, limit: 12 });
  });

  it("forwards the page and the limit", () => {
    expect(toListMembersParams(filters({ page: 3 }), 20)).toEqual({ page: 3, limit: 20 });
  });

  it("trims the search and does not send one made only of spaces", () => {
    expect(toListMembersParams(filters({ search: "  Ana  " }), 12).search).toBe("Ana");
    expect(toListMembersParams(filters({ search: "   " }), 12)).not.toHaveProperty("search");
  });

  it("sends at most 100 characters of the search, the limit of the contract", () => {
    expect(toListMembersParams(filters({ search: "a".repeat(150) }), 12).search).toBe(
      "a".repeat(100),
    );
    expect(toListMembersParams(filters({ search: "a".repeat(100) }), 12).search).toBe(
      "a".repeat(100),
    );
    expect(toListMembersParams(filters({ search: "a".repeat(99) }), 12).search).toBe(
      "a".repeat(99),
    );
  });

  it("cuts after the trim: the spaces around the text do not count, and the cut does not end on a space", () => {
    expect(toListMembersParams(filters({ search: `   ${"a".repeat(100)}   ` }), 12).search).toBe(
      "a".repeat(100),
    );
    expect(toListMembersParams(filters({ search: `  ${"a".repeat(99)} bbb  ` }), 12).search).toBe(
      "a".repeat(99),
    );
  });

  it("keeps the whole search in the filters: only what goes to the API is cut", () => {
    const search = "a".repeat(150);

    expect(read(`search=${search}`).search).toBe(search);
    expect(hasActiveMemberFilters(filters({ search }))).toBe(true);
  });

  it.each(["member", "director", "coordinator"] as const)("sends role %s", (role) => {
    expect(toListMembersParams(filters({ role }), 12).role).toBe(role);
  });

  it("asks for status=active with access enabled for Ativo", () => {
    expect(toListMembersParams(filters({ status: "active" }), 12)).toEqual({
      page: 1,
      limit: 12,
      status: "active",
      enabled: true,
    });
  });

  it("asks only for status=inactive for Inativo", () => {
    expect(toListMembersParams(filters({ status: "inactive" }), 12)).toEqual({
      page: 1,
      limit: 12,
      status: "inactive",
    });
  });

  it("asks for the registrations waiting for validation for A validar", () => {
    expect(toListMembersParams(filters({ status: "pending" }), 12)).toEqual({
      page: 1,
      limit: 12,
      registrationStatus: "pending",
    });
  });

  it("combines every filter", () => {
    expect(
      toListMembersParams(
        filters({ search: "Ana", role: "director", status: "active", page: 2 }),
        12,
      ),
    ).toEqual({
      page: 2,
      limit: 12,
      search: "Ana",
      role: "director",
      status: "active",
      enabled: true,
    });
  });
});

describe("withMemberFilter", () => {
  it("sets the filter in the URL", () => {
    expect(withMemberFilter(new URLSearchParams(), "role", "director").toString()).toBe(
      "role=director",
    );
  });

  it("takes the filter out of the URL when the value is empty", () => {
    const params = new URLSearchParams("role=director&status=pending");

    expect(withMemberFilter(params, "role", "").toString()).toBe("status=pending");
  });

  it("sends the list back to page 1 when a filter other than the page changes", () => {
    const params = new URLSearchParams("page=3&role=director");

    expect(withMemberFilter(params, "status", "inactive").has("page")).toBe(false);
    expect(withMemberFilter(params, "search", "Ana").has("page")).toBe(false);
    expect(withMemberFilter(params, "role", "").has("page")).toBe(false);
  });

  it("keeps the other filters when the page changes", () => {
    const params = new URLSearchParams("role=director&status=pending");

    expect(withMemberFilter(params, "page", "4").toString()).toBe(
      "role=director&status=pending&page=4",
    );
  });

  it("keeps what is in the URL besides the filters", () => {
    expect(withMemberFilter(new URLSearchParams("tab=x"), "role", "member").toString()).toBe(
      "tab=x&role=member",
    );
  });

  it("does not change the URL it was given", () => {
    const params = new URLSearchParams("role=director");

    withMemberFilter(params, "role", "");

    expect(params.toString()).toBe("role=director");
  });
});

describe("withoutMemberFilters", () => {
  it("takes every filter of the list out of the URL and keeps the rest", () => {
    const params = new URLSearchParams("search=Ana&role=director&status=pending&page=2&tab=x");

    expect(withoutMemberFilters(params).toString()).toBe("tab=x");
  });

  it("does not change the URL it was given", () => {
    const params = new URLSearchParams("search=Ana");

    withoutMemberFilters(params);

    expect(params.toString()).toBe("search=Ana");
  });
});

describe("constants", () => {
  it("shows 12 members per page", () => {
    expect(MEMBERS_PAGE_SIZE).toBe(12);
  });

  it("waits 400 ms after the last keystroke before searching", () => {
    expect(MEMBER_SEARCH_DEBOUNCE_MS).toBe(400);
  });

  it("sends at most 100 characters of the search", () => {
    expect(MEMBER_SEARCH_MAX_LENGTH).toBe(100);
  });

  it("reads the search, the role, the status and the page from the URL", () => {
    expect(MEMBER_FILTER_KEYS).toEqual(["search", "role", "status", "page"]);
  });
});
