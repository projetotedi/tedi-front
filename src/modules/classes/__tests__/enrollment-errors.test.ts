import { describe, expect, it } from "vitest";

import { seatsLeftOf, toEnrollmentError } from "../lib/enrollment-errors";

describe("toEnrollmentError", () => {
  it.each([
    [{ statusCode: 409, error: "CLASS_FULL" }, "classFull"],
    [{ statusCode: 409, error: "CLASS_CLOSED" }, "classClosed"],
    [{ statusCode: 409, error: "CLASS_ARCHIVED" }, "classArchived"],
    [{ statusCode: 409, error: "STUDENT_ARCHIVED" }, "studentArchived"],
    [{ statusCode: 400, error: "DUPLICATE_STUDENT" }, "studentNotFound"],
    [{ statusCode: 409, error: "ENROLLMENT_NOT_REMOVABLE" }, "notRemovable"],
    [{ statusCode: 400, error: "EFFECTIVE_DATE_IN_FUTURE" }, "effectiveDateInFuture"],
    [{ statusCode: 503 }, "network"],
    [{ statusCode: 500, error: "INTERNAL" }, "unknown"],
  ])("maps %o to %s", (error, kind) => {
    expect(toEnrollmentError(error)).toBe(kind);
  });

  it("treats a failed fetch as a network error", () => {
    expect(toEnrollmentError(new TypeError("Failed to fetch"))).toBe("network");
  });
});

describe("seatsLeftOf", () => {
  it("reads the seats left of a CLASS_FULL", () => {
    expect(
      seatsLeftOf({ error: "CLASS_FULL", details: [{ field: "studentIds", message: "3" }] }),
    ).toBe(3);
  });

  it("is null for another refusal or without the number", () => {
    expect(seatsLeftOf({ error: "CLASS_CLOSED", details: [{ message: "3" }] })).toBeNull();
    expect(seatsLeftOf({ error: "CLASS_FULL", details: [] })).toBeNull();
    expect(seatsLeftOf({ error: "CLASS_FULL", details: [{ message: "x" }] })).toBeNull();
  });
});
