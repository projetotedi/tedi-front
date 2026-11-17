import { describe, expect, it } from "vitest";

import { isUuid } from "../lib/ids";

describe("isUuid", () => {
  it("accepts the id of a course as the API writes it", () => {
    expect(isUuid("01952ef7-0000-7000-8000-0000000000c1")).toBe(true);
  });

  it.each(["", "computer", "123", "01952ef7-0000-7000-8000-0000000000c", " "])(
    "refuses %j, which cannot be a course of the API",
    (value) => {
      expect(isUuid(value)).toBe(false);
    },
  );
});
