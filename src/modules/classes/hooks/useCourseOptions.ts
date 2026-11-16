import type { ClassCourseResponseDto } from "@api/generated/model";

import { mockCourses } from "../mocks/classes.mock";

export interface CourseOptions {
  /** Every course, archived ones included: the screens decide what to offer (`selectableCourses`). */
  courses: ClassCourseResponseDto[];
  isPending: boolean;
  isError: boolean;
}

/**
 * The courses the class screens read: the select of the form, the course and level filters of the
 * list and the course of each class.
 *
 * TEMPORARY. The API has no list of courses yet (`GET /courses`, GUS-99), so this answers with the
 * mock courses, which is why their ids are not UUIDs (`computer`). The shape is already the one of
 * the API for the course of a class (`ClassCourseResponseDto`). When GUS-99 is done, only the body
 * of this hook changes, to `useListCourses()` mapped to `ClassCourseResponseDto`; the signature,
 * the form and the list stay. Same approach as `useLessonPlanOptions`, in the `catalog` module.
 */
export function useCourseOptions(): CourseOptions {
  return { courses: mockCourses, isPending: false, isError: false };
}
