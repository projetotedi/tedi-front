import { describe, expect, it } from "vitest";

import { logHoursIssueDisplay, toLogHoursError } from "../lib/entry-errors";

/** An error as `ApiError` carries it: the status, the code and, for a validation, the fields. */
function apiError(statusCode: number, error?: string, details?: unknown) {
  return { statusCode, error, message: error ?? "Erro", details };
}

describe("toLogHoursError", () => {
  it("puts a 400 VALIDATION_FAILED on the fields it points at, in screen order, declaredMinutes on hours", () => {
    const error = apiError(400, "VALIDATION_FAILED", [
      { field: "notes", message: "notes must be shorter" },
      { field: "declaredMinutes", message: "declaredMinutes must not be greater than 1440" },
      { field: "activity", message: "activity should not be empty" },
      { field: "activity", message: "activity must be a string" },
    ]);

    expect(toLogHoursError(error)).toEqual({
      kind: "fields",
      fields: [
        { name: "activity", message: "serverInvalid" },
        { name: "hours", message: "serverInvalid" },
        { name: "notes", message: "serverInvalid" },
      ],
    });
  });

  it("is unknown when VALIDATION_FAILED points at no field of the form", () => {
    expect(
      toLogHoursError(apiError(400, "VALIDATION_FAILED", [{ field: "classId", message: "x" }])),
    ).toEqual({ kind: "issue", issue: "unknown" });
    expect(toLogHoursError(apiError(400, "VALIDATION_FAILED"))).toEqual({
      kind: "issue",
      issue: "unknown",
    });
    // A detail that is not a field error, or a property of every object, is not a field of the form.
    expect(
      toLogHoursError(
        apiError(400, "VALIDATION_FAILED", ["date", { field: "toString", message: "x" }]),
      ),
    ).toEqual({ kind: "issue", issue: "unknown" });
  });

  it("puts 400 HOUR_ENTRY_DATE_IN_FUTURE on the date", () => {
    expect(toLogHoursError(apiError(400, "HOUR_ENTRY_DATE_IN_FUTURE"))).toEqual({
      kind: "fields",
      fields: [{ name: "date", message: "dateInFuture" }],
    });
  });

  it("tells 400 SELF_ON_BEHALF_NOT_ALLOWED, 403 FORBIDDEN and FORBIDDEN_SCOPE, and 404 MEMBER_NOT_FOUND apart", () => {
    expect(toLogHoursError(apiError(400, "SELF_ON_BEHALF_NOT_ALLOWED"))).toEqual({
      kind: "issue",
      issue: "selfOnBehalf",
    });
    expect(toLogHoursError(apiError(403, "FORBIDDEN"))).toEqual({
      kind: "issue",
      issue: "forbidden",
    });
    expect(toLogHoursError(apiError(403, "FORBIDDEN_SCOPE"))).toEqual({
      kind: "issue",
      issue: "forbidden",
    });
    expect(toLogHoursError(apiError(404, "MEMBER_NOT_FOUND"))).toEqual({
      kind: "issue",
      issue: "memberNotFound",
    });
  });

  it("reads the code with the status: a 404 with no code is unknown", () => {
    expect(toLogHoursError(apiError(404))).toEqual({ kind: "issue", issue: "unknown" });
    expect(toLogHoursError(apiError(409, "MEMBER_NOT_FOUND"))).toEqual({
      kind: "issue",
      issue: "unknown",
    });
    expect(toLogHoursError(apiError(400, "FORBIDDEN"))).toEqual({
      kind: "issue",
      issue: "unknown",
    });
    expect(toLogHoursError(apiError(500, "INTERNAL_SERVER_ERROR"))).toEqual({
      kind: "issue",
      issue: "unknown",
    });
    expect(toLogHoursError(null)).toEqual({ kind: "issue", issue: "unknown" });
    expect(toLogHoursError("Erro")).toEqual({ kind: "issue", issue: "unknown" });
  });

  it("is network for a failed connection and for 502, 503 and 504", () => {
    expect(toLogHoursError(new TypeError("Failed to fetch"))).toEqual({
      kind: "issue",
      issue: "network",
    });
    for (const statusCode of [502, 503, 504]) {
      expect(toLogHoursError(apiError(statusCode)), String(statusCode)).toEqual({
        kind: "issue",
        issue: "network",
      });
    }
  });
});

describe("logHoursIssueDisplay", () => {
  it("shows logging for oneself as a warning and turns the button off for the refusals that would repeat", () => {
    expect(logHoursIssueDisplay("selfOnBehalf")).toEqual({ variant: "warning", blocks: true });
    expect(logHoursIssueDisplay("forbidden")).toEqual({ variant: "error", blocks: true });
    expect(logHoursIssueDisplay("memberNotFound")).toEqual({ variant: "error", blocks: true });
    expect(logHoursIssueDisplay("network")).toEqual({ variant: "error", blocks: false });
    expect(logHoursIssueDisplay("unknown")).toEqual({ variant: "error", blocks: false });
  });
});
