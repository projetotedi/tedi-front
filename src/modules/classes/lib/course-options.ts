import { ClassStatus, CourseStatus, type ClassCourseResponseDto } from "@api/generated/model";

/**
 * The courses a class can be offered by (RF-020, RN-27): the active ones, ordered by name. The
 * course the class already has stays on the list even when it was archived since, because a class
 * keeps its course; it is the only archived one that does, since an archived course takes no new
 * class. The array that comes in is not changed.
 */
export function selectableCourses(
  courses: readonly ClassCourseResponseDto[],
  currentCourseId?: string,
): ClassCourseResponseDto[] {
  return courses
    .filter((course) => course.status === CourseStatus.active || course.id === currentCourseId)
    .sort((first, second) => first.name.localeCompare(second.name, "pt-BR"));
}

export interface CourseChangeSubject {
  /** The status the class has SAVED, not the one the form is showing right now (P11). */
  status: ClassStatus;
  /** Active enrollments of the class. */
  enrolledCount: number;
}

/**
 * Whether the course of a class can still be changed: only while it is planned and has no active
 * enrollment (the API refuses it with 409 `COURSE_CHANGE_NOT_ALLOWED` otherwise). The screen uses
 * it to turn the field off with a hint, instead of letting the person find out by the error.
 */
export function canChangeCourse({ status, enrolledCount }: CourseChangeSubject): boolean {
  return status === ClassStatus.planned && enrolledCount === 0;
}

export function findCourse(
  courses: readonly ClassCourseResponseDto[],
  courseId: string,
): ClassCourseResponseDto | undefined {
  return courses.find((course) => course.id === courseId);
}

/**
 * How many classes of the course there are besides the one on screen. The list of the classes of a
 * course (`GET /courses/:id/classes`) counts only the classes that are not archived (RN-27), so
 * this class is in the total when it is active and is not when it is archived.
 */
export function otherClassesCount(total: number, isClassArchived: boolean): number {
  return Math.max(0, total - (isClassArchived ? 0 : 1));
}
