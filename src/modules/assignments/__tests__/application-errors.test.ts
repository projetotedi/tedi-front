import { describe, expect, it } from "vitest";

import { toApplySubmitError, toReviewError } from "../lib/application-errors";

const apiError = (statusCode: number, error?: string, details?: unknown) => ({
  statusCode,
  error,
  message: error ?? "message",
  details,
});

describe("toApplySubmitError", () => {
  it.each([
    [409, "ROLE_FULL", "roleFull"],
    [409, "ALREADY_APPLIED", "alreadyApplied"],
    [409, "LESSON_IN_PAST", "lessonClosed"],
    [409, "LESSON_CANCELLED", "lessonClosed"],
    [409, "MEMBER_INACTIVE", "memberInactive"],
    [404, "LESSON_NOT_FOUND", "lessonNotFound"],
  ])("%i %s is %s", (status, code, kind) => {
    expect(toApplySubmitError(apiError(status, code))).toEqual({ kind });
  });

  describe("400 VALIDATION_FAILED", () => {
    it("puts serverInvalid on each field it points at that the form has, once, in screen order", () => {
      const details = [
        { field: "note", message: "too long" },
        { field: "role", message: "must be one of" },
        { field: "role", message: "again" },
        { field: "lessonId", message: "not a form field" },
      ];

      expect(toApplySubmitError(apiError(400, "VALIDATION_FAILED", details))).toEqual({
        kind: "fields",
        fields: [
          { name: "role", message: "serverInvalid" },
          { name: "note", message: "serverInvalid" },
        ],
      });
    });

    it("is the generic error when it points at no field of the form", () => {
      expect(
        toApplySubmitError(
          apiError(400, "VALIDATION_FAILED", [{ field: "lessonId", message: "x" }]),
        ),
      ).toEqual({ kind: "unknown" });
      expect(toApplySubmitError(apiError(400, "VALIDATION_FAILED"))).toEqual({ kind: "unknown" });
      expect(toApplySubmitError(apiError(400, "VALIDATION_FAILED", "not a list"))).toEqual({
        kind: "unknown",
      });
    });

    it("ignores the details that are not a field and a message", () => {
      expect(
        toApplySubmitError(
          apiError(400, "VALIDATION_FAILED", [null, "role", { field: "role" }, { message: "x" }]),
        ),
      ).toEqual({ kind: "unknown" });
    });
  });

  it("reads the code together with the status: the same code with another status is not that refusal", () => {
    expect(toApplySubmitError(apiError(400, "ROLE_FULL"))).toEqual({ kind: "unknown" });
    expect(toApplySubmitError(apiError(404, "ALREADY_APPLIED"))).toEqual({ kind: "unknown" });
    expect(toApplySubmitError(apiError(409, "LESSON_NOT_FOUND"))).toEqual({ kind: "unknown" });
    expect(toApplySubmitError(apiError(500, "LESSON_IN_PAST"))).toEqual({ kind: "unknown" });
  });

  it("a 404 with no code, as a gateway answers, says nothing about the lesson", () => {
    expect(toApplySubmitError(apiError(404))).toEqual({ kind: "unknown" });
  });

  it.each([502, 503, 504])("a gateway %i is a network failure", (status) => {
    expect(toApplySubmitError(apiError(status))).toEqual({ kind: "network" });
  });

  it("a failed connection (TypeError) is a network failure", () => {
    expect(toApplySubmitError(new TypeError("Failed to fetch"))).toEqual({ kind: "network" });
  });

  it.each([400, 401, 403, 500])("%i with no known code is the generic error", (status) => {
    expect(toApplySubmitError(apiError(status))).toEqual({ kind: "unknown" });
  });

  it.each([undefined, null, "boom", 42, new Error("x")])(
    "a value that is not an API error (%s) is the generic error",
    (value) => {
      expect(toApplySubmitError(value)).toEqual({ kind: "unknown" });
    },
  );
});

describe("toReviewError", () => {
  it.each([
    [409, "ROLE_FULL", "roleFull"],
    [409, "APPLICATION_NOT_PENDING", "notPending"],
    [404, "APPLICATION_NOT_FOUND", "notFound"],
    [409, "LESSON_CANCELLED", "lessonCancelled"],
    [409, "MEMBER_INACTIVE", "memberInactive"],
  ])("%i %s is %s", (status, code, kind) => {
    expect(toReviewError(apiError(status, code))).toBe(kind);
  });

  it("reads the code together with the status", () => {
    expect(toReviewError(apiError(404, "ROLE_FULL"))).toBe("unknown");
    expect(toReviewError(apiError(409, "APPLICATION_NOT_FOUND"))).toBe("unknown");
    expect(toReviewError(apiError(400, "APPLICATION_NOT_PENDING"))).toBe("unknown");
    expect(toReviewError(apiError(404))).toBe("unknown");
  });

  it.each([502, 503, 504])("a gateway %i is a network failure", (status) => {
    expect(toReviewError(apiError(status))).toBe("network");
  });

  it("a failed connection (TypeError) is a network failure", () => {
    expect(toReviewError(new TypeError("Failed to fetch"))).toBe("network");
  });

  it.each([401, 403, 500])("%i with no known code is the generic error", (status) => {
    expect(toReviewError(apiError(status))).toBe("unknown");
  });

  it.each([undefined, null, "boom", new Error("x")])(
    "a value that is not an API error (%s) is the generic error",
    (value) => {
      expect(toReviewError(value)).toBe("unknown");
    },
  );
});
