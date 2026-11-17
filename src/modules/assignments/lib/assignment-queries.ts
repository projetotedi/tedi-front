import type { QueryClient, QueryKey } from "@tanstack/react-query";

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

export interface AssignmentChange {
  /** The lesson whose assignments changed. */
  lessonId: string;
  /** The member whose assignments changed; `null` when it is not known, and then no member's list is touched. */
  personId: string | null;
}

/**
 * What the app has to know after an assignment is created or cancelled:
 *
 * - the assignments of the lesson and the lesson itself (`getLesson`, which carries the coverage and
 *   `belowExpectedMonitors`, counted over the confirmed assignments), so the card Cobertura da aula
 *   changes with no reload, and the field Professor(a) of the lesson with it;
 * - the assignments of that member, so the card Alocações em aulas lists the new one or shows the
 *   cancelled one;
 * - every list of lessons and the calendar, whatever filter or period they were read with: they
 *   carry the confirmed teacher (`teacher`) and `belowExpectedMonitors` of each lesson (A19), so the
 *   column Professor of "Aulas da turma", the Responsável of the list and the legend of the calendar
 *   change too;
 * - what the member who applies sees: "Minhas aulas", the lessons with a place and the queue of
 *   pending applications, because the place that was open may be taken now, and one that was taken
 *   may be open (C1).
 *
 * The other lessons and the other members are not touched. They are fetched again when somebody looks
 * at them, or right away if one is on the screen. Importing the keys of `lessons` is importing the
 * contract, not the module: they are generated.
 */
export async function invalidateAfterAssignmentChange(
  queryClient: QueryClient,
  { lessonId, personId }: AssignmentChange,
): Promise<void> {
  const keys: QueryKey[] = [
    getListLessonAssignmentsQueryKey(lessonId),
    getGetLessonQueryKey(lessonId),
    ...(personId === null ? [] : [getListMemberAssignmentsQueryKey(personId)]),
    getListLessonsQueryKey(),
    getListLessonsCalendarQueryKey(),
    getListMyAssignmentsQueryKey(),
    getListOpenLessonsQueryKey(),
    getListPendingApplicationsQueryKey(),
  ];

  await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

/**
 * The API refused an assignment because of the lesson (it is cancelled, or it is gone): the lists of
 * lessons and the calendar, which are where the form takes its options from, and the lesson itself
 * are out of date, so the lesson that was refused leaves the options and the screen that shows it
 * says what is true now. The assignments did not change, so nothing else is touched.
 */
export async function invalidateAfterLessonRefused(
  queryClient: QueryClient,
  lessonId: string,
): Promise<void> {
  const keys: QueryKey[] = [
    getListLessonsQueryKey(),
    getListLessonsCalendarQueryKey(),
    getGetLessonQueryKey(lessonId),
  ];

  await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
