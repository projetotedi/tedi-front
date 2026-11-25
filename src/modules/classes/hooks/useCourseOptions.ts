import { useListCourses } from "@api/generated/catalog/catalog";
import { CourseListSort, type ClassCourseResponseDto } from "@api/generated/model";

/** The most courses the API gives in one page; the catalog of the project is far below it. */
const COURSE_OPTIONS_LIMIT = 100;

export interface CourseOptions {
  /** Every course, archived ones included: the screens decide what to offer (`selectableCourses`). */
  courses: ClassCourseResponseDto[];
  isPending: boolean;
  isError: boolean;
}

/**
 * The courses the class screens read: the select of the form and the course filter of the list. One
 * page of `listCourses` by name, with no status, so it brings the active and the archived ones: the
 * filter of the list and the course a class already has need the archived ones too, and the form
 * leaves them out itself (`selectableCourses`). Each one is cut down to the shape of the course of a
 * class (`ClassCourseResponseDto`), which is what the screens know.
 */
export function useCourseOptions(): CourseOptions {
  const query = useListCourses({ limit: COURSE_OPTIONS_LIMIT, sort: CourseListSort.name });
  const courses = (query.data?.data ?? []).map(({ id, name, category, status }) => ({
    id,
    name,
    category,
    status,
  }));

  return { courses, isPending: query.isPending, isError: query.isError };
}
