import { describe, expect, it } from "vitest";

import { Role } from "@shared/lib/role";

import {
  ACCESS_PAGE_SIZE,
  EMPTY_ACCESS_FILTERS,
  isRoleFilter,
  isStatusFilter,
  SEARCH_DEBOUNCE_MS,
  toListAccessParams,
  type AccessFilterValues,
} from "../lib/access-filters";

function filters(overrides: Partial<AccessFilterValues> = {}): AccessFilterValues {
  return { ...EMPTY_ACCESS_FILTERS, ...overrides };
}

describe("toListAccessParams", () => {
  it("sends only the page and the limit when no filter is set", () => {
    const params = toListAccessParams(EMPTY_ACCESS_FILTERS, 1);

    expect(params).toEqual({ page: 1, limit: 12 });
    expect(params.search).toBeUndefined();
    expect(params.role).toBeUndefined();
    expect(params.enabled).toBeUndefined();
  });

  it("uses the fixed page size of 12", () => {
    expect(ACCESS_PAGE_SIZE).toBe(12);
    expect(toListAccessParams(EMPTY_ACCESS_FILTERS, 3).limit).toBe(12);
  });

  it("forwards the requested page", () => {
    expect(toListAccessParams(EMPTY_ACCESS_FILTERS, 3).page).toBe(3);
  });

  it("trims the search text", () => {
    expect(toListAccessParams(filters({ search: "  Ana  " }), 1).search).toBe("Ana");
  });

  it("does not send a search made only of spaces", () => {
    expect(toListAccessParams(filters({ search: "   " }), 1).search).toBeUndefined();
  });

  it.each([Role.member, Role.director, Role.coordinator])("sends role %s", (role) => {
    expect(toListAccessParams(filters({ role }), 1).role).toBe(role);
  });

  it("sends enabled=true for the active status", () => {
    expect(toListAccessParams(filters({ status: "active" }), 1).enabled).toBe(true);
  });

  it("sends enabled=false for the inactive status", () => {
    expect(toListAccessParams(filters({ status: "inactive" }), 1).enabled).toBe(false);
  });

  it("combines every filter", () => {
    expect(
      toListAccessParams(filters({ search: "Ana", role: Role.director, status: "active" }), 2),
    ).toEqual({ page: 2, limit: 12, search: "Ana", role: "director", enabled: true });
  });
});

describe("isRoleFilter", () => {
  it.each(["all", "member", "director", "coordinator"])("accepts %s", (value) => {
    expect(isRoleFilter(value)).toBe(true);
  });

  it.each(["superadmin", "", "Membro", "ALL"])("rejects %s", (value) => {
    expect(isRoleFilter(value)).toBe(false);
  });
});

describe("isStatusFilter", () => {
  it.each(["all", "active", "inactive"])("accepts %s", (value) => {
    expect(isStatusFilter(value)).toBe(true);
  });

  it.each(["", "enabled", "Ativo"])("rejects %s", (value) => {
    expect(isStatusFilter(value)).toBe(false);
  });
});

describe("constants", () => {
  it("waits 400 ms after the last keystroke before searching", () => {
    expect(SEARCH_DEBOUNCE_MS).toBe(400);
  });

  it("starts with everything unfiltered", () => {
    expect(EMPTY_ACCESS_FILTERS).toEqual({ search: "", role: "all", status: "all" });
  });
});
