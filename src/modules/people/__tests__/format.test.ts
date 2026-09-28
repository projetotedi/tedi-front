import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime, formatDayMonth, formatMonthYear } from "../lib/format";

describe("profile date formatting", () => {
  it("keeps the local day of a date without time zone", () => {
    expect(formatDate("2024-03-01", "pt-BR")).toBe("01/03/2024");
  });

  it("shows day and month for table rows", () => {
    expect(formatDayMonth("2026-03-14", "pt-BR")).toBe("14/03");
  });

  it("shows date and time", () => {
    expect(formatDateTime("2026-03-14T09:12", "pt-BR")).toBe("14/03/2026, 09:12");
  });

  it("shows a capitalised month and year", () => {
    expect(formatMonthYear("2026-03", "pt-BR")).toBe("Março/2026");
  });
});
