import { describe, expect, it } from "vitest";

import {
  ageOn,
  APP_TIME_ZONE,
  formatCalendarDate,
  formatCpfForDisplay,
  formatPhoneForDisplay,
  formatSubmittedAt,
  isCalendarDate,
  todayInAppTimeZone,
  toAppCalendarDate,
} from "../lib/registration-format";

describe("APP_TIME_ZONE", () => {
  it("is the time zone the back uses for today", () => {
    expect(APP_TIME_ZONE).toBe("America/Sao_Paulo");
  });
});

describe("todayInAppTimeZone", () => {
  it("is still the previous day in São Paulo at 02:00 UTC", () => {
    expect(todayInAppTimeZone(new Date("2026-09-19T02:00:00.000Z"))).toBe("2026-09-18");
  });

  it("turns into the next day at 03:00 UTC, midnight in São Paulo", () => {
    expect(todayInAppTimeZone(new Date("2026-09-19T03:00:00.000Z"))).toBe("2026-09-19");
  });

  it("changes the year with São Paulo and not with UTC", () => {
    expect(todayInAppTimeZone(new Date("2027-01-01T02:59:59.000Z"))).toBe("2026-12-31");
    expect(todayInAppTimeZone(new Date("2027-01-01T03:00:00.000Z"))).toBe("2027-01-01");
  });

  it("uses the clock when no instant is given", () => {
    expect(todayInAppTimeZone()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("toAppCalendarDate", () => {
  it("keeps the São Paulo day for an evening instant", () => {
    expect(toAppCalendarDate("2026-09-18T17:32:00.000Z")).toBe("2026-09-18");
  });

  it("moves an instant after midnight UTC back to the São Paulo day", () => {
    expect(toAppCalendarDate("2026-09-19T02:00:00Z")).toBe("2026-09-18");
  });

  it("accepts an offset in the text", () => {
    expect(toAppCalendarDate("2026-09-19T00:30:00-03:00")).toBe("2026-09-19");
  });

  it("returns null when the text is not a date", () => {
    expect(toAppCalendarDate("not a date")).toBeNull();
    expect(toAppCalendarDate("")).toBeNull();
  });
});

describe("isCalendarDate", () => {
  it("accepts dates that exist", () => {
    expect(isCalendarDate("2026-09-18")).toBe(true);
    expect(isCalendarDate("2000-01-01")).toBe(true);
    expect(isCalendarDate("2024-02-29")).toBe(true);
  });

  it("rejects dates that roll over to another month", () => {
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("2025-02-29")).toBe(false);
    expect(isCalendarDate("2026-04-31")).toBe(false);
    expect(isCalendarDate("2026-13-01")).toBe(false);
    expect(isCalendarDate("2026-00-10")).toBe(false);
    expect(isCalendarDate("2026-01-00")).toBe(false);
  });

  it("rejects text that is not YYYY-MM-DD", () => {
    expect(isCalendarDate("18/09/2026")).toBe(false);
    expect(isCalendarDate("2026-9-18")).toBe(false);
    expect(isCalendarDate("2026-09-18T00:00:00Z")).toBe(false);
    expect(isCalendarDate("")).toBe(false);
  });
});

describe("formatCalendarDate", () => {
  it("formats a calendar date for pt-BR", () => {
    expect(formatCalendarDate("2004-05-22", "pt-BR")).toBe("22/05/2004");
  });

  it("formats a calendar date for en-US", () => {
    expect(formatCalendarDate("2004-05-22", "en-US")).toBe("05/22/2004");
  });

  it("does not move the day with the time zone of the process", () => {
    expect(formatCalendarDate("2026-01-01", "pt-BR")).toBe("01/01/2026");
    expect(formatCalendarDate("2026-12-31", "pt-BR")).toBe("31/12/2026");
  });

  it("formats a leap day", () => {
    expect(formatCalendarDate("2004-02-29", "pt-BR")).toBe("29/02/2004");
  });

  it("returns what is not YYYY-MM-DD as it came", () => {
    expect(formatCalendarDate("22/05/2004", "pt-BR")).toBe("22/05/2004");
    expect(formatCalendarDate("", "pt-BR")).toBe("");
  });
});

describe("formatSubmittedAt", () => {
  it("shows the date and the time of São Paulo", () => {
    expect(formatSubmittedAt("2026-09-18T17:32:00.000Z", "pt-BR")).toBe("18/09/2026, 14:32");
  });

  it("shows the São Paulo day for an instant that is already the next day in UTC", () => {
    expect(formatSubmittedAt("2026-09-19T02:00:00.000Z", "pt-BR")).toBe("18/09/2026, 23:00");
  });

  it("shows midnight as 00:00", () => {
    expect(formatSubmittedAt("2026-09-18T03:00:00.000Z", "pt-BR")).toBe("18/09/2026, 00:00");
  });

  it("pads the hour", () => {
    expect(formatSubmittedAt("2026-09-18T12:05:00.000Z", "pt-BR")).toBe("18/09/2026, 09:05");
  });

  it("follows the locale", () => {
    expect(formatSubmittedAt("2026-09-18T17:32:00.000Z", "en-US")).toMatch(
      /^09\/18\/2026, 02:32\sPM$/,
    );
  });

  it("returns what is not a date as it came", () => {
    expect(formatSubmittedAt("not a date", "pt-BR")).toBe("not a date");
  });
});

describe("ageOn", () => {
  it("counts the full years", () => {
    expect(ageOn("2004-05-22", "2026-11-15")).toBe(22);
  });

  it("is the new age on the birthday itself", () => {
    expect(ageOn("2004-05-22", "2026-05-22")).toBe(22);
  });

  it("is still the old age on the day before the birthday", () => {
    expect(ageOn("2004-05-22", "2026-05-21")).toBe(21);
  });

  it("is still the old age in an earlier month of the same year", () => {
    expect(ageOn("2004-05-22", "2026-01-31")).toBe(21);
  });

  it("handles a leap day birthday", () => {
    expect(ageOn("2004-02-29", "2026-02-28")).toBe(21);
    expect(ageOn("2004-02-29", "2026-03-01")).toBe(22);
  });

  it("is zero in the first year", () => {
    expect(ageOn("2026-03-10", "2026-11-15")).toBe(0);
  });

  it("returns null for a birth date in the future", () => {
    expect(ageOn("2999-01-01", "2026-11-15")).toBeNull();
  });

  it("returns null when a date is not YYYY-MM-DD", () => {
    expect(ageOn("22/05/2004", "2026-11-15")).toBeNull();
    expect(ageOn("2004-05-22", "hoje")).toBeNull();
  });
});

describe("formatCpfForDisplay", () => {
  it("masks 11 digits", () => {
    expect(formatCpfForDisplay("52998224725")).toBe("529.982.247-25");
  });

  it("returns what does not have 11 digits as it came", () => {
    expect(formatCpfForDisplay("529982247")).toBe("529982247");
    expect(formatCpfForDisplay("529982247250")).toBe("529982247250");
    expect(formatCpfForDisplay("")).toBe("");
  });

  it("returns what is not made of digits as it came", () => {
    expect(formatCpfForDisplay("529.982.247-25")).toBe("529.982.247-25");
    expect(formatCpfForDisplay("5299822472a")).toBe("5299822472a");
  });
});

describe("formatPhoneForDisplay", () => {
  it("masks a mobile phone with 11 digits", () => {
    expect(formatPhoneForDisplay("11981813030")).toBe("(11) 98181-3030");
  });

  it("masks a landline with 10 digits", () => {
    expect(formatPhoneForDisplay("1133334444")).toBe("(11) 3333-4444");
  });

  it("drops the Brazilian country code of 12 and 13 digits", () => {
    expect(formatPhoneForDisplay("5511981813030")).toBe("(11) 98181-3030");
    expect(formatPhoneForDisplay("551133334444")).toBe("(11) 3333-4444");
  });

  it("keeps the 55 area code of Rio Grande do Sul when there is no country code", () => {
    expect(formatPhoneForDisplay("55991234567")).toBe("(55) 99123-4567");
    expect(formatPhoneForDisplay("5533334444")).toBe("(55) 3333-4444");
  });

  it("returns what does not fit the formats as it came", () => {
    expect(formatPhoneForDisplay("123")).toBe("123");
    expect(formatPhoneForDisplay("981813030")).toBe("981813030");
    expect(formatPhoneForDisplay("441234567890")).toBe("441234567890");
    expect(formatPhoneForDisplay("5511981813030123")).toBe("5511981813030123");
    expect(formatPhoneForDisplay("")).toBe("");
  });

  it("returns what is not made of digits as it came", () => {
    expect(formatPhoneForDisplay("(11) 98181-3030")).toBe("(11) 98181-3030");
    expect(formatPhoneForDisplay("+5511981813030")).toBe("+5511981813030");
  });
});
