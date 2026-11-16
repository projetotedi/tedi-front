import { describe, expect, it } from "vitest";

import { toCourseFieldError } from "../lib/class-api-errors";

describe("toCourseFieldError", () => {
  it("409 COURSE_CHANGE_NOT_ALLOWED is the refusal to move the class to another course", () => {
    expect(toCourseFieldError({ statusCode: 409, error: "COURSE_CHANGE_NOT_ALLOWED" })).toBe(
      "courseChangeNotAllowed",
    );
  });

  it("409 COURSE_ARCHIVED is the refusal of a course that takes no new class", () => {
    expect(toCourseFieldError({ statusCode: 409, error: "COURSE_ARCHIVED" })).toBe(
      "courseArchived",
    );
  });

  it("400 COURSE_NOT_FOUND is a course that does not exist", () => {
    expect(toCourseFieldError({ statusCode: 400, error: "COURSE_NOT_FOUND" })).toBe(
      "courseNotFound",
    );
  });

  it("reads the code together with the status: the same code with another status is not the course", () => {
    expect(toCourseFieldError({ statusCode: 400, error: "COURSE_CHANGE_NOT_ALLOWED" })).toBeNull();
    expect(toCourseFieldError({ statusCode: 409, error: "COURSE_NOT_FOUND" })).toBeNull();
    expect(toCourseFieldError({ statusCode: 404, error: "COURSE_ARCHIVED" })).toBeNull();
  });

  it("is null for the other errors of the API", () => {
    expect(toCourseFieldError({ statusCode: 409, error: "CAPACITY_BELOW_ENROLLED" })).toBeNull();
    expect(toCourseFieldError({ statusCode: 400, error: "VALIDATION_FAILED" })).toBeNull();
    expect(toCourseFieldError({ statusCode: 500, error: "INTERNAL_SERVER_ERROR" })).toBeNull();
  });

  it("is null for what is not an error of the API", () => {
    expect(toCourseFieldError(new TypeError("Failed to fetch"))).toBeNull();
    expect(toCourseFieldError(null)).toBeNull();
    expect(toCourseFieldError(undefined)).toBeNull();
    expect(toCourseFieldError("COURSE_ARCHIVED")).toBeNull();
    expect(toCourseFieldError({})).toBeNull();
  });
});
