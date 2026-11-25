import { afterEach, describe, expect, it } from "vitest";

import { formatCalendarDate, formatInstantDate, formatPercent } from "../lib/format";

const ORIGINAL_TZ = process.env.TZ;

afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe("formatCalendarDate", () => {
  it("formats a date of the API in the short form of the locale", () => {
    expect(formatCalendarDate("2026-03-03", "pt-BR")).toBe("03/03/2026");
    expect(formatCalendarDate("2026-03-03", "en-US")).toBe("3/3/26");
  });

  it("keeps the zero of the day and of the month", () => {
    expect(formatCalendarDate("2026-06-07", "pt-BR")).toBe("07/06/2026");
  });

  it("keeps the day when the browser is behind UTC, where a date read as UTC would be the day before", () => {
    process.env.TZ = "America/Sao_Paulo";

    expect(formatCalendarDate("2026-03-03", "pt-BR")).toBe("03/03/2026");
    expect(formatCalendarDate("2026-01-01", "pt-BR")).toBe("01/01/2026");
  });

  it("keeps the day when the browser is ahead of UTC too", () => {
    process.env.TZ = "Pacific/Auckland";

    expect(formatCalendarDate("2026-03-03", "pt-BR")).toBe("03/03/2026");
  });

  it.each([
    ["an empty value", ""],
    ["a word", "soon"],
    ["an instant, which is not a date of the calendar", "2026-03-03T10:00:00.000Z"],
    ["a month that does not exist", "2026-13-40"],
    ["a day that does not exist", "2026-02-31"],
  ])("returns %s as it came, instead of failing", (_label, value) => {
    expect(formatCalendarDate(value, "pt-BR")).toBe(value);
  });
});

// The time zone is explicit in every case: Vitest does not pin `TZ`, so a default would make the
// expected text depend on the machine that runs the suite.
describe("formatInstantDate", () => {
  it("shows the day of the given time zone, not the day of the UTC clock", () => {
    expect(formatInstantDate("2026-10-01T13:00:00.000Z", "pt-BR", "America/Sao_Paulo")).toBe(
      "01/10/2026",
    );
  });

  it("moves to the previous day when the time zone is behind UTC", () => {
    expect(formatInstantDate("2026-10-01T01:30:00.000Z", "pt-BR", "America/Sao_Paulo")).toBe(
      "30/09/2026",
    );
  });

  it("keeps the UTC day when the time zone is UTC", () => {
    expect(formatInstantDate("2026-10-01T01:30:00.000Z", "pt-BR", "UTC")).toBe("01/10/2026");
  });

  it("follows the locale it receives", () => {
    expect(formatInstantDate("2026-10-01T13:00:00.000Z", "en-US", "UTC")).toBe("10/1/26");
  });

  it("uses the time zone of the browser when none is given", () => {
    process.env.TZ = "America/Sao_Paulo";

    expect(formatInstantDate("2026-10-01T01:30:00.000Z", "pt-BR")).toBe("30/09/2026");
  });
});

describe("formatPercent", () => {
  it("shows a fraction as a whole percentage", () => {
    expect(formatPercent(0.89, "pt-BR")).toBe("89%");
    expect(formatPercent(0.8, "pt-BR")).toBe("80%");
  });

  it("rounds to the nearest whole percentage", () => {
    expect(formatPercent(0.894, "pt-BR")).toBe("89%");
    expect(formatPercent(0.896, "pt-BR")).toBe("90%");
  });

  it("shows the ends of the range, and a zero is a value", () => {
    expect(formatPercent(0, "pt-BR")).toBe("0%");
    expect(formatPercent(1, "pt-BR")).toBe("100%");
  });

  it("follows the locale it receives", () => {
    expect(formatPercent(0.89, "en-US")).toBe("89%");
  });
});
