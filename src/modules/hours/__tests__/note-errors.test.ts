import { describe, expect, it } from "vitest";

import { toNoteError } from "../lib/note-errors";

function apiError(statusCode: number, error: string) {
  return { statusCode, error, message: error, details: [] };
}

describe("toNoteError", () => {
  it("maps 400 VALIDATION_FAILED to invalid", () => {
    expect(toNoteError(apiError(400, "VALIDATION_FAILED"))).toBe("invalid");
  });

  it("maps 403 FORBIDDEN and FORBIDDEN_SCOPE to forbidden", () => {
    expect(toNoteError(apiError(403, "FORBIDDEN"))).toBe("forbidden");
    expect(toNoteError(apiError(403, "FORBIDDEN_SCOPE"))).toBe("forbidden");
  });

  it("maps 404 MEMBER_NOT_FOUND to memberNotFound", () => {
    expect(toNoteError(apiError(404, "MEMBER_NOT_FOUND"))).toBe("memberNotFound");
  });

  it.each([
    ["VALIDATION_FAILED with a 500", apiError(500, "VALIDATION_FAILED")],
    ["FORBIDDEN with a 404", apiError(404, "FORBIDDEN")],
    ["FORBIDDEN_SCOPE with a 400", apiError(400, "FORBIDDEN_SCOPE")],
    ["MEMBER_NOT_FOUND with a 400", apiError(400, "MEMBER_NOT_FOUND")],
    ["a 403 with another code", apiError(403, "SELF_REVIEW_NOT_ALLOWED")],
    ["a 404 with another code", apiError(404, "NOT_FOUND")],
  ])("a code with another status is generic (%s)", (_case, error) => {
    expect(toNoteError(error)).toBe("generic");
  });

  it.each([
    ["a 500", apiError(500, "INTERNAL_ERROR")],
    ["a gateway error", apiError(502, "BAD_GATEWAY")],
    ["a failed connection", new TypeError("Failed to fetch")],
    ["something that is not an error", "boom"],
    ["null", null],
    ["undefined", undefined],
  ])("anything else is generic (%s)", (_case, error) => {
    expect(toNoteError(error)).toBe("generic");
  });
});
