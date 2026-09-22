import { describe, expect, it } from "vitest";

import { formatDateTime } from "../format-date";

describe("formatDateTime", () => {
  it("formats an ISO date in the short date + time style of the locale", () => {
    // Regex porque o separador de data/hora do ICU varia entre versões do Node.
    expect(formatDateTime("2026-09-19T12:00:00.000Z", "pt-BR", "UTC")).toMatch(
      /19\/09\/2026.*12:00/,
    );
  });

  it("formats using the given time zone", () => {
    expect(formatDateTime("2026-09-19T23:30:00.000Z", "pt-BR", "UTC")).toMatch(/19\/09\/2026/);
  });
});
