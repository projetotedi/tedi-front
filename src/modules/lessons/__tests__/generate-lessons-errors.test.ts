import { describe, expect, it } from "vitest";

import {
  GENERATE_LESSONS_WARNINGS,
  isGenerateLessonsWarning,
  toGenerateLessonsErrorKind,
  type GenerateLessonsErrorKind,
} from "../lib/generate-lessons-errors";

describe("toGenerateLessonsErrorKind", () => {
  it.each([
    [409, "LESSONS_ALREADY_GENERATED", "alreadyGenerated"],
    [409, "COURSE_WITHOUT_SEQUENCE", "courseWithoutSequence"],
    [409, "LESSONS_OUTSIDE_CLASS_PERIOD", "outsideClassPeriod"],
    [409, "CLASS_ARCHIVED", "classArchived"],
    [404, "CLASS_NOT_FOUND", "classNotFound"],
    [400, "INVALID_TIME_RANGE", "invalidTimeRange"],
  ] as const)("reads %s %s as %s", (statusCode, error, kind) => {
    expect(toGenerateLessonsErrorKind({ statusCode, error })).toBe(kind);
  });

  it("reads the error of the HTTP client, which carries the same two fields", () => {
    class ApiError extends Error {
      readonly statusCode = 409;
      readonly error = "LESSONS_ALREADY_GENERATED";
    }

    expect(toGenerateLessonsErrorKind(new ApiError("already"))).toBe("alreadyGenerated");
  });

  it("needs the code together with the status: a 404 that did not come from the API is generic", () => {
    expect(toGenerateLessonsErrorKind({ statusCode: 404, error: "Not Found" })).toBe("unknown");
    expect(toGenerateLessonsErrorKind({ statusCode: 404 })).toBe("unknown");
  });

  it("does not take a code for another status: a 400 CLASS_ARCHIVED is generic", () => {
    expect(toGenerateLessonsErrorKind({ statusCode: 400, error: "CLASS_ARCHIVED" })).toBe(
      "unknown",
    );
    expect(toGenerateLessonsErrorKind({ statusCode: 409, error: "INVALID_TIME_RANGE" })).toBe(
      "unknown",
    );
  });

  it("reads a request that never got an answer (a TypeError of fetch) as the network", () => {
    expect(toGenerateLessonsErrorKind(new TypeError("Failed to fetch"))).toBe("network");
  });

  it.each([502, 503, 504])("reads a %s of a gateway as the network", (statusCode) => {
    expect(toGenerateLessonsErrorKind({ statusCode, error: "Bad Gateway" })).toBe("network");
  });

  it.each([
    [
      "a 403, the permission revoked while the dialog was open",
      { statusCode: 403, error: "FORBIDDEN" },
    ],
    ["a 401", { statusCode: 401 }],
    ["a 500", { statusCode: 500, error: "INTERNAL_SERVER_ERROR" }],
    ["a validation error", { statusCode: 400, error: "VALIDATION_FAILED" }],
  ])("reads %s as the generic error", (_label, error) => {
    expect(toGenerateLessonsErrorKind(error)).toBe("unknown");
  });

  it.each([null, undefined, "boom", 42, {}])(
    "reads %j, which is no API error, as generic",
    (error) => {
      expect(toGenerateLessonsErrorKind(error)).toBe("unknown");
    },
  );
});

describe("GENERATE_LESSONS_WARNINGS", () => {
  it("is the four rules of the system, which are a warning and not a failure", () => {
    expect([...GENERATE_LESSONS_WARNINGS].sort()).toEqual([
      "alreadyGenerated",
      "classArchived",
      "courseWithoutSequence",
      "outsideClassPeriod",
    ]);
  });

  it.each<[GenerateLessonsErrorKind, boolean]>([
    ["alreadyGenerated", true],
    ["courseWithoutSequence", true],
    ["outsideClassPeriod", true],
    ["classArchived", true],
    ["classNotFound", false],
    ["invalidTimeRange", false],
    ["network", false],
    ["unknown", false],
  ])("%s is a warning: %s", (kind, isWarning) => {
    expect(isGenerateLessonsWarning(kind)).toBe(isWarning);
  });
});
