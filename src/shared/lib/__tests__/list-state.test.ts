import { describe, expect, it } from "vitest";

import { resolveListState, type ListQueryStatus } from "../list-state";

function status(overrides: Partial<ListQueryStatus> = {}): ListQueryStatus {
  return { isPending: false, isError: false, total: 10, hasActiveFilters: false, ...overrides };
}

describe("resolveListState", () => {
  it("is loading while the first request is pending", () => {
    expect(resolveListState(status({ isPending: true, total: undefined }))).toBe("loading");
  });

  it("is error when the request failed and there is no data", () => {
    expect(resolveListState(status({ isError: true, total: undefined }))).toBe("error");
  });

  it("keeps the list when a refetch fails but data is cached", () => {
    expect(resolveListState(status({ isError: true, total: 5 }))).toBeNull();
  });

  it("is empty when the total is 0 and no filter is active", () => {
    expect(resolveListState(status({ total: 0 }))).toBe("empty");
  });

  it("is noResults when the total is 0 and a filter is active", () => {
    expect(resolveListState(status({ total: 0, hasActiveFilters: true }))).toBe("noResults");
  });

  it("is null when there are rows, with or without filters", () => {
    expect(resolveListState(status({ total: 16 }))).toBeNull();
    expect(resolveListState(status({ total: 16, hasActiveFilters: true }))).toBeNull();
  });
});
