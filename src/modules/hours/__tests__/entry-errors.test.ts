import { describe, expect, it } from "vitest";

import {
  isStaleEntry,
  logHoursIssueDisplay,
  toLogHoursError,
  toRemoveEntryError,
} from "../lib/entry-errors";

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

describe("toRemoveEntryError", () => {
  it("is a warning for 409 ENTRY_NOT_PENDING and 409 ATTENDANCE_ENTRY_NOT_REMOVABLE", () => {
    expect(toRemoveEntryError(apiError(409, "ENTRY_NOT_PENDING"))).toEqual({
      kind: "warning",
      warning: "notPending",
    });
    expect(toRemoveEntryError(apiError(409, "ATTENDANCE_ENTRY_NOT_REMOVABLE"))).toEqual({
      kind: "warning",
      warning: "attendance",
    });
  });

  it("is an alert for 404 HOUR_ENTRY_NOT_FOUND", () => {
    expect(toRemoveEntryError(apiError(404, "HOUR_ENTRY_NOT_FOUND"))).toEqual({
      kind: "alert",
      alert: "notFound",
    });
  });

  it("is unknown for a known code with another status, and network for a failed connection", () => {
    expect(toRemoveEntryError(apiError(400, "ENTRY_NOT_PENDING"))).toEqual({
      kind: "alert",
      alert: "unknown",
    });
    expect(toRemoveEntryError(apiError(409, "HOUR_ENTRY_NOT_FOUND"))).toEqual({
      kind: "alert",
      alert: "unknown",
    });
    expect(toRemoveEntryError(apiError(404))).toEqual({ kind: "alert", alert: "unknown" });
    expect(toRemoveEntryError(new TypeError("Failed to fetch"))).toEqual({
      kind: "alert",
      alert: "network",
    });
    expect(toRemoveEntryError(apiError(503))).toEqual({ kind: "alert", alert: "network" });
  });

  it("says the entry changed meanwhile for the warnings and the entry that is gone, and not for the network", () => {
    expect(isStaleEntry({ kind: "warning", warning: "notPending" })).toBe(true);
    expect(isStaleEntry({ kind: "warning", warning: "attendance" })).toBe(true);
    expect(isStaleEntry({ kind: "alert", alert: "notFound" })).toBe(true);
    expect(isStaleEntry({ kind: "alert", alert: "network" })).toBe(false);
    expect(isStaleEntry({ kind: "alert", alert: "unknown" })).toBe(false);
  });
});

describe("toLogHoursError — the link (GUS-174)", () => {
  it.each([
    [{ statusCode: 400, error: "LESSON_NOT_IN_CLASS" }, "lessonId", "lessonNotInClass"],
    [{ statusCode: 400, error: "LESSON_NOT_FOUND" }, "lessonId", "linkNotFound"],
    [{ statusCode: 400, error: "CLASS_NOT_FOUND" }, "classId", "linkNotFound"],
    [{ statusCode: 409, error: "LESSON_CANCELLED" }, "lessonId", "lessonCancelled"],
    [{ statusCode: 409, error: "CLASS_ARCHIVED" }, "classId", "classArchived"],
    [
      { statusCode: 409, error: "CLASS_ARCHIVED", details: [{ field: "lessonId", message: "x" }] },
      "lessonId",
      "classArchived",
    ],
  ])("puts %o on %s", (error, name, message) => {
    expect(toLogHoursError(error)).toEqual({ kind: "fields", fields: [{ name, message }] });
  });
});
