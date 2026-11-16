import { describe, expect, it } from "vitest";

import { isClassId, isClassNotFound } from "../lib/class-detail";

const CLASS_ID = "01999a3e-7c1b-7000-8000-0000000000c1";

function apiError(statusCode: number, error?: string) {
  return Object.assign(new Error(error ?? String(statusCode)), { statusCode, error });
}

describe("isClassId", () => {
  it.each([
    ["a UUID v7, which is what the API generates", CLASS_ID],
    ["a UUID v4", "3b241101-e2bb-4255-8caf-4136c566a962"],
    ["a UUID in upper case", CLASS_ID.toUpperCase()],
  ])("accepts %s", (_label, id) => {
    expect(isClassId(id)).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["a word", "abc"],
    ["the number of a class of the old list", "1"],
    ["a UUID with spaces around it", ` ${CLASS_ID} `],
    ["a UUID followed by a path", `${CLASS_ID}/enrollments`],
    ["a UUID with a missing digit", CLASS_ID.slice(0, -1)],
  ])("rejects %s", (_label, id) => {
    expect(isClassId(id)).toBe(false);
  });
});

describe("isClassNotFound", () => {
  it("is true for the 404 CLASS_NOT_FOUND of the contract", () => {
    expect(isClassNotFound(apiError(404, "CLASS_NOT_FOUND"))).toBe(true);
  });

  it.each([
    ["a 404 that is not from the API (no code)", apiError(404)],
    ["a 404 of a course", apiError(404, "COURSE_NOT_FOUND")],
    ["the code with another status", apiError(500, "CLASS_NOT_FOUND")],
    ["400 VALIDATION_FAILED", apiError(400, "VALIDATION_FAILED")],
    ["403", apiError(403, "FORBIDDEN")],
    ["500", apiError(500, "INTERNAL_SERVER_ERROR")],
    ["a request that never got an answer", new TypeError("Failed to fetch")],
    ["a string", "CLASS_NOT_FOUND"],
    ["undefined", undefined],
    ["null", null],
    ["an empty object", {}],
  ])("is false for %s", (_label, error) => {
    expect(isClassNotFound(error)).toBe(false);
  });
});
