import { CourseCategory, CourseStatus, type ListCoursesParams } from "@api/generated/model";

/** The keys of the URL that the list of courses reads (GUS-131). */
export const COURSE_FILTER_KEYS = ["search", "category", "status", "prerequisite", "page"] as const;

export type CoursePrerequisiteFilter = "" | "with" | "without";

/** What the screen keeps in the URL, as text: the empty string is "no filter". */
export interface CourseFilterValues {
  search: string;
  category: CourseCategory | "";
  status: CourseStatus | "";
  prerequisite: CoursePrerequisiteFilter;
  page: number;
}

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | "" {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : "";
}

/**
 * The filters of the URL, with anything unknown read as "no filter" (a hand-typed or old link must
 * not break the screen) and the page from 1.
 */
export function readCourseFilters(params: URLSearchParams): CourseFilterValues {
  const page = Number(params.get("page"));

  return {
    search: params.get("search") ?? "",
    category: oneOf(params.get("category"), Object.values(CourseCategory)),
    status: oneOf(params.get("status"), Object.values(CourseStatus)),
    prerequisite: oneOf(params.get("prerequisite"), ["with", "without"] as const),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Whether any filter narrows the list: the screen tells "no course yet" from "no result" by it. */
export function hasActiveCourseFilters(filters: CourseFilterValues): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.category !== "" ||
    filters.status !== "" ||
    filters.prerequisite !== ""
  );
}

/** The parameters of `listCourses` for the filters of the screen and the size of a page. */
export function toListCoursesParams(
  filters: CourseFilterValues,
  search: string,
  limit: number,
): ListCoursesParams {
  return {
    page: filters.page,
    limit,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.prerequisite ? { hasPrerequisite: filters.prerequisite === "with" } : {}),
  };
}

/**
 * The URL after one filter changed: the empty value leaves the URL, and any change other than the
 * page sends the list back to page 1 (GUS-131).
 */
export function withCourseFilter(
  params: URLSearchParams,
  key: (typeof COURSE_FILTER_KEYS)[number],
  value: string,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value) next.set(key, value);
  else next.delete(key);
  if (key !== "page") next.delete("page");
  return next;
}

/** The URL with every filter of the list removed (Limpar filtros). */
export function withoutCourseFilters(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of COURSE_FILTER_KEYS) next.delete(key);
  return next;
}
