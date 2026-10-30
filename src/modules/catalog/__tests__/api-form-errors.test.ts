import { describe, expect, it } from "vitest";

import {
  resolveArchiveField,
  resolveLessonPlanField,
  toRequestErrorKind,
  toSubmitError,
} from "../lib/api-form-errors";

function apiError(statusCode: number, error: string, details?: unknown) {
  return Object.assign(new Error(error), { statusCode, error, details });
}

describe("resolveLessonPlanField", () => {
  it.each([
    ["title", "title"],
    ["objective", "objective"],
    ["materialUrl", "materialUrl"],
    ["expectedDurationMinutes", "hours"],
    ["contents", "contents.0.value"],
    ["contents.2", "contents.2.value"],
  ])("maps the server field %s to the form field %s", (serverField, formField) => {
    expect(resolveLessonPlanField(serverField)?.name).toBe(formField);
  });

  it("ignores fields the form does not have", () => {
    expect(resolveLessonPlanField("createdById")).toBeNull();
    expect(resolveLessonPlanField("constructor")).toBeNull();
  });
});

describe("resolveArchiveField", () => {
  it("maps reason and ignores the rest", () => {
    expect(resolveArchiveField("reason")?.name).toBe("reason");
    expect(resolveArchiveField("title")).toBeNull();
  });
});

describe("toSubmitError", () => {
  it("turns VALIDATION_FAILED details into field errors, in the order of the form", () => {
    const error = apiError(400, "VALIDATION_FAILED", [
      { field: "materialUrl", message: "materialUrl must be a URL address" },
      { field: "expectedDurationMinutes", message: "must not be greater than 1440" },
      { field: "title", message: "title should not be empty" },
    ]);

    const result = toSubmitError(error, resolveLessonPlanField);

    expect(result).toEqual({
      kind: "fields",
      fields: [
        { name: "title", message: "serverInvalid" },
        { name: "hours", message: "durationInvalid" },
        { name: "materialUrl", message: "materialUrlInvalid" },
      ],
    });
  });

  it("orders the content rows by index and puts them between the duration and the objective", () => {
    const error = apiError(400, "VALIDATION_FAILED", [
      { field: "objective", message: "too long" },
      { field: "contents.3", message: "empty" },
      { field: "contents.1", message: "empty" },
      { field: "expectedDurationMinutes", message: "min" },
    ]);

    const result = toSubmitError(error, resolveLessonPlanField);

    expect(result.kind === "fields" && result.fields.map((field) => field.name)).toEqual([
      "hours",
      "contents.1.value",
      "contents.3.value",
      "objective",
    ]);
  });

  it("reports each form field once", () => {
    const error = apiError(400, "VALIDATION_FAILED", [
      { field: "contents", message: "each value should not be empty" },
      { field: "contents.0", message: "again" },
    ]);

    const result = toSubmitError(error, resolveLessonPlanField);

    expect(result.kind === "fields" && result.fields).toHaveLength(1);
  });

  it("falls back to unknown when no detail maps to a field", () => {
    const error = apiError(400, "VALIDATION_FAILED", [{ field: "createdById", message: "x" }]);

    expect(toSubmitError(error, resolveLessonPlanField)).toEqual({ kind: "unknown" });
  });

  it("falls back to unknown on VALIDATION_FAILED without details", () => {
    expect(toSubmitError(apiError(400, "VALIDATION_FAILED"), resolveLessonPlanField)).toEqual({
      kind: "unknown",
    });
  });

  it("ignores malformed details", () => {
    const error = apiError(400, "VALIDATION_FAILED", [
      null,
      "title",
      { field: 1, message: "x" },
      { field: "title" },
      { field: "title", message: "title should not be empty" },
    ]);

    expect(toSubmitError(error, resolveLessonPlanField)).toEqual({
      kind: "fields",
      fields: [{ name: "title", message: "serverInvalid" }],
    });
  });

  it("recognizes an archived plan", () => {
    expect(toSubmitError(apiError(409, "LESSON_PLAN_ARCHIVED"), resolveLessonPlanField)).toEqual({
      kind: "archived",
    });
  });

  it("recognizes a missing plan", () => {
    expect(toSubmitError(apiError(404, "LESSON_PLAN_NOT_FOUND"), resolveLessonPlanField)).toEqual({
      kind: "notFound",
    });
  });

  it("treats a fetch failure as a network error", () => {
    expect(toSubmitError(new TypeError("Failed to fetch"), resolveLessonPlanField)).toEqual({
      kind: "network",
    });
  });

  it.each([502, 503, 504])("treats a %i from the gateway as a network error", (status) => {
    expect(toSubmitError(apiError(status, "BAD_GATEWAY"), resolveLessonPlanField)).toEqual({
      kind: "network",
    });
  });

  it.each([
    ["a 500", apiError(500, "INTERNAL_SERVER_ERROR")],
    ["a plain error", new Error("boom")],
    ["a string", "boom"],
    ["null", null],
    ["undefined", undefined],
  ])("treats %s as unknown", (_label, error) => {
    expect(toSubmitError(error, resolveLessonPlanField)).toEqual({ kind: "unknown" });
  });
});

describe("toRequestErrorKind", () => {
  it("never returns field errors", () => {
    expect(
      toRequestErrorKind(apiError(400, "VALIDATION_FAILED", [{ field: "title", message: "x" }])),
    ).toBe("unknown");
  });

  it("keeps the other kinds", () => {
    expect(toRequestErrorKind(apiError(404, "LESSON_PLAN_NOT_FOUND"))).toBe("notFound");
    expect(toRequestErrorKind(new TypeError("Failed to fetch"))).toBe("network");
  });
});
