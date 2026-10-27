import { describe, expect, it } from "vitest";

import { isLessonPlanId } from "../lib/lesson-plan-id";

describe("isLessonPlanId", () => {
  it.each([
    ["a UUID v7, which is what the API generates", "01952ef7-0000-7000-8000-0000000000a1"],
    ["a UUID v4", "3b241101-e2bb-4255-8caf-4136c566a962"],
    ["a UUID in upper case", "01952EF7-0000-7000-8000-0000000000A1"],
  ])("accepts %s", (_label, id) => {
    expect(isLessonPlanId(id)).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["a word", "abc"],
    ["the id of a mocked row of the list", "lesson-plan-04"],
    ["a UUID with spaces around it", " 01952ef7-0000-7000-8000-0000000000a1 "],
    ["a UUID followed by a path", "01952ef7-0000-7000-8000-0000000000a1/usage"],
    ["a UUID with a missing digit", "01952ef7-0000-7000-8000-0000000000a"],
  ])("rejects %s", (_label, id) => {
    expect(isLessonPlanId(id)).toBe(false);
  });
});
