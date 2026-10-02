import { describe, expect, it } from "vitest";

import { formatHours } from "../format";

describe("formatHours", () => {
  it("formats whole hours", () => {
    expect(formatHours(120)).toBe("2h");
    expect(formatHours(3480)).toBe("58h");
  });

  it("formats hours and minutes", () => {
    expect(formatHours(90)).toBe("1h30");
  });

  it("keeps the zero hour when under one hour", () => {
    expect(formatHours(30)).toBe("0h30");
  });

  it("formats zero", () => {
    expect(formatHours(0)).toBe("0h");
  });

  it("pads minutes under ten", () => {
    expect(formatHours(65)).toBe("1h05");
  });

  it("rounds fractional minutes before splitting, so the minutes never reach 60", () => {
    expect(formatHours(89.6)).toBe("1h30");
    expect(formatHours(59.6)).toBe("1h");
  });
});
