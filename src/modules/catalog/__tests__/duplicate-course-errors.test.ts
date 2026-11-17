import { describe, expect, it } from "vitest";

import {
  DUPLICATE_COURSE_FIELD_ERRORS,
  isDuplicateCourseFieldError,
  toDuplicateCourseErrorKind,
  type DuplicateCourseErrorKind,
} from "../lib/duplicate-course-errors";

function apiError(statusCode: number, error?: string, details?: unknown) {
  return Object.assign(new Error(error ?? String(statusCode)), { statusCode, error, details });
}

const NAME_DETAIL = { field: "name", message: "name must be shorter than or equal to 200" };

describe("toDuplicateCourseErrorKind", () => {
  it.each([
    ["409 COURSE_NAME_TAKEN", apiError(409, "COURSE_NAME_TAKEN"), "nameTaken"],
    [
      "400 VALIDATION_FAILED pointing at name",
      apiError(400, "VALIDATION_FAILED", [NAME_DETAIL]),
      "nameInvalid",
    ],
    [
      "400 VALIDATION_FAILED pointing at name among other fields",
      apiError(400, "VALIDATION_FAILED", [{ field: "other", message: "invalid" }, NAME_DETAIL]),
      "nameInvalid",
    ],
    ["404 COURSE_NOT_FOUND", apiError(404, "COURSE_NOT_FOUND"), "courseNotFound"],
    ["a request that never got an answer", new TypeError("Failed to fetch"), "network"],
    ["502", apiError(502, "BAD_GATEWAY"), "network"],
    ["503", apiError(503, "SERVICE_UNAVAILABLE"), "network"],
    ["504", apiError(504, "GATEWAY_TIMEOUT"), "network"],
    ["500", apiError(500, "INTERNAL_SERVER_ERROR"), "unknown"],
    ["403", apiError(403, "FORBIDDEN"), "unknown"],
    ["401", apiError(401, "UNAUTHORIZED"), "unknown"],
  ] satisfies Array<[string, unknown, DuplicateCourseErrorKind]>)(
    "maps %s to %s",
    (_label, error, expected) => {
      expect(toDuplicateCourseErrorKind(error)).toBe(expected);
    },
  );

  describe("what has no field to point at", () => {
    it("is generic for a 400 VALIDATION_FAILED without details", () => {
      expect(toDuplicateCourseErrorKind(apiError(400, "VALIDATION_FAILED"))).toBe("unknown");
      expect(toDuplicateCourseErrorKind(apiError(400, "VALIDATION_FAILED", []))).toBe("unknown");
    });

    it("is generic for a 400 VALIDATION_FAILED that points only at another field", () => {
      const error = apiError(400, "VALIDATION_FAILED", [
        { field: "id", message: "must be a UUID" },
      ]);

      expect(toDuplicateCourseErrorKind(error)).toBe("unknown");
    });

    it("is generic for details that are not the shape of a field error", () => {
      expect(toDuplicateCourseErrorKind(apiError(400, "VALIDATION_FAILED", ["name"]))).toBe(
        "unknown",
      );
      expect(
        toDuplicateCourseErrorKind(apiError(400, "VALIDATION_FAILED", { field: "name" })),
      ).toBe("unknown");
    });
  });

  describe("the status is read together with the code", () => {
    it("does not take a 404 that did not come from the API for a course that does not exist", () => {
      expect(toDuplicateCourseErrorKind(apiError(404, "Not Found"))).toBe("unknown");
      expect(toDuplicateCourseErrorKind(apiError(404))).toBe("unknown");
    });

    it("does not take the 404 of a lesson plan for a course that does not exist", () => {
      expect(toDuplicateCourseErrorKind(apiError(404, "LESSON_PLAN_NOT_FOUND"))).toBe("unknown");
    });

    it("does not take another 409 for a name that is taken", () => {
      expect(toDuplicateCourseErrorKind(apiError(409, "COURSE_ARCHIVED"))).toBe("unknown");
      expect(toDuplicateCourseErrorKind(apiError(409, "LESSON_PLAN_ARCHIVED"))).toBe("unknown");
      expect(toDuplicateCourseErrorKind(apiError(409))).toBe("unknown");
    });

    it("does not take the code of one status for another", () => {
      expect(toDuplicateCourseErrorKind(apiError(400, "COURSE_NAME_TAKEN"))).toBe("unknown");
      expect(toDuplicateCourseErrorKind(apiError(500, "COURSE_NAME_TAKEN"))).toBe("unknown");
      expect(toDuplicateCourseErrorKind(apiError(409, "VALIDATION_FAILED", [NAME_DETAIL]))).toBe(
        "unknown",
      );
      expect(toDuplicateCourseErrorKind(apiError(500, "COURSE_NOT_FOUND"))).toBe("unknown");
    });
  });

  it.each([
    ["a string", "boom"],
    ["undefined", undefined],
    ["null", null],
    ["an empty object", {}],
  ])("falls back to unknown for %s", (_label, error) => {
    expect(toDuplicateCourseErrorKind(error)).toBe("unknown");
  });
});

describe("isDuplicateCourseFieldError", () => {
  it("lists the two errors that go on the name field", () => {
    expect(DUPLICATE_COURSE_FIELD_ERRORS).toEqual(["nameTaken", "nameInvalid"]);
  });

  it.each([
    ["nameTaken", true],
    ["nameInvalid", true],
    ["courseNotFound", false],
    ["network", false],
    ["unknown", false],
  ] satisfies Array<[DuplicateCourseErrorKind, boolean]>)(
    "says %s is a field error: %s",
    (kind, expected) => {
      expect(isDuplicateCourseFieldError(kind)).toBe(expected);
    },
  );
});
