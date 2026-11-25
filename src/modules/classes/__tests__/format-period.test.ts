import { describe, expect, it } from "vitest";

import { formatPeriod } from "../lib/format-period";

describe("formatPeriod", () => {
  it("writes the two dates of the period in the short format of pt-BR", () => {
    expect(formatPeriod("2026-03-03", "2026-05-27", "pt-BR")).toBe("03/03/26 - 27/05/26");
  });

  it("keeps the day the API said, with no shift by the time zone", () => {
    expect(formatPeriod("2026-01-01", "2026-12-31", "pt-BR")).toBe("01/01/26 - 31/12/26");
  });

  it("shows the year of each end when the period crosses the new year", () => {
    expect(formatPeriod("2025-12-12", "2026-02-01", "pt-BR")).toBe("12/12/25 - 01/02/26");
  });

  it("follows the language of the screen", () => {
    expect(formatPeriod("2026-03-03", "2026-05-27", "en-US")).toBe("03/03/26 - 05/27/26");
  });

  it("is one date twice when the class lasts a single day", () => {
    expect(formatPeriod("2026-03-03", "2026-03-03", "pt-BR")).toBe("03/03/26 - 03/03/26");
  });
});
