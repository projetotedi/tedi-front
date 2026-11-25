import {
  endOfMonth,
  getLocalTimeZone,
  parseDate,
  startOfMonth,
  startOfWeek,
  today,
} from "@internationalized/date";

import type { LessonListItemResponseDto } from "@api/generated/model";

/** How the calendar shows the lessons: an agenda of the month, the grid of the month, or one week. */
export const CALENDAR_VIEWS = ["list", "month", "week"] as const;

export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export const DEFAULT_CALENDAR_VIEW: CalendarView = "month";

/**
 * The days the month grid draws: six weeks, which is also the most days the API gives in one
 * period (`DATE_RANGE_TOO_LONG`), so a month is always one request.
 */
const MONTH_GRID_DAYS = 42;
const DAYS_IN_WEEK = 7;

/** `YYYY-MM-DD`, the format of the API and of the `date` in the URL. */
const DAY_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

/** The view of the URL (`?view=`). Anything else, or nothing, is the month. */
export function readCalendarView(params: URLSearchParams): CalendarView {
  const view = params.get("view");
  return CALENDAR_VIEWS.find((candidate) => candidate === view) ?? DEFAULT_CALENDAR_VIEW;
}

/** Today in the time zone of the person, as `YYYY-MM-DD` (never the day in UTC). */
export function todayIso(): string {
  return today(getLocalTimeZone()).toString();
}

/**
 * The day of the URL (`?date=`): any day of the period on the screen. A value that is not a real
 * date ("2026-02-31", which a date library would quietly move to the 28th) is the `fallback`.
 */
export function readAnchorDate(params: URLSearchParams, fallback: string): string {
  const value = params.get("date");
  if (value === null || !DAY_FORMAT.test(value)) return fallback;

  try {
    return parseDate(value).toString() === value ? value : fallback;
  } catch {
    return fallback;
  }
}

/**
 * The days the API is asked for, `from` and `to` included. The agenda and the month use the same
 * ones, the 42 days of the grid (from the first day of the week that holds the 1st), so going from
 * one to the other asks for nothing; the week is its own seven days. The week starts on the first
 * day of the week of the language (Sunday, in pt-BR and en-US).
 */
export function calendarRange(
  view: CalendarView,
  anchor: string,
  locale: string,
): { from: string; to: string } {
  const date = parseDate(anchor);

  if (view === "week") {
    const from = startOfWeek(date, locale);
    return { from: from.toString(), to: from.add({ days: DAYS_IN_WEEK - 1 }).toString() };
  }

  const from = startOfWeek(startOfMonth(date), locale);
  return { from: from.toString(), to: from.add({ days: MONTH_GRID_DAYS - 1 }).toString() };
}

/**
 * The day to keep in the URL for a view: the 1st of the month for the month and the agenda, the
 * first day of the week for the week. Every link of the calendar writes it, so the same period has
 * the same URL, however the person got there.
 */
export function anchorForView(view: CalendarView, anchor: string, locale: string): string {
  const date = parseDate(anchor);
  return (view === "week" ? startOfWeek(date, locale) : startOfMonth(date)).toString();
}

/**
 * The anchor of the next period (`step` 1) or of the previous one (`step` -1): a month for the
 * month and the agenda, and the 1st of that month, and seven days for the week. The change of year
 * and a week across two months need nothing more.
 */
export function shiftAnchor(view: CalendarView, anchor: string, step: 1 | -1): string {
  const date = parseDate(anchor);

  if (view === "week") return date.add({ days: DAYS_IN_WEEK * step }).toString();
  return startOfMonth(date).add({ months: step }).toString();
}

function daysFrom(first: string, count: number): string[] {
  const start = parseDate(first);
  return Array.from({ length: count }, (_, index) => start.add({ days: index }).toString());
}

/** The 42 days of the grid of the month, from the first day of the week that holds the 1st. */
export function monthGridDays(anchor: string, locale: string): string[] {
  return daysFrom(calendarRange("month", anchor, locale).from, MONTH_GRID_DAYS);
}

/** The seven days of the week of `anchor`. */
export function weekDays(anchor: string, locale: string): string[] {
  return daysFrom(calendarRange("week", anchor, locale).from, DAYS_IN_WEEK);
}

/** The days of the month of `anchor`, and only them: what the agenda goes through. */
export function monthDays(anchor: string): string[] {
  const date = parseDate(anchor);
  const first = startOfMonth(date);
  return daysFrom(first.toString(), endOfMonth(date).day);
}

function compareByStart(
  first: LessonListItemResponseDto,
  second: LessonListItemResponseDto,
): number {
  // `HH:mm` with two digits, so comparing the text is comparing the time.
  if (first.startTime !== second.startTime) return first.startTime < second.startTime ? -1 : 1;
  if (first.endTime !== second.endTime) return first.endTime < second.endTime ? -1 : 1;
  return (
    first.class.name.localeCompare(second.class.name) || first.title.localeCompare(second.title)
  );
}

/** The lessons of each day (`YYYY-MM-DD`), in the order they start. A day with none is not there. */
export function groupLessonsByDay(
  lessons: readonly LessonListItemResponseDto[],
): Map<string, LessonListItemResponseDto[]> {
  const byDay = new Map<string, LessonListItemResponseDto[]>();

  for (const lesson of lessons) {
    const day = byDay.get(lesson.date);
    if (day === undefined) byDay.set(lesson.date, [lesson]);
    else day.push(lesson);
  }
  for (const day of byDay.values()) day.sort(compareByStart);

  return byDay;
}

/**
 * A day as a local `Date`, at noon: read as a calendar day, with no time zone, it never falls on the
 * day before, and no change of the clock moves it to another one.
 */
function toLocalDate(day: string): Date {
  const { year, month, day: dayOfMonth } = parseDate(day);
  return new Date(year, month - 1, dayOfMonth, 12);
}

/**
 * A day written by the rules of the language, as the options say: "terça-feira, 10 de março",
 * "seg." and so on.
 */
export function formatDay(
  day: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, options).format(toLocalDate(day));
}

/**
 * The title of the period on the screen: "março de 2026" for the month and the agenda, and the days
 * of the week for the week ("8 – 14 de março de 2026", or across two months "29 de março – 4 de
 * abril de 2026").
 */
export function formatPeriodTitle(view: CalendarView, anchor: string, locale: string): string {
  if (view !== "week") return formatDay(anchor, locale, { month: "long", year: "numeric" });

  const { from, to } = calendarRange("week", anchor, locale);
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatRange(toLocalDate(from), toLocalDate(to));
}
