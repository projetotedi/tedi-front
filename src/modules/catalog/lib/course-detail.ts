import type { CourseDetailDto, CourseLessonPlansResponseDto } from "@api/generated/model";
import { GetCourseParams } from "@api/generated/zod/catalog/catalog";

const COURSE_NOT_FOUND = "COURSE_NOT_FOUND";

interface ApiErrorShape {
  statusCode?: unknown;
  error?: unknown;
}

/**
 * The id of the route comes from the URL, which can be typed by hand or come from an old link. The
 * contract says a course id is a UUID (`GetCourseParams`, generated), so anything else cannot exist
 * and there is nothing to ask the API. The same rule as `isLessonPlanId`.
 */
export function isCourseId(value: string): boolean {
  return GetCourseParams.safeParse({ id: value }).success;
}

/**
 * Whether the error of `GET /courses/:id` is the 404 `COURSE_NOT_FOUND` of the contract. It reads
 * the code with the status, as the other error helpers of the module do: a 404 that does not come
 * from the API (a gateway, a route that is not deployed) says nothing about this course, and the
 * person gets the error with "Tentar de novo" instead.
 */
export function isCourseNotFound(error: unknown): boolean {
  const { statusCode, error: code }: ApiErrorShape =
    typeof error === "object" && error !== null ? error : {};

  return statusCode === 404 && code === COURSE_NOT_FOUND;
}

/**
 * The sequence of the course as `CoursePlanCard` and `BuildSequenceDialog` read it. The detail has
 * everything the sequence has (`GET /courses/:id/lesson-plans` answers the same items and the same
 * workload), so the screen asks only for the detail and hands the two components this view of it.
 */
export function toCourseSequence(course: CourseDetailDto): CourseLessonPlansResponseDto {
  return {
    courseId: course.id,
    items: course.lessonPlans,
    plannedWorkloadMinutes: course.plannedWorkloadMinutes,
  };
}

/**
 * The detail of a course after its sequence was saved: the plans, how many they are and the
 * workload become what the `PUT` answered, and the rest stays. Nothing is added up here, the
 * workload is the one the API computed (RF-018, RN-24).
 */
export function withReplacedSequence(
  course: CourseDetailDto,
  response: CourseLessonPlansResponseDto,
): CourseDetailDto {
  return {
    ...course,
    lessonPlans: response.items,
    lessonPlanCount: response.items.length,
    plannedWorkloadMinutes: response.plannedWorkloadMinutes,
  };
}
