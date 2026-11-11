import type { QueryClient } from "@tanstack/react-query";

import {
  getCreateCourseUrl,
  getGetCourseQueryKey,
  getListCourseLessonPlansQueryKey,
} from "@api/generated/catalog/catalog";
import type { CourseDetailDto, CourseLessonPlansResponseDto } from "@api/generated/model";

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
 * There is no course list in the contract yet. When `listCourses` exists, its key (the number of
 * lesson plans and the workload of each course) is invalidated here too.
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
    invalidateLessonPlans(queryClient),
  ]);
}
