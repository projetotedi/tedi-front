import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  anchorForView,
  calendarRange,
  CALENDAR_VIEWS,
  formatDay,
  formatPeriodTitle,
  groupLessonsByDay,
  monthDays,
  monthGridDays,
  readAnchorDate,
  readCalendarView,
  shiftAnchor,
  todayIso,
  weekDays,
} from "../lib/calendar-period";
import { buildLessonListItem } from "./handlers";

const params = (query: string) => new URLSearchParams(query);

describe("readCalendarView", () => {
  it("is the month with no view, or with one that does not exist", () => {
    expect(readCalendarView(params(""))).toBe("month");
    expect(readCalendarView(params("view=year"))).toBe("month");
    expect(readCalendarView(params("view="))).toBe("month");
  });

  it.each(CALENDAR_VIEWS)("reads the view %s", (view) => {
    expect(readCalendarView(params(`view=${view}`))).toBe(view);
  });
});

describe("readAnchorDate", () => {
  it("reads the day of the URL", () => {
    expect(readAnchorDate(params("date=2026-04-15"), "2026-03-10")).toBe("2026-04-15");
  });

  it.each(["", "amanha", "2026-3-1", "2026-02-31", "2026-13-01", "20260410", "+012026-04-10"])(
    "falls back to the default for %j",
    (value) => {
      expect(readAnchorDate(params(`date=${value}`), "2026-03-10")).toBe("2026-03-10");
    },
  );

  it("falls back to the default with no date", () => {
    expect(readAnchorDate(params(""), "2026-03-10")).toBe("2026-03-10");
  });
});

