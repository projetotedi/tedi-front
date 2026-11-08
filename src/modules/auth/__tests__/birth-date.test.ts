import { describe, expect, it } from "vitest";

import { isValidBirthDate, MIN_BIRTH_DATE, todayInSaoPaulo } from "../lib/birth-date";

// 2026-11-08T02:30Z ainda é noite de 07/11 em São Paulo (UTC-3).
const LATE_EVENING_IN_SAO_PAULO = new Date("2026-11-08T02:30:00Z");
// 2026-11-08T12:00Z já é 08/11 em São Paulo.
const MIDDAY = new Date("2026-11-08T12:00:00Z");

describe("todayInSaoPaulo", () => {
  it("is the calendar day in America/Sao_Paulo, not in UTC", () => {
    expect(todayInSaoPaulo(LATE_EVENING_IN_SAO_PAULO)).toBe("2026-11-07");
    expect(todayInSaoPaulo(MIDDAY)).toBe("2026-11-08");
  });

  it("writes the month and the day with two digits", () => {
    expect(todayInSaoPaulo(new Date("2027-01-05T15:00:00Z"))).toBe("2027-01-05");
  });

  it("uses the real clock when no date is given", () => {
    expect(todayInSaoPaulo()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("isValidBirthDate", () => {
  it("accepts an ordinary birth date", () => {
    expect(isValidBirthDate("1999-07-22", MIDDAY)).toBe(true);
  });

  it("accepts the lower bound and rejects the day before it", () => {
    expect(MIN_BIRTH_DATE).toBe("1900-01-01");
    expect(isValidBirthDate("1900-01-01", MIDDAY)).toBe(true);
    expect(isValidBirthDate("1899-12-31", MIDDAY)).toBe(false);
  });

  it("rejects a year typed with a missing digit, like 0958", () => {
    expect(isValidBirthDate("0958-04-12", MIDDAY)).toBe(false);
  });

  it("accepts today and rejects tomorrow, both in America/Sao_Paulo", () => {
    expect(isValidBirthDate("2026-11-08", MIDDAY)).toBe(true);
    expect(isValidBirthDate("2026-11-09", MIDDAY)).toBe(false);
  });

  it("uses the Sao Paulo day when it is already the next day in UTC", () => {
    expect(isValidBirthDate("2026-11-07", LATE_EVENING_IN_SAO_PAULO)).toBe(true);
    expect(isValidBirthDate("2026-11-08", LATE_EVENING_IN_SAO_PAULO)).toBe(false);
  });

  it("rejects a day that does not exist", () => {
    expect(isValidBirthDate("2023-02-29", MIDDAY)).toBe(false);
    expect(isValidBirthDate("2023-04-31", MIDDAY)).toBe(false);
    expect(isValidBirthDate("2023-13-01", MIDDAY)).toBe(false);
    expect(isValidBirthDate("2023-00-10", MIDDAY)).toBe(false);
  });

  it("accepts February 29 of a leap year", () => {
    expect(isValidBirthDate("2000-02-29", MIDDAY)).toBe(true);
    expect(isValidBirthDate("1900-02-29", MIDDAY)).toBe(false);
  });

  it.each([
    "",
    "22/07/1999",
    "1999-7-22",
    "1999-07-22T00:00",
    "19990722",
    "20200-01-01",
    " 1999-07-22",
  ])("rejects the text %j, which is not YYYY-MM-DD", (value) => {
    expect(isValidBirthDate(value, MIDDAY)).toBe(false);
  });
});
