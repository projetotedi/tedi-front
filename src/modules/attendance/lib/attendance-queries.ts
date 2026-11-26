import type { QueryClient, QueryKey } from "@tanstack/react-query";

import {
  getGetMemberAttendanceHistoryQueryKey,
  getListMemberAttendanceQueryKey,
  getListStudentAttendanceQueryKey,
} from "@api/generated/attendance/attendance";
import {
  getGetClassQueryKey,
  getListClassEnrollmentsQueryKey,
} from "@api/generated/classes/classes";
import {
  getGetHoursOverviewQueryKey,
  getGetMemberHoursQueryKey,
  getGetMyHoursSummaryQueryKey,
  getListMyHourEntriesQueryKey,
} from "@api/generated/hours/hours";
import {
  getGetLessonQueryKey,
  getListLessonsCalendarQueryKey,
  getListLessonsQueryKey,
} from "@api/generated/lessons/lessons";
import type { LessonResponseDto } from "@api/generated/model";

type LessonRef = Pick<LessonResponseDto, "id"> & { class: Pick<LessonResponseDto["class"], "id"> };

function invalidateInBackground(queryClient: QueryClient, keys: QueryKey[]): void {
  for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
}

export function invalidateStudentAttendance(
  queryClient: QueryClient,
  lesson: LessonRef,
): Promise<void> {
  invalidateInBackground(queryClient, [
    getGetLessonQueryKey(lesson.id),
    getListLessonsQueryKey(),
    getListLessonsCalendarQueryKey(),
    getGetClassQueryKey(lesson.class.id),
    getListClassEnrollmentsQueryKey(lesson.class.id),
  ]);
  return queryClient.invalidateQueries({ queryKey: getListStudentAttendanceQueryKey(lesson.id) });
}

export function invalidateMemberAttendance(
  queryClient: QueryClient,
  lessonId: string,
  personIds: readonly string[],
): Promise<void> {
  invalidateInBackground(queryClient, [
    getGetMyHoursSummaryQueryKey(),
    getListMyHourEntriesQueryKey(),
    getGetHoursOverviewQueryKey(),
    ...personIds.flatMap((personId) => [
      getGetMemberHoursQueryKey(personId),
      getGetMemberAttendanceHistoryQueryKey(personId),
    ]),
  ]);
  return queryClient.invalidateQueries({ queryKey: getListMemberAttendanceQueryKey(lessonId) });
}
