import {
  LessonStatus,
  type ListLessonsCalendarParams,
  type ListLessonsParams,
} from "@api/generated/model";
import {
  ListLessonsQueryParams,
  listLessonsQuerySearchMax,
} from "@api/generated/zod/lessons/lessons";

/**
 * The keys of the URL that the list of lessons and the calendar read (GUS-155). The calendar also
 * keeps `view` and `date` in the URL, but those are its own (`calendar-period.ts`): the functions
 * here leave every key they do not know as it is.
 */
export const LESSON_FILTER_KEYS = [
  "search",
  "classId",
  "courseId",
  "status",
  "lessonPlanId",
  "from",
  "to",
  "page",
] as const;

export type LessonFilterKey = (typeof LESSON_FILTER_KEYS)[number];

/** The filters that narrow the list of lessons: the page is not one of them. */
export type LessonNarrowingKey = Exclude<LessonFilterKey, "page">;

/** What the list of lessons filters by: it has no filter by course. */
export const LIST_FILTER_KEYS = [
  "search",
  "classId",
  "status",
  "lessonPlanId",
  "from",
  "to",
] as const satisfies readonly LessonNarrowingKey[];

/** What the calendar filters by: the period is the one on the screen, and there is no search. */
export const CALENDAR_FILTER_KEYS = [
  "classId",
  "courseId",
  "status",
  "lessonPlanId",
] as const satisfies readonly LessonNarrowingKey[];

/** What the screen keeps in the URL: the empty string is "no filter". */
export interface LessonFilterValues {
  search: string;
  classId: string;
  courseId: string;
  status: LessonStatus | "";
  lessonPlanId: string;
  /** First day of the period, `YYYY-MM-DD`. */
  from: string;
  /** Last day of the period, `YYYY-MM-DD`. */
  to: string;
  page: number;
}

const STATUSES: readonly string[] = Object.values(LessonStatus);

/** Every key that narrows the list (all but the page). */
const NARROWING_KEYS = LESSON_FILTER_KEYS.filter(
  (key): key is LessonNarrowingKey => key !== "page",
);

const ID_SCHEMAS = {
  classId: ListLessonsQueryParams.shape.classId,
  courseId: ListLessonsQueryParams.shape.courseId,
  lessonPlanId: ListLessonsQueryParams.shape.lessonPlanId,
} as const;

/**
 * An id that is not a UUID is no filter: the contract says it is one (`ListLessonsQueryParams`,
 * generated), so it matches nothing, and sending it would only get a 400.
 */
function readId(key: keyof typeof ID_SCHEMAS, value: string | null): string {
  return value !== null && ID_SCHEMAS[key].safeParse(value).success ? value : "";
}

/** A day that is not a real `YYYY-MM-DD` is no filter, for the same reason as an id. */
function readDay(value: string | null): string {
  return value !== null && ListLessonsQueryParams.shape.from.safeParse(value).success ? value : "";
}

/**
 * The filters of the URL. Anything the API would refuse is read as "no filter", so an old or
 * hand-typed link does not break the screen: an id that is not a UUID, an unknown status, a day
 * that is not a date, and the end of a period that comes before its start (the end falls, and the
 * start stays). The search is cut at the 100 characters the API takes, and the page starts at 1.
 */
export function readLessonFilters(params: URLSearchParams): LessonFilterValues {
  const page = Number(params.get("page"));
  const status = params.get("status") ?? "";
  const from = readDay(params.get("from"));
  const to = readDay(params.get("to"));

  return {
    search: (params.get("search") ?? "").slice(0, listLessonsQuerySearchMax),
    classId: readId("classId", params.get("classId")),
    courseId: readId("courseId", params.get("courseId")),
    status: STATUSES.includes(status) ? (status as LessonStatus) : "",
    lessonPlanId: readId("lessonPlanId", params.get("lessonPlanId")),
    from,
    to: from !== "" && to !== "" && from > to ? "" : to,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/**
 * Whether any filter narrows what the screen shows: it tells "no lesson yet" from "no result" by
 * it. `keys` are the filters the screen has (`LIST_FILTER_KEYS` or `CALENDAR_FILTER_KEYS`): a key
 * the screen does not use, left in a hand-typed URL, must not count.
 */
export function hasActiveLessonFilters(
  filters: LessonFilterValues,
  keys: readonly LessonNarrowingKey[] = NARROWING_KEYS,
): boolean {
  return keys.some((key) =>
    key === "search" ? filters.search.trim() !== "" : filters[key] !== "",
  );
}

/**
 * The parameters of `listLessons` for the filters of the screen and the size of a page. The course
 * is not sent: the list has no filter by course (the calendar has).
 */
export function toListLessonsParams(filters: LessonFilterValues, limit: number): ListLessonsParams {
  const search = filters.search.trim();

  return {
    page: filters.page,
    limit,
    ...(search ? { search } : {}),
    ...(filters.classId ? { classId: filters.classId } : {}),
    ...(filters.lessonPlanId ? { lessonPlanId: filters.lessonPlanId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
  };
}

/**
 * The parameters of `listLessonsCalendar` for the filters of the screen and the days the calendar
 * shows (`range`, from `calendarRange`). Neither the search, nor the page, nor the period of the
 * list go: the calendar is read by the days on the screen.
 */
export function toListLessonsCalendarParams(
  filters: LessonFilterValues,
  range: { from: string; to: string },
): ListLessonsCalendarParams {
  return {
    from: range.from,
    to: range.to,
    ...(filters.classId ? { classId: filters.classId } : {}),
    ...(filters.courseId ? { courseId: filters.courseId } : {}),
    ...(filters.lessonPlanId ? { lessonPlanId: filters.lessonPlanId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };
}

/**
 * The URL after some filters changed: an empty value leaves the URL, and any change other than the
 * page sends the list back to page 1. The keys that are not filters (`view` and `date` of the
 * calendar) stay.
 */
export function withLessonFilters(
  params: URLSearchParams,
  changes: Partial<Record<LessonFilterKey, string>>,
): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(changes)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  if (!("page" in changes)) next.delete("page");
  return next;
}

/** The URL with every filter removed (Limpar filtros). `view` and `date` stay where they are. */
export function withoutLessonFilters(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of LESSON_FILTER_KEYS) next.delete(key);
  return next;
}
