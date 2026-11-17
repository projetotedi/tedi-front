import { afterEach, describe, expect, it } from "vitest";

import {
  formatDayMonth,
  formatLessonDay,
  formatSentDate,
  META_SEPARATOR,
  todayIsoDate,
} from "../lib/format";

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

describe("formatLessonDay", () => {
  it("writes day and month with the short weekday, as the Figma does: 17/03 (ter)", () => {
    expect(formatLessonDay("2026-03-17", "pt-BR")).toBe("17/03 (ter)");
  });

  it.each([
    ["2026-03-19", "19/03 (qui)"],
    ["2026-03-31", "31/03 (ter)"],
    ["2026-04-02", "02/04 (qui)"],
    ["2026-03-21", "21/03 (sáb)"],
    ["2026-03-22", "22/03 (dom)"],
  ])("%s is %s", (date, expected) => {
    expect(formatLessonDay(date, "pt-BR")).toBe(expected);
  });

  it("drops the period the short weekday of the locale may end with", () => {
    expect(formatLessonDay("2026-03-17", "pt-BR")).not.toContain(".");
  });

  it("follows the locale: 03/17 (Tue) in en-US", () => {
    expect(formatLessonDay("2026-03-17", "en-US")).toBe("03/17 (Tue)");
  });

  it("reads the date as a calendar day, whatever the time zone of the machine", () => {
    const original = process.env.TZ;
    try {
      for (const timeZone of ["America/Sao_Paulo", "Pacific/Auckland", "UTC"]) {
        process.env.TZ = timeZone;
        expect(formatLessonDay("2026-03-17", "pt-BR"), timeZone).toBe("17/03 (ter)");
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it.each(["", "17/03/2026", "2026-3-17", "2026-02-31", "2026-13-01", "ontem"])(
    "returns %j as it came, since it is not a calendar date",
    (value) => {
      expect(formatLessonDay(value, "pt-BR")).toBe(value);
    },
  );
});

describe("formatDayMonth and formatLessonDay", () => {
  it("say the same day, the second one with the weekday", () => {
    expect(formatLessonDay("2026-03-31", "pt-BR")).toBe(
      `${formatDayMonth("2026-03-31", "pt-BR")} (ter)`,
    );
  });
});

describe("formatSentDate", () => {
  it("writes day and month of the instant: 20/03", () => {
    expect(formatSentDate("2026-03-20T15:00:00.000Z", "pt-BR", "America/Sao_Paulo")).toBe("20/03");
  });

  it("uses the day of the time zone, not the one of the instant: 01:30 UTC is still the day before in Brazil", () => {
    expect(formatSentDate("2026-03-21T01:30:00.000Z", "pt-BR", "America/Sao_Paulo")).toBe("20/03");
    expect(formatSentDate("2026-03-21T01:30:00.000Z", "pt-BR", "UTC")).toBe("21/03");
  });

  it("takes the zone of the browser when none is given", () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = "America/Sao_Paulo";
      expect(formatSentDate("2026-03-21T01:30:00.000Z", "pt-BR")).toBe("20/03");
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it("follows the locale: 03/20 in en-US", () => {
    expect(formatSentDate("2026-03-20T15:00:00.000Z", "en-US", "America/Sao_Paulo")).toBe("03/20");
  });

  it.each(["", "ontem", "2026-13-45T99:00:00Z"])(
    "returns %j as it came, since it is not an instant",
    (value) => {
      expect(formatSentDate(value, "pt-BR")).toBe(value);
    },
  );
});

describe("META_SEPARATOR", () => {
  it("is the middle dot of the meta lines, with a space on each side", () => {
    expect(META_SEPARATOR).toBe(" · ");
  });
});
