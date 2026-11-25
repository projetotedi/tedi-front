import type { QueryClient } from "@tanstack/react-query";

import {
  getCreateCourseUrl,
  getGetCourseQueryKey,
  getListCourseLessonPlansQueryKey,
} from "@api/generated/catalog/catalog";
import type {
  CourseDetailDto,
  CourseLessonPlansResponseDto,
  CourseResponseDto,
} from "@api/generated/model";

import { withReplacedSequence } from "./course-detail";
import { invalidateLessonPlans } from "./lesson-plan-queries";

const SEQUENCE_PATH_SUFFIX = "/lesson-plans";

/** `/courses/<id>/lesson-plans`: the query key of the sequence of any course. */
function isCourseSequenceKey(queryKey: readonly unknown[]): boolean {
  const [key] = queryKey;

  return (
    typeof key === "string" &&
    key.startsWith(`${getCreateCourseUrl()}/`) &&
    key.endsWith(SEQUENCE_PATH_SUFFIX)
  );
}

/** `/courses` and everything under it: the key of a list of courses, of a detail and of a sequence. */
function isCoursesKey(queryKey: readonly unknown[]): boolean {
  const [key] = queryKey;
  const base = getCreateCourseUrl();

  return typeof key === "string" && (key === base || key.startsWith(`${base}/`));
}

/** `/courses` itself: the key of every page of `listCourses`, whatever its filters. */
function isCourseListKey(queryKey: readonly unknown[]): boolean {
  return queryKey[0] === getCreateCourseUrl();
}

/** `/courses/<id>`: the query key of the detail of any course, and not of what hangs from it. */
function isCourseDetailKey(queryKey: readonly unknown[]): boolean {
  const [key] = queryKey;
  const prefix = `${getCreateCourseUrl()}/`;

  return (
    typeof key === "string" && key.startsWith(prefix) && !key.slice(prefix.length).includes("/")
  );
}

/**
 * What the app has to know after a sequence is saved:
 *
 * - the course on the screen becomes what the `PUT` answered: its detail (which the page reads)
 *   gets the plans, how many they are and the workload of the response, and so does the sequence
 *   key, so the header, the workload card and the plan card change together, show the workload
 *   that the API computed (RF-018) and not one that was recalculated here, and need no new `GET`.
 *   The only field of the detail left behind is `updatedAt`, which the screen does not show;
 * - `courseCount` of the plans that came in or went out changes in the sequence and in the detail
 *   of the other courses that use them, and `usedIn` of those plans changes in their detail (and
 *   the usage the RF-017 confirmation reads): all of those are fetched again when somebody looks
 *   at them.
 *
 * - the list of courses (`listCourses`, GUS-131) shows the number of lesson plans and the workload
 *   of each course, so every page of it is fetched again too.
 */
export async function applyReplacedSequence(
  queryClient: QueryClient,
  courseId: string,
  response: CourseLessonPlansResponseDto,
): Promise<void> {
  const [currentSequenceKey] = getListCourseLessonPlansQueryKey(courseId);
  const [currentDetailKey] = getGetCourseQueryKey(courseId);
  queryClient.setQueryData(getListCourseLessonPlansQueryKey(courseId), response);
  queryClient.setQueryData<CourseDetailDto>(
    getGetCourseQueryKey(courseId),
    (course) => course && withReplacedSequence(course, response),
  );

  await Promise.all([
    queryClient.invalidateQueries({
      predicate: ({ queryKey }) =>
        isCourseSequenceKey(queryKey) && queryKey[0] !== currentSequenceKey,
    }),
    queryClient.invalidateQueries({
      predicate: ({ queryKey }) => isCourseDetailKey(queryKey) && queryKey[0] !== currentDetailKey,
    }),
    queryClient.invalidateQueries({ predicate: ({ queryKey }) => isCourseListKey(queryKey) }),
    invalidateLessonPlans(queryClient),
  ]);
}

/**
 * What the app has to know after a course is duplicated (RF-019):
 *
 * - there is one more course, so whatever lists courses is out of date: every key under `/courses`,
 *   the one of `listCourses` included;
 * - the copy gets the lesson plans of the original, in the same order, and a lesson plan is shared
 *   by the courses that use it (RN-17), so each of those plans is now in one more course. That is
 *   `courseCount` in the sequence of the original and of the other courses that use the same plans
 *   (the detail and the sequence keys, which are under `/courses` too) and `usedIn` in the detail
 *   of each plan, so the lesson plans are invalidated as well.
 *
 * Nothing is written into the cache from the answer of the `POST`: it is a `CourseResponseDto`, with
 * no sequence, no workload and no `requiredBy`, so it is not the detail of a course. The detail of
 * the copy is fetched when the screen opens it.
 */
export async function invalidateAfterCourseDuplicated(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ predicate: ({ queryKey }) => isCoursesKey(queryKey) }),
    invalidateLessonPlans(queryClient),
  ]);
}

/**
 * What the app has to know after a course is archived or reactivated (RN-27, RF-020, GUS-139):
 *
 * - the detail on the screen takes the status, the date and the reason from the answer of the
 *   `PATCH` at once, so the header, the plan card and the history change together without waiting
 *   for a new `GET` (the answer is a `CourseResponseDto`, not the detail, so only those fields are
 *   copied);
 * - every other key under `/courses` is out of date: the lists (an archived course leaves
 *   `status=active`, which the selectors of a new class and of prerequisites read) and the detail
 *   of the courses that show this one as a prerequisite or in `requiredBy`, with its status. The
 *   detail of this course is fetched again too, to bring `updatedAt` and anything else it holds.
 *
 * The classes of the course do not change (they stay as they are), so their keys are left alone.
 */
export async function invalidateAfterCourseArchiveChanged(
  queryClient: QueryClient,
  course: CourseResponseDto,
): Promise<void> {
  queryClient.setQueryData<CourseDetailDto>(
    getGetCourseQueryKey(course.id),
    (detail) =>
      detail && {
        ...detail,
        status: course.status,
        archivedAt: course.archivedAt,
        archiveReason: course.archiveReason,
        updatedAt: course.updatedAt,
      },
  );

  await queryClient.invalidateQueries({ predicate: ({ queryKey }) => isCoursesKey(queryKey) });
}

/** `/classes` and everything under it: the lists, the detail and the summaries of classes. */
function isClassesKey(queryKey: readonly unknown[]): boolean {
  const [key] = queryKey;
  return typeof key === "string" && (key === "/classes" || key.startsWith("/classes/"));
}

/**
 * What the app has to know after a course is created or edited (GUS-129):
 *
 * - every key under `/courses`: the list (name, category and prerequisites of each course), the
 *   detail of this course and the detail of the courses that show it as a prerequisite or in
 *   `requiredBy`, with its name and category;
 * - every key under `/classes`: a class shows the current category and name of its course
 *   (RN-14, GUS-102), so its list and its detail are fetched again. The URL is the one of the
 *   generated client of the classes routes, which this module only reads through its keys.
 *
 * Nothing is written into the cache from the answer: it is a `CourseResponseDto`, and the detail
 * brings more than it (the prerequisites with their status, the sequence and the workload).
 */
export async function invalidateAfterCourseSaved(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ predicate: ({ queryKey }) => isCoursesKey(queryKey) }),
    queryClient.invalidateQueries({ predicate: ({ queryKey }) => isClassesKey(queryKey) }),
  ]);
}
