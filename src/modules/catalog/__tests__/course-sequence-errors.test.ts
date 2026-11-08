import { describe, expect, it } from "vitest";

import { toSequenceErrorKind } from "../lib/course-sequence-errors";

function apiError(statusCode: number, error?: string) {
  return Object.assign(new Error(error ?? String(statusCode)), { statusCode, error });
}

describe("toSequenceErrorKind", () => {
  it.each([
    ["400 DUPLICATE_LESSON_PLAN", apiError(400, "DUPLICATE_LESSON_PLAN"), "duplicate"],
    ["409 COURSE_ARCHIVED", apiError(409, "COURSE_ARCHIVED"), "courseArchived"],
    ["400 LESSON_PLAN_ARCHIVED", apiError(400, "LESSON_PLAN_ARCHIVED"), "planArchived"],
    ["400 LESSON_PLAN_NOT_FOUND", apiError(400, "LESSON_PLAN_NOT_FOUND"), "planNotFound"],
    [
      "400 VALIDATION_FAILED (an id that is not a UUID)",
      apiError(400, "VALIDATION_FAILED"),
      "planNotFound",
    ],
    ["404 COURSE_NOT_FOUND", apiError(404, "COURSE_NOT_FOUND"), "courseNotFound"],
    ["a 404 with another code", apiError(404, "NOT_FOUND"), "courseNotFound"],
    ["404 LESSON_PLAN_NOT_FOUND", apiError(404, "LESSON_PLAN_NOT_FOUND"), "courseNotFound"],
    ["502", apiError(502, "BAD_GATEWAY"), "network"],
    ["503", apiError(503, "SERVICE_UNAVAILABLE"), "network"],
    ["504", apiError(504, "GATEWAY_TIMEOUT"), "network"],
    ["a request that never got an answer", new TypeError("Failed to fetch"), "network"],
    ["500", apiError(500, "INTERNAL_SERVER_ERROR"), "unknown"],
    ["403", apiError(403, "FORBIDDEN"), "unknown"],
  ])("maps %s to %s", (_label, error, expected) => {
    expect(toSequenceErrorKind(error)).toBe(expected);
  });

  it("does not take the 409 of the lesson plan routes for an archived course", () => {
    expect(toSequenceErrorKind(apiError(409, "LESSON_PLAN_ARCHIVED"))).toBe("unknown");
  });

  it("reads the status together with the code: the same code with another status is unknown", () => {
    expect(toSequenceErrorKind(apiError(500, "DUPLICATE_LESSON_PLAN"))).toBe("unknown");
    expect(toSequenceErrorKind(apiError(400, "COURSE_ARCHIVED"))).toBe("unknown");
  });

  it.each([
    ["a string", "boom"],
    ["undefined", undefined],
    ["null", null],
    ["an empty object", {}],
  ])("falls back to unknown for %s", (_label, error) => {
    expect(toSequenceErrorKind(error)).toBe("unknown");
  });
});
