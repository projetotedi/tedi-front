import { describe, expect, it } from "vitest";

import { LessonStatus } from "@api/generated/model";

import {
  CALENDAR_FILTER_KEYS,
  LESSON_FILTER_KEYS,
  LIST_FILTER_KEYS,
  hasActiveLessonFilters,
  readLessonFilters,
  toListLessonsCalendarParams,
  toListLessonsParams,
  withLessonFilters,
  withoutLessonFilters,
  type LessonFilterValues,
} from "../lib/lesson-filters";
import { CLASS_ID, COURSE_ID, LESSON_PLAN_ID } from "./handlers";

const read = (query: string) => readLessonFilters(new URLSearchParams(query));

const NO_FILTERS: LessonFilterValues = {
  search: "",
  classId: "",
  courseId: "",
  status: "",
  lessonPlanId: "",
  from: "",
  to: "",
  page: 1,
};

const ALL_FILTERS: LessonFilterValues = {
  search: "teclado",
  classId: CLASS_ID,
  courseId: COURSE_ID,
  status: LessonStatus.confirmed,
  lessonPlanId: LESSON_PLAN_ID,
  from: "2026-03-02",
  to: "2026-03-31",
  page: 3,
};

const ALL_QUERY = new URLSearchParams({
  search: "teclado",
  classId: CLASS_ID,
  courseId: COURSE_ID,
  status: "confirmed",
  lessonPlanId: LESSON_PLAN_ID,
  from: "2026-03-02",
  to: "2026-03-31",
  page: "3",
});

describe("readLessonFilters", () => {
  it("reads no filter from an empty URL, on page 1", () => {
    expect(read("")).toEqual(NO_FILTERS);
  });

  it("reads and writes every key", () => {
    expect(LESSON_FILTER_KEYS).toHaveLength(8);
    expect(readLessonFilters(ALL_QUERY)).toEqual(ALL_FILTERS);

    const written = withLessonFilters(new URLSearchParams(), {
      search: "teclado",
      classId: CLASS_ID,
      courseId: COURSE_ID,
      status: "confirmed",
      lessonPlanId: LESSON_PLAN_ID,
      from: "2026-03-02",
      to: "2026-03-31",
      page: "3",
    });
    expect(readLessonFilters(written)).toEqual(ALL_FILTERS);
  });

  it("drops an id that is not a UUID, for the API would answer 400", () => {
    expect(read(`classId=banana&courseId=123&lessonPlanId=${LESSON_PLAN_ID}`)).toEqual({
      ...NO_FILTERS,
      lessonPlanId: LESSON_PLAN_ID,
    });
  });

  it("drops an unknown status", () => {
    expect(read("status=archived").status).toBe("");
    expect(read("status=done").status).toBe(LessonStatus.done);
  });

  it("drops a day that is not a calendar date", () => {
    expect(read("from=amanha&to=2026-02-31")).toEqual(NO_FILTERS);
    expect(read("from=2026-3-2").from).toBe("");
  });

  it("drops an inverted period: the end falls and the start stays", () => {
    expect(read("from=2026-03-31&to=2026-03-02")).toEqual({ ...NO_FILTERS, from: "2026-03-31" });
  });

  it("keeps a period with only one end, and a one-day period", () => {
    expect(read("from=2026-03-02")).toEqual({ ...NO_FILTERS, from: "2026-03-02" });
    expect(read("to=2026-03-31")).toEqual({ ...NO_FILTERS, to: "2026-03-31" });
    expect(read("from=2026-03-02&to=2026-03-02")).toEqual({
      ...NO_FILTERS,
      from: "2026-03-02",
      to: "2026-03-02",
    });
  });

  it("cuts the search at the 100 characters the API takes", () => {
    expect(read(`search=${"a".repeat(130)}`).search).toBe("a".repeat(100));
  });

  it.each(["0", "-2", "1.5", "abc", ""])("reads the page %j as 1", (page) => {
    expect(read(`page=${page}`).page).toBe(1);
  });

  it("reads a page above 1", () => {
    expect(read("page=4").page).toBe(4);
  });
});

