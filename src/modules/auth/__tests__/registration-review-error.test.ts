import { describe, expect, it } from "vitest";

import {
  isRegistrationNotFound,
  toRegistrationReviewError,
} from "../lib/registration-review-error";

function apiError(statusCode: number, error?: string, details?: unknown) {
  return Object.assign(new Error("api error"), { statusCode, error, details });
}

describe("toRegistrationReviewError", () => {
  it("maps 409 REGISTRATION_NOT_PENDING to notPending", () => {
    expect(toRegistrationReviewError(apiError(409, "REGISTRATION_NOT_PENDING"))).toEqual({
      kind: "notPending",
    });
  });

  it("maps 404 MEMBER_REGISTRATION_NOT_FOUND to notFound", () => {
    expect(toRegistrationReviewError(apiError(404, "MEMBER_REGISTRATION_NOT_FOUND"))).toEqual({
      kind: "notFound",
    });
  });

  it("does not take a 404 that did not come with the code for a missing registration", () => {
    expect(toRegistrationReviewError(apiError(404, "Not Found"))).toEqual({ kind: "unknown" });
    expect(toRegistrationReviewError(apiError(404))).toEqual({ kind: "unknown" });
  });

  it("maps 400 INVALID_ROLE to the role field", () => {
    expect(toRegistrationReviewError(apiError(400, "INVALID_ROLE"))).toEqual({
      kind: "fields",
      fields: [{ name: "role", message: "roleInvalid" }],
    });
  });

  it("maps 400 DEPARTMENT_NOT_FOUND to the department field", () => {
    expect(toRegistrationReviewError(apiError(400, "DEPARTMENT_NOT_FOUND"))).toEqual({
      kind: "fields",
      fields: [{ name: "departmentId", message: "departmentNotFound" }],
    });
  });

  describe("400 VALIDATION_FAILED", () => {
    const validation = (details?: unknown) => apiError(400, "VALIDATION_FAILED", details);

    it.each([
      ["role", "roleInvalid"],
      ["departmentId", "departmentRequired"],
      ["mainFunction", "mainFunctionInvalid"],
      ["joinedAt", "joinedAtInvalid"],
      ["note", "noteInvalid"],
    ])("marks the %s field with %s", (field, message) => {
      expect(toRegistrationReviewError(validation([{ field, message: "must be valid" }]))).toEqual({
        kind: "fields",
        fields: [{ name: field, message }],
      });
    });

    it("lists every reported field once, in the order of the form", () => {
      const error = validation([
        { field: "note", message: "too long" },
        { field: "joinedAt", message: "must be a date" },
        { field: "joinedAt", message: "must be in range" },
        { field: "role", message: "must be a role" },
      ]);

      expect(toRegistrationReviewError(error)).toEqual({
        kind: "fields",
        fields: [
          { name: "role", message: "roleInvalid" },
          { name: "joinedAt", message: "joinedAtInvalid" },
          { name: "note", message: "noteInvalid" },
        ],
      });
    });

    it("ignores the fields the form does not have and keeps the ones it has", () => {
      const error = validation([
        { field: "unknownField", message: "?" },
        { field: "mainFunction", message: "too long" },
      ]);

      expect(toRegistrationReviewError(error)).toEqual({
        kind: "fields",
        fields: [{ name: "mainFunction", message: "mainFunctionInvalid" }],
      });
    });

    it("falls back to invalidData when no reported field is one of the form", () => {
      expect(
        toRegistrationReviewError(validation([{ field: "unknownField", message: "?" }])),
      ).toEqual({ kind: "invalidData" });
    });

    it("falls back to invalidData without details or with details that are not a list", () => {
      expect(toRegistrationReviewError(validation())).toEqual({ kind: "invalidData" });
      expect(toRegistrationReviewError(validation([]))).toEqual({ kind: "invalidData" });
      expect(toRegistrationReviewError(validation("role"))).toEqual({ kind: "invalidData" });
      expect(toRegistrationReviewError(validation({ field: "role" }))).toEqual({
        kind: "invalidData",
      });
    });

    it("skips the details that are not an object with a text field", () => {
      const error = validation([null, "role", 7, { field: 7 }, { message: "no field" }]);

      expect(toRegistrationReviewError(error)).toEqual({ kind: "invalidData" });
    });
  });

  it("does not read the details of an error that is not a VALIDATION_FAILED", () => {
    const error = apiError(400, "INVALID_ROLE", [{ field: "note", message: "too long" }]);

    expect(toRegistrationReviewError(error)).toEqual({
      kind: "fields",
      fields: [{ name: "role", message: "roleInvalid" }],
    });
  });

  it("maps a network failure (fetch rejects with a TypeError)", () => {
    expect(toRegistrationReviewError(new TypeError("Failed to fetch"))).toEqual({
      kind: "network",
    });
  });

  it.each([502, 503, 504])("maps a %i gateway error to network", (statusCode) => {
    expect(toRegistrationReviewError(apiError(statusCode))).toEqual({ kind: "network" });
  });

  it.each([
    ["a server error", apiError(500, "Internal Server Error")],
    ["a forbidden answer", apiError(403, "Forbidden")],
    ["a 409 with another code", apiError(409, "RA_ALREADY_IN_USE")],
    ["a 400 with another code", apiError(400, "SOMETHING_ELSE")],
    ["an unrelated Error", new Error("boom")],
    ["undefined", undefined],
    ["null", null],
    ["a loose string", "REGISTRATION_NOT_PENDING"],
    ["an empty object", {}],
  ])("falls back to unknown for %s", (_label, error) => {
    expect(toRegistrationReviewError(error)).toEqual({ kind: "unknown" });
  });
});

describe("isRegistrationNotFound", () => {
  it("is true for the 404 of a missing registration", () => {
    expect(isRegistrationNotFound(apiError(404, "MEMBER_REGISTRATION_NOT_FOUND"))).toBe(true);
  });

  it.each([
    ["a 404 from somewhere else", apiError(404, "Not Found")],
    ["the right code with another status", apiError(400, "MEMBER_REGISTRATION_NOT_FOUND")],
    ["a server error", apiError(500)],
    ["a network failure", new TypeError("Failed to fetch")],
    ["undefined", undefined],
  ])("is false for %s", (_label, error) => {
    expect(isRegistrationNotFound(error)).toBe(false);
  });
});
