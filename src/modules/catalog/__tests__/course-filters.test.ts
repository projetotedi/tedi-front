import { describe, expect, it } from "vitest";

import {
  hasActiveCourseFilters,
  readCourseFilters,
  toListCoursesParams,
  withCourseFilter,
  withoutCourseFilters,
} from "../lib/course-filters";

const params = (query: string) => new URLSearchParams(query);

describe("readCourseFilters", () => {
  it("reads every filter of the URL", () => {
    expect(
      readCourseFilters(
        params("search=info&category=basic&status=archived&prerequisite=with&page=3"),
      ),
    ).toEqual({
      search: "info",
      category: "basic",
      status: "archived",
      prerequisite: "with",
      page: 3,
    });
  });

  it("reads anything unknown as no filter and a bad page as page 1", () => {
    expect(
      readCourseFilters(params("category=expert&status=deleted&prerequisite=yes&page=-2")),
    ).toEqual({ search: "", category: "", status: "", prerequisite: "", page: 1 });
    expect(readCourseFilters(params("page=abc")).page).toBe(1);
    expect(readCourseFilters(params("page=1.5")).page).toBe(1);
  });
});

describe("hasActiveCourseFilters", () => {
  it("is false for no filter and for a blank search", () => {
    expect(hasActiveCourseFilters(readCourseFilters(params("")))).toBe(false);
    expect(hasActiveCourseFilters(readCourseFilters(params("search=%20%20&page=2")))).toBe(false);
  });

  it.each(["search=a", "category=basic", "status=active", "prerequisite=without"])(
    "is true with %s",
    (query) => {
      expect(hasActiveCourseFilters(readCourseFilters(params(query)))).toBe(true);
    },
  );
});

describe("toListCoursesParams", () => {
  it("sends only the filters that are set, with the trimmed search", () => {
    const filters = readCourseFilters(params("category=advanced&prerequisite=without&page=2"));

    expect(toListCoursesParams(filters, "  redes ", 20)).toEqual({
      page: 2,
      limit: 20,
      search: "redes",
      category: "advanced",
      hasPrerequisite: false,
    });
    expect(toListCoursesParams(readCourseFilters(params("")), "", 20)).toEqual({
      page: 1,
      limit: 20,
    });
  });
});

describe("withCourseFilter", () => {
  it("sets a filter and goes back to page 1", () => {
    const next = withCourseFilter(params("page=3&status=active"), "category", "basic");

    expect(next.toString()).toBe("status=active&category=basic");
  });

  it("removes a filter set to empty", () => {
    expect(withCourseFilter(params("category=basic&page=2"), "category", "").toString()).toBe("");
  });

  it("keeps the filters when only the page changes", () => {
    expect(withCourseFilter(params("status=active"), "page", "2").toString()).toBe(
      "status=active&page=2",
    );
  });
});

describe("withoutCourseFilters", () => {
  it("removes every filter of the list and keeps what is not one", () => {
    expect(
      withoutCourseFilters(
        params("search=a&category=basic&status=active&page=2&other=1"),
      ).toString(),
    ).toBe("other=1");
  });
});
