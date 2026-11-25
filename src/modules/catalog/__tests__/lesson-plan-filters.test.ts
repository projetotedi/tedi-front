import { describe, expect, it } from "vitest";

import {
  hasActiveLessonPlanFilters,
  readLessonPlanFilters,
  toListLessonPlansParams,
  withDurationFilter,
  withLessonPlanFilters,
  withoutLessonPlanFilters,
} from "../lib/lesson-plan-filters";

const read = (query: string) => readLessonPlanFilters(new URLSearchParams(query));

describe("lesson-plan-filters", () => {
  it("reads every filter of the URL, the duration as one of the ranges of the screen", () => {
    expect(
      read("search=audio&content=Janela&usage=unused&minDuration=91&maxDuration=120&page=3"),
    ).toEqual({
      search: "audio",
      content: "Janela",
      usage: "unused",
      duration: "91-to-120",
      page: 3,
    });
  });

  it("reads anything unknown as no filter, and the page from 1", () => {
    expect(read("usage=all&minDuration=10&page=0")).toEqual({
      search: "",
      content: "",
      usage: "",
      duration: "",
      page: 1,
    });
  });

  it("tells whether a filter narrows the list", () => {
    expect(hasActiveLessonPlanFilters(read("page=2"))).toBe(false);
    expect(hasActiveLessonPlanFilters(read("search=%20"))).toBe(false);
    expect(hasActiveLessonPlanFilters(read("maxDuration=90"))).toBe(true);
    expect(hasActiveLessonPlanFilters(read("usage=archived"))).toBe(true);
  });

  it("gives listLessonPlans only the filters that are on", () => {
    expect(toListLessonPlansParams(read(""), 7)).toEqual({ page: 1, limit: 7, sort: "title" });
    expect(toListLessonPlansParams(read("search=%20audio%20&minDuration=121"), 7)).toEqual({
      page: 1,
      limit: 7,
      sort: "title",
      search: "audio",
      minDuration: 121,
    });
  });

  it("sends the list back to page 1 when a filter changes, but not for the page", () => {
    const params = new URLSearchParams("page=3&usage=unused");

    expect(withLessonPlanFilters(params, { usage: "" }).toString()).toBe("");
    expect(withLessonPlanFilters(params, { page: "4" }).get("page")).toBe("4");
  });

  it("writes and clears the range of duration", () => {
    const params = new URLSearchParams("minDuration=91&maxDuration=120");

    expect(withDurationFilter(params, "up-to-90").toString()).toBe("maxDuration=90");
    expect(withDurationFilter(params, "").toString()).toBe("");
  });

  it("clears every filter and keeps the rest of the URL", () => {
    expect(
      withoutLessonPlanFilters(new URLSearchParams("search=a&content=b&tab=x")).toString(),
    ).toBe("tab=x");
  });
});
