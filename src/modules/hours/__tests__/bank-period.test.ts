import { describe, expect, it } from "vitest";

import {
  currentPeriod,
  periodParts,
  periodRange,
  periodsBetween,
  resolvePeriod,
  shiftPeriod,
} from "../lib/bank-period";

const MID_MARCH = new Date(2026, 2, 16, 12);

describe("bank period", () => {
  it("currentPeriod is the local month", () => {
    expect(currentPeriod(MID_MARCH)).toBe("2026-03");
    expect(currentPeriod(new Date(2026, 0, 1, 0, 0))).toBe("2026-01");
    expect(currentPeriod(new Date(2025, 11, 31, 23, 59))).toBe("2025-12");
  });

  it("resolvePeriod keeps a valid month and falls back to the current one for a malformed, future or pre-2000 value", () => {
    expect(resolvePeriod("2026-02", MID_MARCH)).toBe("2026-02");
    expect(resolvePeriod("2026-03", MID_MARCH)).toBe("2026-03");
    expect(resolvePeriod("2000-01", MID_MARCH)).toBe("2000-01");

    for (const value of [null, "", "2026-3", "2026-13", "2026-00", "março", "2026-02-01"]) {
      expect(resolvePeriod(value, MID_MARCH), String(value)).toBe("2026-03");
    }
    expect(resolvePeriod("2026-04", MID_MARCH)).toBe("2026-03");
    expect(resolvePeriod("1999-12", MID_MARCH)).toBe("2026-03");
  });

  it("periodRange covers the whole month, February of a leap year included", () => {
    expect(periodRange("2026-03")).toEqual({ from: "2026-03-01", to: "2026-03-31" });
    expect(periodRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(periodRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(periodRange("2026-04")).toEqual({ from: "2026-04-01", to: "2026-04-30" });
  });

  it("periodsBetween lists every month, newest first", () => {
    expect(periodsBetween("2025-11", "2026-02")).toEqual([
      "2026-02",
      "2026-01",
      "2025-12",
      "2025-11",
    ]);
    expect(periodsBetween("2026-03", "2026-03")).toEqual(["2026-03"]);
    expect(periodsBetween("2026-04", "2026-03")).toEqual(["2026-03"]);
    expect(periodsBetween("", "2026-03")).toEqual(["2026-03"]);
    expect(periodsBetween("1999-12", "2026-03")).toEqual(["2026-03"]);
  });

  it("shiftPeriod moves by months, across the years", () => {
    expect(shiftPeriod("2026-03", -3)).toBe("2025-12");
    expect(shiftPeriod("2026-03", -23)).toBe("2024-04");
    expect(shiftPeriod("2025-12", 1)).toBe("2026-01");
    expect(shiftPeriod("2026-03", 0)).toBe("2026-03");
  });

  it("periodParts gives Março/2026 in pt-BR and March/2026 in en-US", () => {
    expect(periodParts("2026-03", "pt-BR")).toEqual({ month: "Março", year: "2026" });
    expect(periodParts("2026-03", "en-US")).toEqual({ month: "March", year: "2026" });
  });
});
