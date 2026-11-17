import { describe, expect, it } from "vitest";

import {
  formatLessonDay,
  formatLessonDayMonth,
  formatSentDate,
  META_SEPARATOR,
} from "../lib/format";

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

describe("formatLessonDayMonth", () => {
  it("writes only the day and the month, as the toast of the Figma does: 31/03", () => {
    expect(formatLessonDayMonth("2026-03-31", "pt-BR")).toBe("31/03");
  });

  it.each([
    ["2026-03-17", "17/03"],
    ["2026-04-02", "02/04"],
    ["2026-12-01", "01/12"],
  ])("%s is %s, with no weekday", (date, expected) => {
    expect(formatLessonDayMonth(date, "pt-BR")).toBe(expected);
  });

  it("is the day of formatLessonDay without the weekday", () => {
    expect(formatLessonDay("2026-03-31", "pt-BR")).toBe(
      `${formatLessonDayMonth("2026-03-31", "pt-BR")} (ter)`,
    );
  });

  it("follows the locale: 03/31 in en-US", () => {
    expect(formatLessonDayMonth("2026-03-31", "en-US")).toBe("03/31");
  });

  it("reads the date as a calendar day, whatever the time zone of the machine", () => {
    const original = process.env.TZ;
    try {
      for (const timeZone of ["America/Sao_Paulo", "Pacific/Auckland", "UTC"]) {
        process.env.TZ = timeZone;
        expect(formatLessonDayMonth("2026-03-31", "pt-BR"), timeZone).toBe("31/03");
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it.each(["", "31/03/2026", "2026-3-31", "2026-02-31", "amanhã"])(
    "returns %j as it came, since it is not a calendar date",
    (value) => {
      expect(formatLessonDayMonth(value, "pt-BR")).toBe(value);
    },
  );
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
