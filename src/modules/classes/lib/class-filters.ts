import {
  ClassListSort,
  ClassStatus,
  CourseCategory,
  type ListClassesParams,
} from "@api/generated/model";

/** The keys of the URL that the list of classes reads (GUS-170). */
export const CLASS_FILTER_KEYS = [
  "search",
  "editionId",
  "courseId",
  "category",
  "status",
  "archived",
  "page",
] as const;

export type ClassFilterKey = (typeof CLASS_FILTER_KEYS)[number];

/** What the screen keeps in the URL: the empty string (or list) is "no filter". */
export interface ClassFilterValues {
  search: string;
  editionId: string;
  courseId: string;
  category: CourseCategory | "";
  statuses: ClassStatus[];
  archived: boolean;
  page: number;
}

const CLASS_STATUSES: readonly string[] = Object.values(ClassStatus);
const COURSE_CATEGORIES: readonly string[] = Object.values(CourseCategory);

/**
 * The filters of the URL. Anything unknown is read as "no filter", so an old or hand-typed link does
 * not break the screen, and the page starts at 1. `status` is a list, comma separated, as the API
 * takes it; `archived=true` shows only the archived classes (the API keeps the two apart).
 */
export function readClassFilters(params: URLSearchParams): ClassFilterValues {
  const page = Number(params.get("page"));
  const category = params.get("category") ?? "";

  return {
    search: params.get("search") ?? "",
    editionId: params.get("editionId") ?? "",
    courseId: params.get("courseId") ?? "",
    category: COURSE_CATEGORIES.includes(category) ? (category as CourseCategory) : "",
    statuses: (params.get("status") ?? "")
      .split(",")
      .filter((status): status is ClassStatus => CLASS_STATUSES.includes(status)),
    archived: params.get("archived") === "true",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Whether any filter narrows the list: the screen tells "no class yet" from "no result" by it. */
export function hasActiveClassFilters(filters: ClassFilterValues): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.editionId !== "" ||
    filters.courseId !== "" ||
    filters.category !== "" ||
    filters.statuses.length > 0 ||
    filters.archived
  );
}

/** The parameters of `listClasses` for the filters of the screen and the size of a page. */
export function toListClassesParams(filters: ClassFilterValues, limit: number): ListClassesParams {
  const search = filters.search.trim();

  return {
    page: filters.page,
    limit,
    sort: ClassListSort.startDate,
    ...(search ? { search } : {}),
    ...(filters.editionId ? { editionId: filters.editionId } : {}),
    ...(filters.courseId ? { courseId: filters.courseId } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.statuses.length > 0 ? { status: filters.statuses.join(",") } : {}),
    ...(filters.archived ? { archived: true } : {}),
  };
}

/**
 * The URL after one filter changed: the empty value leaves the URL, and any change other than the
 * page sends the list back to page 1.
 */
export function withClassFilter(
  params: URLSearchParams,
  key: ClassFilterKey,
  value: string,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value) next.set(key, value);
  else next.delete(key);
  if (key !== "page") next.delete("page");
  return next;
}

/** The URL with every filter of the list removed (Limpar filtros). */
export function withoutClassFilters(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of CLASS_FILTER_KEYS) next.delete(key);
  return next;
}
