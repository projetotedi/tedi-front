import { describe, expect, it } from "vitest";

import {
  CANCEL_LESSON_FIELDS,
  CREATE_LESSON_FIELDS,
  EDIT_LESSON_FIELDS,
  RESCHEDULE_LESSON_FIELDS,
  toLessonRequestError,
  toLessonSubmitError,
} from "../lib/lesson-errors";

const apiError = (statusCode: number, error?: string, details?: unknown) => ({
  statusCode,
  error,
  message: error ?? "message",
  details,
});

describe("toLessonSubmitError", () => {
  describe("400", () => {
    it("LESSON_OUTSIDE_CLASS_PERIOD is a date field error", () => {
      expect(
        toLessonSubmitError(apiError(400, "LESSON_OUTSIDE_CLASS_PERIOD"), CREATE_LESSON_FIELDS),
      ).toEqual({ kind: "fields", fields: [{ name: "date", message: "outsideClassPeriod" }] });
      expect(
        toLessonSubmitError(apiError(400, "LESSON_OUTSIDE_CLASS_PERIOD"), RESCHEDULE_LESSON_FIELDS),
      ).toEqual({ kind: "fields", fields: [{ name: "date", message: "outsideClassPeriod" }] });
    });

    it("INVALID_TIME_RANGE is an end time field error", () => {
      expect(
        toLessonSubmitError(apiError(400, "INVALID_TIME_RANGE"), CREATE_LESSON_FIELDS),
      ).toEqual({ kind: "fields", fields: [{ name: "endTime", message: "invalidTimeRange" }] });
    });

    it.each([
      "LESSON_PLAN_ARCHIVED",
      "LESSON_PLAN_NOT_FOUND",
      "LESSON_PLAN_NOT_IN_COURSE_SEQUENCE",
    ])("%s is a lesson plan field error", (code) => {
      expect(toLessonSubmitError(apiError(400, code), CREATE_LESSON_FIELDS)).toEqual({
        kind: "fields",
        fields: [{ name: "lessonPlanId", message: "lessonPlanUnavailable" }],
      });
    });

    it("a field the form does not have is the generic error: the date of a lesson being edited is read-only", () => {
      expect(
        toLessonSubmitError(apiError(400, "LESSON_OUTSIDE_CLASS_PERIOD"), EDIT_LESSON_FIELDS),
      ).toEqual({ kind: "unknown" });
      expect(toLessonSubmitError(apiError(400, "INVALID_TIME_RANGE"), EDIT_LESSON_FIELDS)).toEqual({
        kind: "unknown",
      });
      expect(
        toLessonSubmitError(apiError(400, "LESSON_PLAN_ARCHIVED"), RESCHEDULE_LESSON_FIELDS),
      ).toEqual({ kind: "unknown" });
    });

    it("VALIDATION_FAILED puts serverInvalid on each field it points at that the form has, in screen order", () => {
      const details = [
        { field: "subject", message: "too long" },
        { field: "title", message: "must not be empty" },
        { field: "title", message: "again" },
        { field: "classId", message: "not a form field" },
      ];

      expect(
        toLessonSubmitError(apiError(400, "VALIDATION_FAILED", details), CREATE_LESSON_FIELDS),
      ).toEqual({
        kind: "fields",
        fields: [
          { name: "title", message: "serverInvalid" },
          { name: "subject", message: "serverInvalid" },
        ],
      });
    });

    it("VALIDATION_FAILED on the reason of a cancellation is a reason field error", () => {
      expect(
        toLessonSubmitError(
          apiError(400, "VALIDATION_FAILED", [{ field: "reason", message: "blank" }]),
          CANCEL_LESSON_FIELDS,
        ),
      ).toEqual({ kind: "fields", fields: [{ name: "reason", message: "serverInvalid" }] });
    });

    it.each([
      ["no details", undefined],
      ["details of fields the form does not have", [{ field: "classId", message: "invalid" }]],
      ["details that are not field details", ["classId", 3, null]],
    ])("VALIDATION_FAILED with %s is the generic error", (_label, details) => {
      expect(
        toLessonSubmitError(apiError(400, "VALIDATION_FAILED", details), CREATE_LESSON_FIELDS),
      ).toEqual({ kind: "unknown" });
    });

    it("CLASS_NOT_FOUND is the class alert", () => {
      expect(toLessonSubmitError(apiError(400, "CLASS_NOT_FOUND"), CREATE_LESSON_FIELDS)).toEqual({
        kind: "classNotFound",
      });
    });
  });

  describe("404 and 409", () => {
    it("404 LESSON_NOT_FOUND is the lesson alert", () => {
      expect(toLessonSubmitError(apiError(404, "LESSON_NOT_FOUND"), EDIT_LESSON_FIELDS)).toEqual({
        kind: "lessonNotFound",
      });
    });

    it("a 404 with no code is the generic error: it does not come from the API", () => {
      expect(toLessonSubmitError(apiError(404), EDIT_LESSON_FIELDS)).toEqual({ kind: "unknown" });
    });

    it("409 LESSON_CANCELLED is lessonCancelled", () => {
      expect(toLessonSubmitError(apiError(409, "LESSON_CANCELLED"), EDIT_LESSON_FIELDS)).toEqual({
        kind: "lessonCancelled",
      });
    });

    it("409 CLASS_ARCHIVED is classArchived", () => {
      expect(toLessonSubmitError(apiError(409, "CLASS_ARCHIVED"), CREATE_LESSON_FIELDS)).toEqual({
        kind: "classArchived",
      });
    });

    it("a 409 with another code is the generic error", () => {
      expect(toLessonSubmitError(apiError(409, "SOMETHING_ELSE"), EDIT_LESSON_FIELDS)).toEqual({
        kind: "unknown",
      });
    });
  });

  it("reads the code together with the status: the same code with another status is not that refusal", () => {
    expect(
      toLessonSubmitError(apiError(409, "LESSON_OUTSIDE_CLASS_PERIOD"), CREATE_LESSON_FIELDS),
    ).toEqual({ kind: "unknown" });
    expect(toLessonSubmitError(apiError(400, "LESSON_CANCELLED"), EDIT_LESSON_FIELDS)).toEqual({
      kind: "unknown",
    });
    expect(toLessonSubmitError(apiError(404, "CLASS_ARCHIVED"), EDIT_LESSON_FIELDS)).toEqual({
      kind: "unknown",
    });
    expect(toLessonSubmitError(apiError(409, "LESSON_NOT_FOUND"), EDIT_LESSON_FIELDS)).toEqual({
      kind: "unknown",
    });
  });

  describe("network", () => {
    it("a failed connection (TypeError) is network", () => {
      expect(toLessonSubmitError(new TypeError("Failed to fetch"), CREATE_LESSON_FIELDS)).toEqual({
        kind: "network",
      });
    });

    it.each([502, 503, 504])("a %s from the gateway is network", (statusCode) => {
      expect(toLessonSubmitError(apiError(statusCode), CREATE_LESSON_FIELDS)).toEqual({
        kind: "network",
      });
    });
  });

  it.each([
    ["a 500", apiError(500, "INTERNAL_SERVER_ERROR")],
    ["a 403", apiError(403, "FORBIDDEN")],
    ["a 401", apiError(401)],
    ["an error with no shape of the API", new Error("boom")],
    ["null", null],
    ["undefined", undefined],
    ["a string", "LESSON_CANCELLED"],
  ])("%s is the generic error", (_label, error) => {
    expect(toLessonSubmitError(error, CREATE_LESSON_FIELDS)).toEqual({ kind: "unknown" });
  });
});

describe("the fields of each form", () => {
  it("the create form shows every field but the status and the post-lesson notes", () => {
    expect(CREATE_LESSON_FIELDS).not.toContain("status");
    expect(CREATE_LESSON_FIELDS).not.toContain("postNotes");
    expect(CREATE_LESSON_FIELDS).toContain("lessonPlanId");
  });

  it("the edit form has no field for what is read-only there", () => {
    for (const locked of ["lessonPlanId", "date", "startTime", "endTime"]) {
      expect(EDIT_LESSON_FIELDS).not.toContain(locked);
    }
  });
});

describe("toLessonRequestError", () => {
  it("gives the alert of the error, never a field", () => {
    expect(toLessonRequestError(apiError(404, "LESSON_NOT_FOUND"))).toBe("lessonNotFound");
    expect(toLessonRequestError(new TypeError("Failed to fetch"))).toBe("network");
    expect(toLessonRequestError(apiError(500))).toBe("unknown");
    expect(toLessonRequestError(apiError(400, "VALIDATION_FAILED"))).toBe("unknown");
    expect(toLessonRequestError(apiError(400, "INVALID_TIME_RANGE"))).toBe("unknown");
  });
});
