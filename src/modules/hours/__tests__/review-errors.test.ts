import { describe, expect, it } from "vitest";

import { STALE_QUEUE_ERRORS, toReviewError, type ReviewErrorKind } from "../lib/review-errors";

function apiError(statusCode: number, error: string) {
  return { statusCode, error, message: error, details: [] };
}

describe("toReviewError", () => {
  it.each<[string, unknown, ReviewErrorKind]>([
    ["409 ENTRY_NOT_PENDING", apiError(409, "ENTRY_NOT_PENDING"), "notPending"],
    ["409 SELF_REVIEW_NOT_ALLOWED", apiError(409, "SELF_REVIEW_NOT_ALLOWED"), "selfReview"],
    ["404 HOUR_ENTRY_NOT_FOUND (one entry)", apiError(404, "HOUR_ENTRY_NOT_FOUND"), "notFound"],
    ["400 HOUR_ENTRY_NOT_FOUND (batch)", apiError(400, "HOUR_ENTRY_NOT_FOUND"), "notFound"],
    ["400 ADJUSTED_MINUTES_UNCHANGED", apiError(400, "ADJUSTED_MINUTES_UNCHANGED"), "unchanged"],
    ["400 VALIDATION_FAILED", apiError(400, "VALIDATION_FAILED"), "invalid"],
    ["the right code with the wrong status", apiError(400, "ENTRY_NOT_PENDING"), "generic"],
    ["404 with another code", apiError(404, "NOT_FOUND"), "generic"],
    ["403 FORBIDDEN_SCOPE", apiError(403, "FORBIDDEN_SCOPE"), "generic"],
    ["500", apiError(500, "INTERNAL_ERROR"), "generic"],
    ["a failed connection", new TypeError("Failed to fetch"), "generic"],
    ["something that is not an error", "boom", "generic"],
    ["null", null, "generic"],
  ])("reads %s", (_case, error, kind) => {
    expect(toReviewError(error)).toBe(kind);
  });

  it("calls only notPending and notFound a stale queue", () => {
    expect([...STALE_QUEUE_ERRORS].sort()).toEqual(["notFound", "notPending"]);
  });
});
