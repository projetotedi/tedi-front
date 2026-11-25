import { describe, expect, it } from "vitest";

import {
  hasActiveClassFilters,
  readClassFilters,
  toListClassesParams,
  withClassFilter,
  withoutClassFilters,
} from "../lib/class-filters";

const read = (query: string) => readClassFilters(new URLSearchParams(query));

describe("class-filters", () => {
  it("reads every filter of the URL", () => {
    expect(
      read(
        "search=INFO&editionId=e&courseId=c&category=basic&status=planned,completed&archived=true&page=3",
      ),
    ).toEqual({
      search: "INFO",
      editionId: "e",
      courseId: "c",
      category: "basic",
      statuses: ["planned", "completed"],
      archived: true,
      page: 3,
    });
  });

  it("reads anything unknown as no filter, and the page from 1", () => {
    expect(read("category=expert&status=open,planned&archived=yes&page=-2")).toMatchObject({
      category: "",
      statuses: ["planned"],
      archived: false,
      page: 1,
    });
  });

  it("tells whether a filter narrows the list", () => {
    expect(hasActiveClassFilters(read("page=2"))).toBe(false);
    expect(hasActiveClassFilters(read("search=%20%20"))).toBe(false);
    expect(hasActiveClassFilters(read("archived=true"))).toBe(true);
    expect(hasActiveClassFilters(read("status=planned"))).toBe(true);
  });

  it("gives listClasses only the filters that are on", () => {
    expect(toListClassesParams(read(""), 10)).toEqual({ page: 1, limit: 10, sort: "startDate" });
    expect(
      toListClassesParams(read("search=%20INFO%20&status=planned,in_progress&archived=true"), 10),
    ).toEqual({
      page: 1,
      limit: 10,
      sort: "startDate",
      search: "INFO",
      status: "planned,in_progress",
      archived: true,
    });
  });

  it("sends the list back to page 1 when a filter changes, but not for the page", () => {
    const params = new URLSearchParams("page=3&category=basic");

    expect(withClassFilter(params, "category", "").toString()).toBe("");
    expect(withClassFilter(params, "page", "4").get("page")).toBe("4");
  });

  it("clears every filter and keeps the rest of the URL", () => {
    expect(withoutClassFilters(new URLSearchParams("search=a&courseId=c&tab=x")).toString()).toBe(
      "tab=x",
    );
  });
});