describe("hasActiveLessonFilters", () => {
  it("is false with no filter, even on another page", () => {
    expect(hasActiveLessonFilters(NO_FILTERS)).toBe(false);
    expect(hasActiveLessonFilters({ ...NO_FILTERS, page: 5 })).toBe(false);
  });

  it.each([
    ["search", { search: "teclado" }],
    ["class", { classId: CLASS_ID }],
    ["course", { courseId: COURSE_ID }],
    ["status", { status: LessonStatus.done }],
    ["lesson plan", { lessonPlanId: LESSON_PLAN_ID }],
    ["start of the period", { from: "2026-03-02" }],
    ["end of the period", { to: "2026-03-31" }],
  ])("is true with the %s", (_label, change) => {
    expect(hasActiveLessonFilters({ ...NO_FILTERS, ...change })).toBe(true);
  });

  it("does not count a search of only spaces", () => {
    expect(hasActiveLessonFilters({ ...NO_FILTERS, search: "   " })).toBe(false);
  });

  it("counts only the filters the screen has", () => {
    // The list has no course filter: a `courseId` left in a hand-typed URL is not a filter there.
    expect(hasActiveLessonFilters({ ...NO_FILTERS, courseId: COURSE_ID }, LIST_FILTER_KEYS)).toBe(
      false,
    );
    // And the calendar has neither the search nor the period of the list.
    expect(
      hasActiveLessonFilters(
        { ...NO_FILTERS, search: "a", from: "2026-03-02" },
        CALENDAR_FILTER_KEYS,
      ),
    ).toBe(false);
    expect(
      hasActiveLessonFilters({ ...NO_FILTERS, courseId: COURSE_ID }, CALENDAR_FILTER_KEYS),
    ).toBe(true);
  });
});

describe("toListLessonsParams", () => {
  it("sends only the page and the size with no filter", () => {
    expect(toListLessonsParams(NO_FILTERS, 10)).toEqual({ page: 1, limit: 10 });
  });

  it("sends every filter of the list, the search trimmed, and no course", () => {
    expect(toListLessonsParams({ ...ALL_FILTERS, search: "  teclado " }, 10)).toEqual({
      page: 3,
      limit: 10,
      search: "teclado",
      classId: CLASS_ID,
      lessonPlanId: LESSON_PLAN_ID,
      status: "confirmed",
      from: "2026-03-02",
      to: "2026-03-31",
    });
  });

  it("does not send a search of only spaces", () => {
    expect(toListLessonsParams({ ...NO_FILTERS, search: "   " }, 10)).toEqual({
      page: 1,
      limit: 10,
    });
  });
});

describe("toListLessonsCalendarParams", () => {
  const RANGE = { from: "2026-03-01", to: "2026-04-11" };

  it("sends only the days with no filter", () => {
    expect(toListLessonsCalendarParams(NO_FILTERS, RANGE)).toEqual(RANGE);
  });

  it("sends the class, the course, the status and the plan, and not the search, the page or the period of the list", () => {
    expect(toListLessonsCalendarParams(ALL_FILTERS, RANGE)).toEqual({
      ...RANGE,
      classId: CLASS_ID,
      courseId: COURSE_ID,
      lessonPlanId: LESSON_PLAN_ID,
      status: "confirmed",
    });
  });
});

describe("withLessonFilters", () => {
  it("sets a value and takes an empty one out of the URL", () => {
    const url = withLessonFilters(new URLSearchParams("status=done&classId=x"), {
      status: "",
      lessonPlanId: LESSON_PLAN_ID,
    });

    expect(url.get("status")).toBeNull();
    expect(url.get("lessonPlanId")).toBe(LESSON_PLAN_ID);
    expect(url.get("classId")).toBe("x");
  });

  it("sends the list back to page 1 on any change but the page", () => {
    expect(withLessonFilters(new URLSearchParams("page=4"), { status: "done" }).has("page")).toBe(
      false,
    );
    expect(withLessonFilters(new URLSearchParams("page=4"), { page: "5" }).get("page")).toBe("5");
  });

  it("keeps the keys it does not know, such as the view and the date of the calendar", () => {
    const url = withLessonFilters(new URLSearchParams("view=week&date=2026-03-08"), {
      status: "done",
    });

    expect(url.get("view")).toBe("week");
    expect(url.get("date")).toBe("2026-03-08");
  });

  it("does not change the URL it was given", () => {
    const original = new URLSearchParams("status=done");
    withLessonFilters(original, { status: "" });

    expect(original.toString()).toBe("status=done");
  });
});

describe("withoutLessonFilters", () => {
  it("takes every filter and the page out, and keeps the view and the date", () => {
    const params = new URLSearchParams(ALL_QUERY);
    params.set("view", "week");
    params.set("date", "2026-03-08");

    expect(withoutLessonFilters(params).toString()).toBe("view=week&date=2026-03-08");
  });
});
