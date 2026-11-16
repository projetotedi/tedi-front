import type { QueryClient } from "@tanstack/react-query";

import { getGetClassQueryKey } from "@api/generated/classes/classes";
import {
  getGetLessonQueryKey,
  getListLessonsCalendarQueryKey,
  getListLessonsQueryKey,
} from "@api/generated/lessons/lessons";
import type { LessonResponseDto } from "@api/generated/model";

/** `/lessons`: the first element of the key of every list of lessons, whatever its filters. */
const [LESSON_LISTS_KEY] = getListLessonsQueryKey();
/** `/lessons/calendar`: the same for the calendar, which is a list too, by period. */
const [LESSON_CALENDAR_KEY] = getListLessonsCalendarQueryKey();

function isLessonListKey(queryKey: readonly unknown[]): boolean {
  return queryKey[0] === LESSON_LISTS_KEY || queryKey[0] === LESSON_CALENDAR_KEY;
}

/**
 * What the app has to know after a lesson is created, edited, cancelled or rescheduled, with the
 * lesson the API answered:
 *
 * - the detail of that lesson becomes the answer (`originalDate`, `status` and the rest), so the
 *   screen that shows it changes with no new `GET`;
 * - every list of lessons and the calendar are out of date (the lesson may have moved, changed its
 *   status or appeared), whatever filter or period they were read with: they are fetched again when
 *   somebody looks at them, or right away if one is on the screen;
 * - the detail of the class is out of date too: its summary and its lessons change.
 *
 * The other lessons are not touched. A key the list screens add later has to fall under one of the
 * two prefixes above, or come in here.
 */
export async function applySavedLesson(
  queryClient: QueryClient,
  lesson: LessonResponseDto,
): Promise<void> {
  queryClient.setQueryData(getGetLessonQueryKey(lesson.id), lesson);

  await Promise.all([
    queryClient.invalidateQueries({ predicate: ({ queryKey }) => isLessonListKey(queryKey) }),
    queryClient.invalidateQueries({ queryKey: getGetClassQueryKey(lesson.class.id) }),
  ]);
}

/**
 * The detail of one lesson is out of date: the API said it is cancelled, or that it is gone, so
 * whatever shows it should ask again and show what is true now.
 */
export function invalidateLesson(queryClient: QueryClient, lessonId: string): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: getGetLessonQueryKey(lessonId) });
}
