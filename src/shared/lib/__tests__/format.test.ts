import { afterEach, describe, expect, it } from "vitest";

import { formatCalendarDate, formatHours } from "../format";

const ORIGINAL_TZ = process.env.TZ;

afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe("formatHours", () => {
  it("formats whole hours", () => {
    expect(formatHours(120)).toBe("2h");
    expect(formatHours(3480)).toBe("58h");
  });

  it("formats hours and minutes", () => {
    expect(formatHours(90)).toBe("1h30");
  });

  it("keeps the zero hour when under one hour", () => {
    expect(formatHours(30)).toBe("0h30");
  });

  it("formats zero", () => {
    expect(formatHours(0)).toBe("0h");
  });

  it("pads minutes under ten", () => {
    expect(formatHours(65)).toBe("1h05");
  });

  it("rounds fractional minutes before splitting, so the minutes never reach 60", () => {
    expect(formatHours(89.6)).toBe("1h30");
    expect(formatHours(59.6)).toBe("1h");
  });

  it("puts the sign in front of the absolute value when negative", () => {
    expect(formatHours(-90)).toBe("-1h30");
    expect(formatHours(-120)).toBe("-2h");
    expect(formatHours(-30)).toBe("-0h30");
  });

  it("rounds negative values before splitting, like positive ones", () => {
    expect(formatHours(-59.6)).toBe("-1h");
  });

  it("shows no sign when a negative value rounds to zero", () => {
    expect(formatHours(-0.4)).toBe("0h");
  });
});

describe("formatCalendarDate", () => {
  it("formats a date of the API in the short form of the locale", () => {
    expect(formatCalendarDate("2026-03-10", "pt-BR")).toBe("10/03/2026");
    expect(formatCalendarDate("2026-03-10", "en-US")).toBe("3/10/26");
  });

  it("keeps the zero of the day and of the month", () => {
    expect(formatCalendarDate("2026-06-07", "pt-BR")).toBe("07/06/2026");
  });

  it("keeps the day when the browser is behind UTC, where a date read as UTC would be the day before", () => {
    process.env.TZ = "America/Sao_Paulo";

    expect(formatCalendarDate("2026-03-10", "pt-BR")).toBe("10/03/2026");
    expect(formatCalendarDate("2026-01-01", "pt-BR")).toBe("01/01/2026");
  });

  it("keeps the day when the browser is ahead of UTC too", () => {
    process.env.TZ = "Pacific/Auckland";

    expect(formatCalendarDate("2026-03-10", "pt-BR")).toBe("10/03/2026");
  });

  it.each([
    ["an empty value", ""],
    ["a word", "soon"],
    ["an instant, which is not a date of the calendar", "2026-03-10T10:00:00.000Z"],
    ["a month that does not exist", "2026-13-40"],
    ["a day that does not exist", "2026-02-31"],
  ])("returns %s as it came, instead of failing", (_label, value) => {
    expect(formatCalendarDate(value, "pt-BR")).toBe(value);
  });
});
