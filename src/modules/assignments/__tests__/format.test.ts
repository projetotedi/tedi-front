import { afterEach, describe, expect, it } from "vitest";

import { formatDayMonth, todayIsoDate } from "../lib/format";

const ORIGINAL_TZ = process.env.TZ;

afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe("formatDayMonth", () => {
  it("shows the day and the month of a date of the API, in the order of the locale", () => {
    expect(formatDayMonth("2026-03-10", "pt-BR")).toBe("10/03");
    expect(formatDayMonth("2026-03-10", "en-US")).toBe("03/10");
  });

  it("keeps the zero of the day and of the month", () => {
    expect(formatDayMonth("2026-06-07", "pt-BR")).toBe("07/06");
    expect(formatDayMonth("2026-12-31", "pt-BR")).toBe("31/12");
  });

  it("keeps the day when the browser is behind UTC, where a date read as UTC would be the day before", () => {
    process.env.TZ = "America/Sao_Paulo";

    expect(formatDayMonth("2026-03-10", "pt-BR")).toBe("10/03");
    expect(formatDayMonth("2026-01-01", "pt-BR")).toBe("01/01");
  });

  it("keeps the day when the browser is ahead of UTC too", () => {
    process.env.TZ = "Pacific/Auckland";

    expect(formatDayMonth("2026-03-10", "pt-BR")).toBe("10/03");
  });

  it.each([
    ["an empty value", ""],
    ["a word", "soon"],
    ["an instant, which is not a date of the calendar", "2026-03-10T10:00:00.000Z"],
    ["a day that does not exist", "2026-02-31"],
    ["a month that does not exist", "2026-13-01"],
  ])("returns %s as it came", (_label, value) => {
    expect(formatDayMonth(value, "pt-BR")).toBe(value);
  });
});

describe("todayIsoDate", () => {
  it("is the local date as YYYY-MM-DD, with the zeros", () => {
    expect(todayIsoDate(new Date(2026, 2, 5, 9, 30))).toBe("2026-03-05");
    expect(todayIsoDate(new Date(2026, 10, 17, 0, 0))).toBe("2026-11-17");
  });

  it("is still the local day late at night, when UTC has already moved to the next one", () => {
    process.env.TZ = "America/Sao_Paulo";

    // 22:30 of March 5th in Brazil is already March 6th in UTC.
    expect(todayIsoDate(new Date("2026-03-06T01:30:00.000Z"))).toBe("2026-03-05");
  });

  it("is the local day when the browser is ahead of UTC, where UTC is still the day before", () => {
    process.env.TZ = "Pacific/Auckland";

    // 09:00 of March 6th in Auckland is still March 5th in UTC.
    expect(todayIsoDate(new Date("2026-03-05T20:00:00.000Z"))).toBe("2026-03-06");
  });

  it("uses the clock when it is not given a date", () => {
    expect(todayIsoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
