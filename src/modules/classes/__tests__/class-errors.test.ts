import { describe, expect, it } from "vitest";

import { toClassActionError, toClassFormError } from "../lib/class-errors";

const apiError = (statusCode: number, error: string, details?: unknown) => ({
  statusCode,
  error,
  details,
});

describe("class-errors", () => {
  it.each([
    [apiError(409, "CLASS_CODE_TAKEN"), { kind: "field", name: "code", message: "codeTaken" }],
    [apiError(400, "INVALID_PERIOD"), { kind: "field", name: "end", message: "invalidPeriod" }],
    [
      apiError(409, "CAPACITY_BELOW_ENROLLED"),
      { kind: "field", name: "capacity", message: "capacityBelowEnrolled" },
    ],
    [
      apiError(409, "COURSE_CHANGE_NOT_ALLOWED"),
      { kind: "field", name: "courseId", message: "courseChangeNotAllowed" },
    ],
    [
      apiError(400, "VALIDATION_FAILED", [{ field: "editionName", message: "bad" }]),
      { kind: "field", name: "edition", message: "invalidEdition" },
    ],
    [
      apiError(400, "VALIDATION_FAILED", [{ field: "other", message: "bad" }]),
      { kind: "action", error: "unknown" },
    ],
    [apiError(409, "CLASS_ARCHIVED"), { kind: "action", error: "archived" }],
    [apiError(404, "CLASS_NOT_FOUND"), { kind: "action", error: "notFound" }],
    [new TypeError("Failed to fetch"), { kind: "action", error: "network" }],
  ])("puts the refusal %# where it belongs", (error, expected) => {
    expect(toClassFormError(error)).toEqual(expected);
  });

  it("reads the refusals that are not a field's", () => {
    expect(toClassActionError(apiError(409, "CLASS_HAS_ACTIVE_ENROLLMENTS"))).toBe(
      "hasActiveEnrollments",
    );
    expect(toClassActionError(apiError(503, "SERVICE_UNAVAILABLE"))).toBe("network");
    expect(toClassActionError(apiError(500, "INTERNAL"))).toBe("unknown");
    expect(toClassActionError(null)).toBe("unknown");
  });
});
