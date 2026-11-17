import { describe, expect, it } from "vitest";

import { formatEntryDay } from "../lib/bank-format";

describe("bank format", () => {
  it("formats the day of an entry as 05/03, read as a local date", () => {
    const originalTimeZone = process.env.TZ;
    // West of UTC, `new Date("2026-03-05")` would be the 4th.
    process.env.TZ = "America/Sao_Paulo";
    try {
      expect(formatEntryDay("2026-03-05", "pt-BR")).toBe("05/03");
      expect(formatEntryDay("2026-03-14", "en-US")).toBe("03/14");
      expect(formatEntryDay("2026-02-31", "pt-BR")).toBe("2026-02-31");
      expect(formatEntryDay("5 de março", "pt-BR")).toBe("5 de março");
    } finally {
      if (originalTimeZone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimeZone;
    }
  });
});