describe("todayIso", () => {
  let originalTimeZone: string | undefined;

  beforeAll(() => {
    originalTimeZone = process.env.TZ;
    process.env.TZ = "America/Sao_Paulo";
    return () => {
      if (originalTimeZone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimeZone;
    };
  });
  afterEach(() => vi.useRealTimers());

  it("is the day where the person is, not the day in UTC", () => {
    // 23:30 in Brasília is already 02:30 of the next day in UTC.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-03-10T23:30:00-03:00") });

    expect(todayIso()).toBe("2026-03-10");
  });
});

describe("calendarRange", () => {
  it("the month grid is 42 days from the Sunday before the 1st", () => {
    // March 1st 2026 is a Sunday: the grid starts there.
    expect(calendarRange("month", "2026-03-10", "pt-BR")).toEqual({
      from: "2026-03-01",
      to: "2026-04-11",
    });
    // April 1st 2026 is a Wednesday: the grid starts on Sunday March 29th.
    expect(calendarRange("month", "2026-04-15", "pt-BR")).toEqual({
      from: "2026-03-29",
      to: "2026-05-09",
    });
  });

  it("the agenda asks for the same days as the month, so switching between them asks for nothing", () => {
    expect(calendarRange("list", "2026-04-15", "pt-BR")).toEqual(
      calendarRange("month", "2026-04-15", "pt-BR"),
    );
  });

  it("is the same for any day of the month", () => {
    expect(calendarRange("month", "2026-04-01", "pt-BR")).toEqual(
      calendarRange("month", "2026-04-30", "pt-BR"),
    );
  });

  it("the week is the seven days from the Sunday", () => {
    expect(calendarRange("week", "2026-03-10", "pt-BR")).toEqual({
      from: "2026-03-08",
      to: "2026-03-14",
    });
    expect(calendarRange("week", "2026-03-08", "pt-BR")).toEqual({
      from: "2026-03-08",
      to: "2026-03-14",
    });
  });

  it("a week across two months and across two years", () => {
    expect(calendarRange("week", "2026-03-31", "pt-BR")).toEqual({
      from: "2026-03-29",
      to: "2026-04-04",
    });
    expect(calendarRange("week", "2026-12-31", "pt-BR")).toEqual({
      from: "2026-12-27",
      to: "2027-01-02",
    });
  });

  it("never asks for more than the 42 days of the API, whatever the month", () => {
    for (const year of [2026, 2027, 2028]) {
      for (let month = 1; month <= 12; month += 1) {
        const anchor = `${year}-${String(month).padStart(2, "0")}-01`;
        const { from, to } = calendarRange("month", anchor, "pt-BR");
        const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;

        expect(days + 1, anchor).toBe(42);
      }
    }
  });

  it("follows the first day of the week of the language", () => {
    expect(calendarRange("week", "2026-03-10", "en-US").from).toBe("2026-03-08");
  });
});

describe("anchorForView", () => {
  it("is the 1st of the month for the month and the agenda", () => {
    expect(anchorForView("month", "2026-03-10", "pt-BR")).toBe("2026-03-01");
    expect(anchorForView("list", "2026-03-31", "pt-BR")).toBe("2026-03-01");
  });

  it("is the first day of the week for the week", () => {
    expect(anchorForView("week", "2026-03-10", "pt-BR")).toBe("2026-03-08");
  });
});

describe("shiftAnchor", () => {
  it("moves by month and by week", () => {
    expect(shiftAnchor("month", "2026-03-10", 1)).toBe("2026-04-01");
    expect(shiftAnchor("month", "2026-03-10", -1)).toBe("2026-02-01");
    expect(shiftAnchor("list", "2026-03-10", 1)).toBe("2026-04-01");
    expect(shiftAnchor("week", "2026-03-08", 1)).toBe("2026-03-15");
    expect(shiftAnchor("week", "2026-03-08", -1)).toBe("2026-03-01");
  });

  it("crosses the end of the year in both directions", () => {
    expect(shiftAnchor("month", "2026-12-15", 1)).toBe("2027-01-01");
    expect(shiftAnchor("month", "2026-01-20", -1)).toBe("2025-12-01");
    expect(shiftAnchor("week", "2026-12-27", 1)).toBe("2027-01-03");
    expect(shiftAnchor("week", "2027-01-03", -1)).toBe("2026-12-27");
  });

  it("goes from the 31st to the next month without skipping one", () => {
    expect(shiftAnchor("month", "2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftAnchor("month", "2026-03-31", -1)).toBe("2026-02-01");
  });

  it("a week across two months", () => {
    expect(shiftAnchor("week", "2026-03-29", 1)).toBe("2026-04-05");
  });
});

describe("the days of a period", () => {
  it("the month grid has 42 days, from the Sunday before the 1st", () => {
    const days = monthGridDays("2026-04-15", "pt-BR");

    expect(days).toHaveLength(42);
    expect(days[0]).toBe("2026-03-29");
    expect(days[3]).toBe("2026-04-01");
    expect(days[41]).toBe("2026-05-09");
  });

  it("the week has seven days from the Sunday, across the end of the month", () => {
    expect(weekDays("2026-03-31", "pt-BR")).toEqual([
      "2026-03-29",
      "2026-03-30",
      "2026-03-31",
      "2026-04-01",
      "2026-04-02",
      "2026-04-03",
      "2026-04-04",
    ]);
  });

  it("the month has its own days, 28 or 29 in February", () => {
    expect(monthDays("2026-03-10")).toHaveLength(31);
    expect(monthDays("2026-02-10")).toHaveLength(28);
    expect(monthDays("2028-02-10")).toHaveLength(29);
    expect(monthDays("2026-03-10")[0]).toBe("2026-03-01");
    expect(monthDays("2026-03-10").at(-1)).toBe("2026-03-31");
  });
});

describe("groupLessonsByDay", () => {
  it("groups the lessons by day, each day in the order they start, and leaves out the empty days", () => {
    const late = buildLessonListItem({ id: "late", startTime: "14:00", endTime: "16:00" });
    const early = buildLessonListItem({ id: "early", startTime: "08:00", endTime: "09:30" });
    const noon = buildLessonListItem({ id: "noon", startTime: "09:30", endTime: "11:00" });
    const other = buildLessonListItem({ id: "other", date: "2026-03-12" });

    const grouped = groupLessonsByDay([late, other, early, noon]);

    expect([...grouped.keys()].sort()).toEqual(["2026-03-10", "2026-03-12"]);
    expect(grouped.get("2026-03-10")?.map((lesson) => lesson.id)).toEqual([
      "early",
      "noon",
      "late",
    ]);
    expect(grouped.get("2026-03-12")).toEqual([other]);
    expect(grouped.has("2026-03-11")).toBe(false);
  });

  it("orders two lessons that start together by the end, then by the class", () => {
    const longer = buildLessonListItem({ id: "longer", endTime: "12:00" });
    const shorter = buildLessonListItem({ id: "shorter", endTime: "10:00" });

    expect(
      groupLessonsByDay([longer, shorter])
        .get("2026-03-10")
        ?.map((lesson) => lesson.id),
    ).toEqual(["shorter", "longer"]);
  });

  it("is empty with no lessons", () => {
    expect(groupLessonsByDay([]).size).toBe(0);
  });
});

describe("formatPeriodTitle", () => {
  it("is the month and the year for the month and the agenda", () => {
    expect(formatPeriodTitle("month", "2026-03-10", "pt-BR")).toBe("março de 2026");
    expect(formatPeriodTitle("list", "2026-03-10", "pt-BR")).toBe("março de 2026");
    expect(formatPeriodTitle("month", "2026-03-10", "en-US")).toBe("March 2026");
  });

  it("is the days of the week for the week", () => {
    expect(formatPeriodTitle("week", "2026-03-10", "pt-BR")).toMatch(/^8\s.\s14 de março de 2026$/);
  });

  it("names both months when the week crosses them", () => {
    expect(formatPeriodTitle("week", "2026-03-31", "pt-BR")).toMatch(
      /^29 de março\s.\s4 de abril de 2026$/,
    );
  });
});

describe("formatDay", () => {
  it("writes the day as the options say, in the language of the app", () => {
    expect(
      formatDay("2026-03-10", "pt-BR", { weekday: "long", day: "numeric", month: "long" }),
    ).toBe("terça-feira, 10 de março");
    expect(
      formatDay("2026-03-10", "en-US", { weekday: "long", day: "numeric", month: "long" }),
    ).toBe("Tuesday, March 10");
  });

  it("does not move the day with the time zone", () => {
    expect(formatDay("2026-01-01", "pt-BR", { day: "numeric", month: "numeric" })).toBe("01/01");
  });
});
