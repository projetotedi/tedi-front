import { describe, expect, it } from "vitest";

import {
  formatDayMonth,
  formatMonthYear,
  isCalendarDate,
  monthPeriod,
  todayIsoDate,
} from "../lib/entry-format";

describe("entry format", () => {
  it("shows day and month of a date of the API as a local date", () => {
    expect(formatDayMonth("2026-03-14", "pt-BR")).toBe("14/03");
    expect(formatDayMonth("2026-03-01", "pt-BR")).toBe("01/03");
    // Not a day of the calendar: shown as it came, never as March 3rd.
    expect(formatDayMonth("2026-02-31", "pt-BR")).toBe("2026-02-31");
    expect(isCalendarDate("2026-02-31")).toBe(false);
    expect(isCalendarDate("")).toBe(false);
    expect(isCalendarDate("2028-02-29")).toBe(true);
  });

  it("shows the month and the year capitalised", () => {
    expect(formatMonthYear("2026-03", "pt-BR")).toBe("Março/2026");
    expect(formatMonthYear("2026-03", "en-US")).toBe("March/2026");
    expect(formatMonthYear("março", "pt-BR")).toBe("março");
  });

  it("is today on the calendar of the machine, not in UTC", () => {
    expect(todayIsoDate(new Date(2026, 2, 16, 23, 59))).toBe("2026-03-16");
    expect(todayIsoDate(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
  });

  it.each([
    { now: new Date(2026, 1, 10), month: "2026-02", from: "2026-02-01", to: "2026-02-28" },
    { now: new Date(2028, 1, 10), month: "2028-02", from: "2028-02-01", to: "2028-02-29" },
    { now: new Date(2026, 11, 31, 23, 59), month: "2026-12", from: "2026-12-01", to: "2026-12-31" },
    { now: new Date(2026, 2, 16, 12), month: "2026-03", from: "2026-03-01", to: "2026-03-31" },
  ])("the month of $now is $month, from $from to $to", ({ now, month, from, to }) => {
    expect(monthPeriod(now)).toEqual({ month, from, to });
  });
});
