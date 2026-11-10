import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatDayMonth,
  formatInstant,
  formatMonthYear,
  formatPhone,
} from "../lib/format";

describe("profile date formatting", () => {
  it("keeps the local day of a date without time zone", () => {
    expect(formatDate("2024-03-01", "pt-BR")).toBe("01/03/2024");
  });

  it("shows day and month for table rows", () => {
    expect(formatDayMonth("2026-03-14", "pt-BR")).toBe("14/03");
  });

  it("shows a capitalised month and year", () => {
    expect(formatMonthYear("2026-03", "pt-BR")).toBe("Março/2026");
  });
});

// The time zone is explicit in every case: Vitest does not pin `TZ`, so a default would make the
// expected text depend on the machine that runs the suite.
describe("formatInstant", () => {
  it("shows the clock of the given time zone, not the UTC clock of the value", () => {
    expect(formatInstant("2026-10-20T13:00:00.000Z", "pt-BR", "America/Sao_Paulo")).toBe(
      "20/10/2026, 10:00",
    );
  });

  it("moves to the previous day when the time zone is behind UTC", () => {
    expect(formatInstant("2026-10-21T01:30:00.000Z", "pt-BR", "America/Sao_Paulo")).toBe(
      "20/10/2026, 22:30",
    );
  });

  it("keeps the UTC clock when the time zone is UTC", () => {
    expect(formatInstant("2026-10-20T13:00:00.000Z", "pt-BR", "UTC")).toBe("20/10/2026, 13:00");
  });
});

describe("formatPhone", () => {
  it("formats the 11 digits of a mobile number", () => {
    expect(formatPhone("11981813030")).toBe("(11) 98181-3030");
  });

  it("formats the 10 digits of a landline", () => {
    expect(formatPhone("1133334444")).toBe("(11) 3333-4444");
  });

  it.each([
    ["too few digits", "12345"],
    ["too many digits", "551198181303000"],
    ["an already formatted number", "(11) 98181-3030"],
    ["an empty value", ""],
  ])("returns a value outside the pattern as it came: %s", (_label, value) => {
    expect(formatPhone(value)).toBe(value);
  });
});
