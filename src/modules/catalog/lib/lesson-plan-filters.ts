import {
  LessonPlanListSort,
  LessonPlanUsageFilter,
  type ListLessonPlansParams,
} from "@api/generated/model";

/** The keys of the URL that the list of lesson plans reads (GUS-127). */
export const LESSON_PLAN_FILTER_KEYS = [
  "search",
  "content",
  "usage",
  "minDuration",
  "maxDuration",
  "page",
] as const;

export type LessonPlanFilterKey = (typeof LESSON_PLAN_FILTER_KEYS)[number];

/** The ranges of the filter Duração, in minutes, as in the Figma. */
export interface DurationFilter {
  id: string;
  minDuration?: number;
  maxDuration?: number;
}

export const DURATION_FILTERS: DurationFilter[] = [
  { id: "" },
  { id: "up-to-90", maxDuration: 90 },
  { id: "91-to-120", minDuration: 91, maxDuration: 120 },
  { id: "over-120", minDuration: 121 },
];

/** What the screen keeps in the URL: the empty string is "no filter". */
export interface LessonPlanFilterValues {
  search: string;
  content: string;
  usage: LessonPlanUsageFilter | "";
  /** The id of the range of `DURATION_FILTERS`, or "" when the URL has none of them. */
  duration: string;
  page: number;
}

const USAGES: readonly string[] = Object.values(LessonPlanUsageFilter);

function durationOf(params: URLSearchParams): string {
  const minDuration = params.get("minDuration") ?? "";
  const maxDuration = params.get("maxDuration") ?? "";
  return (
    DURATION_FILTERS.find(
      (filter) =>
        String(filter.minDuration ?? "") === minDuration &&
        String(filter.maxDuration ?? "") === maxDuration,
    )?.id ?? ""
  );
}

/**
 * The filters of the URL. Anything unknown is read as "no filter", so an old or hand-typed link does
 * not break the screen, and the page starts at 1. A range of duration that is not one of the
 * screen's is no filter either: the API would take it, but the select could not show it.
 */
export function readLessonPlanFilters(params: URLSearchParams): LessonPlanFilterValues {
  const page = Number(params.get("page"));
  const usage = params.get("usage") ?? "";

  return {
    search: params.get("search") ?? "",
    content: params.get("content") ?? "",
    usage: USAGES.includes(usage) ? (usage as LessonPlanUsageFilter) : "",
    duration: durationOf(params),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Whether any filter narrows the list: the screen tells "no plan yet" from "no result" by it. */
export function hasActiveLessonPlanFilters(filters: LessonPlanFilterValues): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.content !== "" ||
    filters.usage !== "" ||
    filters.duration !== ""
  );
}

/** The parameters of `listLessonPlans` for the filters of the screen and the size of a page. */
export function toListLessonPlansParams(
  filters: LessonPlanFilterValues,
  limit: number,
): ListLessonPlansParams {
  const search = filters.search.trim();
  const range = DURATION_FILTERS.find((filter) => filter.id === filters.duration);

  return {
    page: filters.page,
    limit,
    sort: LessonPlanListSort.title,
    ...(search ? { search } : {}),
    ...(filters.content ? { content: filters.content } : {}),
    ...(filters.usage ? { usage: filters.usage } : {}),
    ...(range?.minDuration !== undefined ? { minDuration: range.minDuration } : {}),
    ...(range?.maxDuration !== undefined ? { maxDuration: range.maxDuration } : {}),
  };
}

/**
 * The URL after some filters changed: an empty value leaves the URL, and any change other than the
 * page sends the list back to page 1.
 */
export function withLessonPlanFilters(
  params: URLSearchParams,
  changes: Partial<Record<LessonPlanFilterKey, string>>,
): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(changes)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  if (!("page" in changes)) next.delete("page");
  return next;
}

/** The URL after the filter Duração changed to the range `id` ("" for all). */
export function withDurationFilter(params: URLSearchParams, id: string): URLSearchParams {
  const range = DURATION_FILTERS.find((filter) => filter.id === id) ?? DURATION_FILTERS[0];
  return withLessonPlanFilters(params, {
    minDuration: range.minDuration === undefined ? "" : String(range.minDuration),
    maxDuration: range.maxDuration === undefined ? "" : String(range.maxDuration),
  });
}

/** The URL with every filter of the list removed (Limpar filtros). */
export function withoutLessonPlanFilters(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of LESSON_PLAN_FILTER_KEYS) next.delete(key);
  return next;
}
