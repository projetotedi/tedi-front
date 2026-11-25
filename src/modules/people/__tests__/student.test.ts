import { describe, expect, it } from "vitest";

import { AccessibilityNeed } from "@api/generated/model";

import { hasAccessibilityRecord, isStudentId, isStudentNotFound } from "../lib/student";

const STUDENT_ID = "01952ef7-0000-7000-8000-0000000000e1";

function apiError(statusCode: number, error?: string) {
  return Object.assign(new Error(error ?? String(statusCode)), { statusCode, error });
}

describe("isStudentId", () => {
  it.each([
    ["a UUID v7, which is what the API generates", STUDENT_ID],
    ["a UUID v4", "3b241101-e2bb-4255-8caf-4136c566a962"],
    ["a UUID in upper case", STUDENT_ID.toUpperCase()],
  ])("accepts %s", (_label, id) => {
    expect(isStudentId(id)).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["a word", "abc"],
    ["a number", "42"],
    ["a UUID with spaces around it", ` ${STUDENT_ID} `],
    ["a UUID followed by a path", `${STUDENT_ID}/enrollments`],
    ["a UUID with a missing digit", STUDENT_ID.slice(0, -1)],
  ])("rejects %s", (_label, id) => {
    expect(isStudentId(id)).toBe(false);
  });
});

describe("isStudentNotFound", () => {
  it("is true for the 404 STUDENT_NOT_FOUND of the contract", () => {
    expect(isStudentNotFound(apiError(404, "STUDENT_NOT_FOUND"))).toBe(true);
  });

  it.each([
    ["a 404 that is not from the API (no code)", apiError(404)],
    ["a 404 of another resource", apiError(404, "COURSE_NOT_FOUND")],
    ["the code with another status", apiError(500, "STUDENT_NOT_FOUND")],
    ["400 VALIDATION_FAILED", apiError(400, "VALIDATION_FAILED")],
    ["403", apiError(403, "FORBIDDEN")],
    ["500", apiError(500, "INTERNAL_SERVER_ERROR")],
    ["a request that never got an answer", new TypeError("Failed to fetch")],
    ["a string", "STUDENT_NOT_FOUND"],
    ["undefined", undefined],
    ["null", null],
    ["an empty object", {}],
  ])("is false for %s", (_label, error) => {
    expect(isStudentNotFound(error)).toBe(false);
  });
});

describe("hasAccessibilityRecord", () => {
  const empty = {
    accessibilityNeed: AccessibilityNeed.none,
    classNeeds: null,
    supportResource: null,
  };

  it("is false when the category is none and nothing is written", () => {
    expect(hasAccessibilityRecord(empty)).toBe(false);
  });

  it.each(Object.values(AccessibilityNeed).filter((need) => need !== AccessibilityNeed.none))(
    "is true for the category %s, even with nothing written",
    (accessibilityNeed) => {
      expect(hasAccessibilityRecord({ ...empty, accessibilityNeed })).toBe(true);
    },
  );

  it("is true when the category is none but what the person needs in class is written", () => {
    expect(hasAccessibilityRecord({ ...empty, classNeeds: "Sentar perto da tela" })).toBe(true);
  });

  it("is true when the category is none but a support resource is written", () => {
    expect(hasAccessibilityRecord({ ...empty, supportResource: "Lupa" })).toBe(true);
  });

  it.each([
    ["an empty string", ""],
    ["only spaces", "   "],
  ])("does not take %s for something written", (_label, text) => {
    expect(hasAccessibilityRecord({ ...empty, classNeeds: text, supportResource: text })).toBe(
      false,
    );
  });
});
