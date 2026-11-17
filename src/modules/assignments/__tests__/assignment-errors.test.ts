import { describe, expect, it } from "vitest";

import {
  toAssignmentRequestError,
  toCancelAssignmentError,
  toCreateAssignmentError,
  type AssignmentFieldName,
} from "../lib/assignment-errors";

const apiError = (statusCode: number, error?: string, details?: unknown) => ({
  statusCode,
  error,
  message: error ?? "message",
  details,
});

/** The fields of the form with the member to choose, in the order they are on the screen. */
const FORM_FIELDS = ["personId", "lessonId", "role", "status"] as const;
/** The fields of the form opened from the sheet of a member: the member is fixed, so it has no field. */
const FIXED_MEMBER_FIELDS = ["lessonId", "role", "status"] as const;

describe("toCreateAssignmentError", () => {
  describe("409, the rules of the system, as a warning", () => {
    it.each([
      ["DUPLICATE_ROLE_IN_LESSON", "duplicateRole"],
      ["LESSON_TEACHER_TAKEN", "teacherTaken"],
      ["LESSON_CANCELLED", "lessonCancelled"],
      ["MEMBER_INACTIVE", "memberInactive"],
    ])("%s is the warning %s", (code, warning) => {
      expect(toCreateAssignmentError(apiError(409, code), FORM_FIELDS)).toEqual({
        kind: "warning",
        warning,
      });
    });

    it("does not depend on the fields the form has", () => {
      expect(toCreateAssignmentError(apiError(409, "DUPLICATE_ROLE_IN_LESSON"), [])).toEqual({
        kind: "warning",
        warning: "duplicateRole",
      });
    });

    it("a 409 with a code it does not know is the generic alert", () => {
      expect(toCreateAssignmentError(apiError(409, "SOMETHING_ELSE"), FORM_FIELDS)).toEqual({
        kind: "alert",
        alert: "unknown",
      });
      expect(toCreateAssignmentError(apiError(409), FORM_FIELDS)).toEqual({
        kind: "alert",
        alert: "unknown",
      });
    });
  });

  describe("400", () => {
    it("MEMBER_NOT_FOUND is a member field error", () => {
      expect(toCreateAssignmentError(apiError(400, "MEMBER_NOT_FOUND"), FORM_FIELDS)).toEqual({
        kind: "fields",
        fields: [{ name: "personId", message: "memberNotFound" }],
      });
    });

    it("MEMBER_NOT_FOUND is the generic alert when the member is fixed: there is no field to show it on", () => {
      expect(
        toCreateAssignmentError(apiError(400, "MEMBER_NOT_FOUND"), FIXED_MEMBER_FIELDS),
      ).toEqual({ kind: "alert", alert: "unknown" });
    });

    it("VALIDATION_FAILED puts serverInvalid on each field it points at that the form has, in screen order", () => {
      const details = [
        { field: "status", message: "invalid" },
        { field: "personId", message: "invalid" },
        { field: "role", message: "invalid" },
        { field: "status", message: "again" },
      ];

      expect(
        toCreateAssignmentError(apiError(400, "VALIDATION_FAILED", details), FORM_FIELDS),
      ).toEqual({
        kind: "fields",
        fields: [
          { name: "personId", message: "serverInvalid" },
          { name: "role", message: "serverInvalid" },
          { name: "status", message: "serverInvalid" },
        ],
      });
    });

    it("VALIDATION_FAILED leaves out the fields the form does not have", () => {
      const details = [
        { field: "personId", message: "invalid" },
        { field: "role", message: "invalid" },
      ];

      expect(
        toCreateAssignmentError(apiError(400, "VALIDATION_FAILED", details), FIXED_MEMBER_FIELDS),
      ).toEqual({ kind: "fields", fields: [{ name: "role", message: "serverInvalid" }] });
    });

    it.each([
      ["no details", undefined],
      ["details that are not a list", "oops"],
      ["details of fields the form does not have", [{ field: "note", message: "too long" }]],
      ["details that are not fields", [{ nope: true }, null, 7]],
    ])("VALIDATION_FAILED with %s is the generic alert", (_label, details) => {
      expect(
        toCreateAssignmentError(apiError(400, "VALIDATION_FAILED", details), FORM_FIELDS),
      ).toEqual({
        kind: "alert",
        alert: "unknown",
      });
    });
  });

  describe("404", () => {
    it("LESSON_NOT_FOUND is the alert of the lesson that is gone", () => {
      expect(toCreateAssignmentError(apiError(404, "LESSON_NOT_FOUND"), FORM_FIELDS)).toEqual({
        kind: "alert",
        alert: "lessonNotFound",
      });
    });

    it("a 404 that does not come from the API says nothing about the lesson", () => {
      expect(toCreateAssignmentError(apiError(404), FORM_FIELDS)).toEqual({
        kind: "alert",
        alert: "unknown",
      });
    });
  });

  describe("the connection", () => {
    it("a failed connection is network", () => {
      expect(toCreateAssignmentError(new TypeError("Failed to fetch"), FORM_FIELDS)).toEqual({
        kind: "alert",
        alert: "network",
      });
    });

    it.each([502, 503, 504])("a %s from a gateway is network", (statusCode) => {
      expect(toCreateAssignmentError(apiError(statusCode), FORM_FIELDS)).toEqual({
        kind: "alert",
        alert: "network",
      });
    });
  });

  describe("anything else is the generic alert", () => {
    it.each([
      ["a 500", apiError(500, "INTERNAL_SERVER_ERROR")],
      ["a 401", apiError(401)],
      ["a 403", apiError(403, "FORBIDDEN")],
      ["an error with no status", new Error("boom")],
      ["a string", "boom"],
      ["undefined", undefined],
      ["null", null],
    ])("%s", (_label, error) => {
      expect(toCreateAssignmentError(error, FORM_FIELDS)).toEqual({
        kind: "alert",
        alert: "unknown",
      });
    });
  });

  describe("a code with another status is not the refusal it names", () => {
    it.each([
      ["DUPLICATE_ROLE_IN_LESSON", 400],
      ["DUPLICATE_ROLE_IN_LESSON", 500],
      ["LESSON_TEACHER_TAKEN", 404],
      ["LESSON_CANCELLED", 400],
      ["MEMBER_INACTIVE", 404],
      ["MEMBER_NOT_FOUND", 404],
      ["MEMBER_NOT_FOUND", 409],
      ["LESSON_NOT_FOUND", 400],
      ["LESSON_NOT_FOUND", 500],
      ["VALIDATION_FAILED", 409],
    ])("%s with status %i is the generic alert", (code, statusCode) => {
      const details = [{ field: "role", message: "invalid" }];

      expect(toCreateAssignmentError(apiError(statusCode, code, details), FORM_FIELDS)).toEqual({
        kind: "alert",
        alert: "unknown",
      });
    });
  });

  it("takes the focus order from the fields it was given", () => {
    const details = [
      { field: "role", message: "invalid" },
      { field: "personId", message: "invalid" },
    ];
    const reversed: readonly AssignmentFieldName[] = ["role", "personId"];

    expect(toCreateAssignmentError(apiError(400, "VALIDATION_FAILED", details), reversed)).toEqual({
      kind: "fields",
      fields: [
        { name: "role", message: "serverInvalid" },
        { name: "personId", message: "serverInvalid" },
      ],
    });
  });
});

