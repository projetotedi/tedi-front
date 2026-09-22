import { describe, expect, it } from "vitest";

import { toDisplayText } from "../lib/display-text";

describe("toDisplayText", () => {
  it("returns a non-empty string as-is", () => {
    expect(toDisplayText("2024RA0001")).toBe("2024RA0001");
  });

  it("returns the dash placeholder for null", () => {
    expect(toDisplayText(null)).toBe("—");
  });

  it("returns the dash placeholder for an empty string", () => {
    expect(toDisplayText("")).toBe("—");
  });

  it("returns the dash placeholder for the object the Orval/Swagger wart produces", () => {
    expect(toDisplayText({})).toBe("—");
    expect(toDisplayText(undefined)).toBe("—");
  });
});
