import { describe, expect, it } from "vitest";

import { formatDate } from "../lib/format-date";

describe("formatDate", () => {
  it("formats the date as dd/mm/yyyy in pt-BR", () => {
    expect(formatDate("2026-10-01T13:00:00.000Z", "pt-BR")).toBe("01/10/2026");
  });

  it("follows the locale it receives", () => {
    expect(formatDate("2026-10-01T13:00:00.000Z", "en-US")).toBe("10/1/26");
  });

  it("keeps the zero of the day and of the month", () => {
    expect(formatDate("2026-03-05T15:30:00.000Z", "pt-BR")).toBe("05/03/2026");
  });
});