describe("toCancelAssignmentError", () => {
  it("409 ASSIGNMENT_NOT_ACTIVE is a warning: somebody decided it first", () => {
    expect(toCancelAssignmentError(apiError(409, "ASSIGNMENT_NOT_ACTIVE"))).toEqual({
      kind: "warning",
      warning: "assignmentNotActive",
    });
  });

  it("404 ASSIGNMENT_NOT_FOUND is the alert of the assignment that is gone", () => {
    expect(toCancelAssignmentError(apiError(404, "ASSIGNMENT_NOT_FOUND"))).toEqual({
      kind: "alert",
      alert: "assignmentNotFound",
    });
  });

  it("a failed connection and a gateway are network", () => {
    expect(toCancelAssignmentError(new TypeError("Failed to fetch"))).toEqual({
      kind: "alert",
      alert: "network",
    });
    expect(toCancelAssignmentError(apiError(503))).toEqual({ kind: "alert", alert: "network" });
  });

  it.each([
    ["a 500", apiError(500, "INTERNAL_SERVER_ERROR")],
    ["a 403", apiError(403, "FORBIDDEN")],
    ["an error with no status", new Error("boom")],
    ["undefined", undefined],
  ])("%s is the generic alert", (_label, error) => {
    expect(toCancelAssignmentError(error)).toEqual({ kind: "alert", alert: "unknown" });
  });

  it.each([
    ["ASSIGNMENT_NOT_ACTIVE", 404],
    ["ASSIGNMENT_NOT_ACTIVE", 500],
    ["ASSIGNMENT_NOT_FOUND", 409],
    ["ASSIGNMENT_NOT_FOUND", 400],
  ])("%s with status %i is the generic alert", (code, statusCode) => {
    expect(toCancelAssignmentError(apiError(statusCode, code))).toEqual({
      kind: "alert",
      alert: "unknown",
    });
  });
});

describe("toAssignmentRequestError", () => {
  it.each(["FORBIDDEN", "FORBIDDEN_SCOPE"])("403 %s is forbidden", (code) => {
    expect(toAssignmentRequestError(apiError(403, code))).toBe("forbidden");
  });

  it("a 403 with another code is the generic alert", () => {
    expect(toAssignmentRequestError(apiError(403, "SOMETHING_ELSE"))).toBe("unknown");
    expect(toAssignmentRequestError(apiError(403))).toBe("unknown");
  });

  it("404 LESSON_NOT_FOUND is lessonNotFound", () => {
    expect(toAssignmentRequestError(apiError(404, "LESSON_NOT_FOUND"))).toBe("lessonNotFound");
  });

  it("404 MEMBER_NOT_FOUND is the generic alert: the card of the member has no alert of its own for it", () => {
    expect(toAssignmentRequestError(apiError(404, "MEMBER_NOT_FOUND"))).toBe("unknown");
  });

  it("a failed connection and a gateway are network", () => {
    expect(toAssignmentRequestError(new TypeError("Failed to fetch"))).toBe("network");
    expect(toAssignmentRequestError(apiError(502))).toBe("network");
    expect(toAssignmentRequestError(apiError(504))).toBe("network");
  });

  it.each([
    ["a 500", apiError(500, "INTERNAL_SERVER_ERROR")],
    ["an error with no status", new Error("boom")],
    ["undefined", undefined],
  ])("%s is the generic alert", (_label, error) => {
    expect(toAssignmentRequestError(error)).toBe("unknown");
  });

  it("the same code with another status is the generic alert", () => {
    expect(toAssignmentRequestError(apiError(500, "FORBIDDEN"))).toBe("unknown");
    expect(toAssignmentRequestError(apiError(404, "FORBIDDEN_SCOPE"))).toBe("unknown");
    expect(toAssignmentRequestError(apiError(400, "LESSON_NOT_FOUND"))).toBe("unknown");
  });
});
