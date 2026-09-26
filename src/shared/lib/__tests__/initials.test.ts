import { describe, expect, it } from "vitest";

import { getInitials } from "../initials";

describe("getInitials", () => {
  it("uses the first letter of the first and last names", () => {
    expect(getInitials("Beatriz Nunes")).toBe("BN");
    expect(getInitials("Ana Paula Torres")).toBe("AT");
  });

  it("uses the first two letters of a single word", () => {
    expect(getInitials("Coordenadora")).toBe("CO");
  });

  it("ignores extra spaces and upper-cases accented letters", () => {
    expect(getInitials("  ícaro   álvares ")).toBe("ÍÁ");
  });

  it("returns an empty string for an empty name", () => {
    expect(getInitials("   ")).toBe("");
  });
});
