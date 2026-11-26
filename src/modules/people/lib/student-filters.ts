import {
  AccessibilityNeed,
  StudentEnrollmentSituation,
  StudentListSort,
  type ListStudentsByEnrollmentParams,
  type ListStudentsParams,
} from "@api/generated/model";

/** The keys of the URL that the list of students reads (GUS-137). */
export const STUDENT_FILTER_KEYS = [
  "search",
  "classId",
  "situation",
  "accessibility",
  "page",
] as const;

export type StudentFilterKey = (typeof STUDENT_FILTER_KEYS)[number];

/** `any`: every category but `none`, as the API takes it. */
export const ANY_ACCESSIBILITY = "any";

export type AccessibilityFilter = AccessibilityNeed | typeof ANY_ACCESSIBILITY | "";

/** What the screen keeps in the URL: the empty string is "no filter". */
export interface StudentFilterValues {
  search: string;
  classId: string;
  situation: StudentEnrollmentSituation | "";
  accessibility: AccessibilityFilter;
  page: number;
}

const SITUATIONS: readonly string[] = Object.values(StudentEnrollmentSituation);
const ACCESSIBILITY: readonly string[] = [...Object.values(AccessibilityNeed), ANY_ACCESSIBILITY];

/** The filters of the URL; anything unknown is "no filter", and the page starts at 1. */
export function readStudentFilters(params: URLSearchParams): StudentFilterValues {
  const page = Number(params.get("page"));
  const situation = params.get("situation") ?? "";
  const accessibility = params.get("accessibility") ?? "";

  return {
    search: params.get("search") ?? "",
    classId: params.get("classId") ?? "",
    situation: SITUATIONS.includes(situation) ? (situation as StudentEnrollmentSituation) : "",
    accessibility: ACCESSIBILITY.includes(accessibility)
      ? (accessibility as AccessibilityFilter)
      : "",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/**
 * Turma or Situação narrow the list by enrollment: the screen reads `listStudentsByEnrollment`,
 * which knows the classes of each student but not the accessibility. Without them it reads
 * `listStudents`, which filters by accessibility. The search goes to both, so changing the source
 * keeps what was typed.
 */
export function usesEnrollmentSource(filters: StudentFilterValues): boolean {
  return filters.classId !== "" || filters.situation !== "";
}

/** Whether any filter narrows the list: the screen tells "no student yet" from "no result" by it. */
export function hasActiveStudentFilters(filters: StudentFilterValues): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.classId !== "" ||
    filters.situation !== "" ||
    filters.accessibility !== ""
  );
}

/** The parameters of `listStudents`, alphabetical. */
export function toListStudentsParams(
  filters: StudentFilterValues,
  limit: number,
): ListStudentsParams {
  const search = filters.search.trim();
  return {
    page: filters.page,
    limit,
    sort: StudentListSort.name,
    ...(search ? { search } : {}),
    ...(filters.accessibility ? { accessibilityNeed: filters.accessibility } : {}),
  };
}

/** The parameters of `listStudentsByEnrollment`. Only a class lists the enrolled ones of it. */
export function toListStudentsByEnrollmentParams(
  filters: StudentFilterValues,
  limit: number,
): ListStudentsByEnrollmentParams {
  const search = filters.search.trim();
  return {
    page: filters.page,
    limit,
    ...(search ? { search } : {}),
    ...(filters.classId ? { classId: filters.classId } : {}),
    ...(filters.situation ? { situation: filters.situation } : {}),
  };
}

/** The URL after one filter changed: the empty value leaves it, and any change but the page goes to page 1. */
export function withStudentFilter(
  params: URLSearchParams,
  key: StudentFilterKey,
  value: string,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value) next.set(key, value);
  else next.delete(key);
  if (key !== "page") next.delete("page");
  return next;
}

/** The URL with every filter of the list removed (Limpar filtros). */
export function withoutStudentFilters(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of STUDENT_FILTER_KEYS) next.delete(key);
  return next;
}
