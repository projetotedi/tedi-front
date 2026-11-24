import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { formatEntryDay, formatInstantDay, formatInstantTime } from "../lib/bank-format";

describe("bank format", () => {
  let originalTimeZone: string | undefined;

  beforeAll(() => {
    originalTimeZone = process.env.TZ;
    // West of UTC: `new Date("2026-03-05")` would be the 4th, and 21:42Z is 18:42 of the 14th.
    process.env.TZ = "America/Sao_Paulo";
  });

  afterAll(() => {
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  });

  it("formats the day of an entry as 05/03, read as a local date", () => {
    expect(formatEntryDay("2026-03-05", "pt-BR")).toBe("05/03");
    expect(formatEntryDay("2026-03-14", "en-US")).toBe("03/14");
    expect(formatEntryDay("2026-02-31", "pt-BR")).toBe("2026-02-31");
    expect(formatEntryDay("5 de março", "pt-BR")).toBe("5 de março");
  });

  it("formats an instant as 14/03 and 18:42 in the time zone of the browser", () => {
    expect(formatInstantDay("2026-03-14T21:42:00.000Z", "pt-BR")).toBe("14/03");
    expect(formatInstantTime("2026-03-14T21:42:00.000Z", "pt-BR")).toBe("18:42");
    expect(formatInstantDay("2026-03-16T02:30:00.000Z", "pt-BR")).toBe("15/03");
    expect(formatInstantTime("2026-03-16T13:15:00.000Z", "pt-BR")).toBe("10:15");
    expect(formatInstantDay("ontem", "pt-BR")).toBe("ontem");
    expect(formatInstantTime("ontem", "pt-BR")).toBe("ontem");
  });
});
