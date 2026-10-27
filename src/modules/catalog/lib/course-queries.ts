import type { QueryClient } from "@tanstack/react-query";

import {
  getCreateCourseUrl,
  getListCourseLessonPlansQueryKey,
} from "@api/generated/catalog/catalog";
import type { CourseLessonPlansResponseDto } from "@api/generated/model";

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

/**
 * What the app has to know after a sequence is saved:
 *
 * - the sequence of this course becomes exactly what the `PUT` answered, so the card shows the
 *   workload that the API computed (RF-018) and not one that was recalculated here;
 * - `courseCount` of the plans that came in or went out changes in the sequences of the other
 *   courses that use them, and `usedIn` of those plans changes in their detail (and the usage the
 *   RF-017 confirmation reads): all of those are fetched again when somebody looks at them.
 *
 * There is no course detail or course list in the contract yet. When `getCourse` and `listCourses`
 * exist, their keys (the number of lesson plans and the workload of the course) are invalidated
 * here too.
 */
export async function applyReplacedSequence(
  queryClient: QueryClient,
  courseId: string,
  response: CourseLessonPlansResponseDto,
): Promise<void> {
  const [currentKey] = getListCourseLessonPlansQueryKey(courseId);
  queryClient.setQueryData(getListCourseLessonPlansQueryKey(courseId), response);

  await Promise.all([
    queryClient.invalidateQueries({
      predicate: ({ queryKey }) => isCourseSequenceKey(queryKey) && queryKey[0] !== currentKey,
    }),
    invalidateLessonPlans(queryClient),
  ]);
}
