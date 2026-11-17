import type { QueryClient } from "@tanstack/react-query";

import {
  getListLessonAssignmentsQueryKey,
  getListMemberAssignmentsQueryKey,
  getListMyAssignmentsQueryKey,
  getListOpenLessonsQueryKey,
  getListPendingApplicationsQueryKey,
} from "@api/generated/assignments/assignments";
import {
  getGetLessonQueryKey,
  getListLessonsCalendarQueryKey,
  getListLessonsQueryKey,
} from "@api/generated/lessons/lessons";
import {
  ListPendingApplicationsStatus,
  type LessonAssignmentResponseDto,
  type ListPendingApplicationsParams,
} from "@api/generated/model";

/**
 * The parameters of the queue of applications, the same in the button that counts and in the dialog
 * that lists. They are the query key, so using one object in both makes them one query: the number
 * on the button is the `total` of the very answer the dialog lists (C9), and the two never differ.
 */
export const PENDING_APPLICATIONS_PARAMS = {
  status: ListPendingApplicationsStatus.pending,
} as const satisfies ListPendingApplicationsParams;

/**
 * What the app has to know after somebody applies to a lesson:
 *
 * - the agenda of the member (`/me/assignments`) and the lessons with a vacancy
 *   (`/me/open-lessons`) change, whatever period they were read with: the lesson leaves one and
 *   enters the other. The keys without the parameters are the prefix of all;
 * - the queue of the applications (`/applications`) has one more, which moves the counter of the
 *   button of who reviews;
 * - the assignments of that lesson (`/lessons/:id/assignments`) have one more.
 *
 * The coverage does not change: a pending application takes no place (C1), so the lists of lessons
 * are left alone.
 */
export async function invalidateAfterApplied(
  queryClient: QueryClient,
  lessonId: string,
): Promise<void> {
  await Promise.all([
    invalidateQueue(queryClient),
    invalidateAroundTheQueue(queryClient, lessonId),
  ]);
}

/** The queue of the applications (`/applications`, whatever its parameters). */
function invalidateQueue(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: getListPendingApplicationsQueryKey() });
}

/** What an application changes besides the queue: the agenda, the lessons with a vacancy, the lesson's assignments. */
function invalidateAroundTheQueue(queryClient: QueryClient, lessonId: string): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: getListMyAssignmentsQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getListOpenLessonsQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getListLessonAssignmentsQueryKey(lessonId) }),
  ]);
}

/**
 * What the app has to know after an application is confirmed or declined (or the API says it was
 * already decided): everything that applying changes, plus what shows the coverage of the lesson,
 * since a confirmation fills a place and every answer of `lessons` carries `coverage`:
 *
 * - the lists of lessons and the calendar (by their two prefixes, whatever the filters);
 * - the detail of that lesson;
 * - the assignments of the member of the application, when the person still exists.
 *
 * It settles when **the queue** has been read again, and only then: the dialog that asked is the
 * one waiting, for its own list, and what is behind it (the agenda and the lessons with a vacancy of
 * the page, the lists of lessons, the detail) can be slow, so it is read again in the background
 * instead of holding the buttons of the dialog. Everything is marked out of date at once, though, so
 * what is not on the screen is read again the next time somebody looks.
 *
 * Importing the keys of `lessons` is importing the contract, not the module: they are generated.
 */
export async function invalidateAfterReviewed(
  queryClient: QueryClient,
  application: LessonAssignmentResponseDto,
): Promise<void> {
  // The queue first, so its request is the first one on its way; the rest follows without waiting.
  const queueRead = invalidateQueue(queryClient);

  void Promise.all([
    invalidateAroundTheQueue(queryClient, application.lessonId),
    queryClient.invalidateQueries({ queryKey: getListLessonsQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getListLessonsCalendarQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getGetLessonQueryKey(application.lessonId) }),
    ...(application.person === null
      ? []
      : [
          queryClient.invalidateQueries({
            queryKey: getListMemberAssignmentsQueryKey(application.person.id),
          }),
        ]),
  ]);

  await queueRead;
}
