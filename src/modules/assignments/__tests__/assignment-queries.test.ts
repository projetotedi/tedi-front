import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import {
  getListLessonAssignmentsQueryKey,
  getListMemberAssignmentsQueryKey,
  getListMyAssignmentsQueryKey,
  getListOpenLessonsQueryKey,
  getListPendingApplicationsQueryKey,
} from "@api/generated/assignments/assignments";
import { getGetClassQueryKey } from "@api/generated/classes/classes";
import {
  getGetLessonQueryKey,
  getListLessonsCalendarQueryKey,
  getListLessonsQueryKey,
} from "@api/generated/lessons/lessons";
import { getListMembersQueryKey } from "@api/generated/people/people";

import {
  invalidateAfterAssignmentChange,
  invalidateAfterLessonRefused,
} from "../lib/assignment-queries";
import {
  buildLessonAssignment,
  buildMemberAssignment,
  CLASS_ID,
  LESSON_ID,
  MEMBER_ID,
  OTHER_LESSON_ID,
  OTHER_MEMBER_ID,
} from "./handlers";

const isInvalidated = (queryClient: QueryClient, key: readonly unknown[]) =>
  queryClient.getQueryState(key)?.isInvalidated;

/**
 * A cache with everything an allocation can touch (the assignments and the detail of two lessons, the
 * assignments of two members, two lists of lessons and the calendar, and what the member who applies
 * sees) and with what it must not (the class and the list of members).
 */
function seededQueryClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const keys = {
    lessonAssignments: getListLessonAssignmentsQueryKey(LESSON_ID),
    lesson: getGetLessonQueryKey(LESSON_ID),
    memberAssignments: getListMemberAssignmentsQueryKey(MEMBER_ID),
    lessonList: [...getListLessonsQueryKey({ page: 1 })] as const,
    classLessonList: [...getListLessonsQueryKey({ classId: CLASS_ID, limit: 5 })] as const,
    calendar: [
      ...getListLessonsCalendarQueryKey({ from: "2026-03-01", to: "2026-03-31" }),
    ] as const,
    myAssignments: [...getListMyAssignmentsQueryKey({ from: "2026-03-01" })] as const,
    openLessons: [...getListOpenLessonsQueryKey({ from: "2026-03-01" })] as const,
    pendingApplications: [...getListPendingApplicationsQueryKey({ status: "pending" })] as const,
    otherLessonAssignments: getListLessonAssignmentsQueryKey(OTHER_LESSON_ID),
    otherLesson: getGetLessonQueryKey(OTHER_LESSON_ID),
    otherMemberAssignments: getListMemberAssignmentsQueryKey(OTHER_MEMBER_ID),
    class: getGetClassQueryKey(CLASS_ID),
    members: [...getListMembersQueryKey({ limit: 100 })] as const,
  };

  queryClient.setQueryData(keys.lessonAssignments, [buildLessonAssignment()]);
  queryClient.setQueryData(keys.lesson, { id: LESSON_ID });
  queryClient.setQueryData(keys.memberAssignments, [buildMemberAssignment()]);
  queryClient.setQueryData(keys.lessonList, { data: [], total: 0 });
  queryClient.setQueryData(keys.classLessonList, { data: [], total: 0 });
  queryClient.setQueryData(keys.calendar, []);
  queryClient.setQueryData(keys.myAssignments, { items: [] });
  queryClient.setQueryData(keys.openLessons, []);
  queryClient.setQueryData(keys.pendingApplications, { lessons: [] });
  queryClient.setQueryData(keys.otherLessonAssignments, []);
  queryClient.setQueryData(keys.otherLesson, { id: OTHER_LESSON_ID });
  queryClient.setQueryData(keys.otherMemberAssignments, []);
  queryClient.setQueryData(keys.class, { id: CLASS_ID });
  queryClient.setQueryData(keys.members, { data: [] });

  return { queryClient, keys };
}

describe("invalidateAfterAssignmentChange", () => {
  it("invalidates the assignments of the lesson and the lesson itself, with its coverage", async () => {
    const { queryClient, keys } = seededQueryClient();

    await invalidateAfterAssignmentChange(queryClient, {
      lessonId: LESSON_ID,
      personId: MEMBER_ID,
    });

    expect(isInvalidated(queryClient, keys.lessonAssignments)).toBe(true);
    expect(isInvalidated(queryClient, keys.lesson)).toBe(true);
  });

  it("invalidates the assignments of the member", async () => {
    const { queryClient, keys } = seededQueryClient();

    await invalidateAfterAssignmentChange(queryClient, {
      lessonId: LESSON_ID,
      personId: MEMBER_ID,
    });

    expect(isInvalidated(queryClient, keys.memberAssignments)).toBe(true);
  });

  it("invalidates every list of lessons and the calendar, whatever their filters", async () => {
    const { queryClient, keys } = seededQueryClient();

    await invalidateAfterAssignmentChange(queryClient, {
      lessonId: LESSON_ID,
      personId: MEMBER_ID,
    });

    expect(isInvalidated(queryClient, keys.lessonList)).toBe(true);
    expect(isInvalidated(queryClient, keys.classLessonList)).toBe(true);
    expect(isInvalidated(queryClient, keys.calendar)).toBe(true);
  });

  it("invalidates what the member who applies sees: her lessons, the lessons with a place and the queue", async () => {
    const { queryClient, keys } = seededQueryClient();

    await invalidateAfterAssignmentChange(queryClient, {
      lessonId: LESSON_ID,
      personId: MEMBER_ID,
    });

    expect(isInvalidated(queryClient, keys.myAssignments)).toBe(true);
    expect(isInvalidated(queryClient, keys.openLessons)).toBe(true);
    expect(isInvalidated(queryClient, keys.pendingApplications)).toBe(true);
  });

  it("does not touch another lesson, another member, the class or the list of members", async () => {
    const { queryClient, keys } = seededQueryClient();

    await invalidateAfterAssignmentChange(queryClient, {
      lessonId: LESSON_ID,
      personId: MEMBER_ID,
    });

    expect(isInvalidated(queryClient, keys.otherLessonAssignments)).toBe(false);
    expect(isInvalidated(queryClient, keys.otherLesson)).toBe(false);
    expect(isInvalidated(queryClient, keys.otherMemberAssignments)).toBe(false);
    expect(isInvalidated(queryClient, keys.class)).toBe(false);
    expect(isInvalidated(queryClient, keys.members)).toBe(false);
  });

  it("invalidates the lesson that was asked for, and not the other one", async () => {
    const { queryClient, keys } = seededQueryClient();

    await invalidateAfterAssignmentChange(queryClient, {
      lessonId: OTHER_LESSON_ID,
      personId: OTHER_MEMBER_ID,
    });

    expect(isInvalidated(queryClient, keys.otherLessonAssignments)).toBe(true);
    expect(isInvalidated(queryClient, keys.otherLesson)).toBe(true);
    expect(isInvalidated(queryClient, keys.otherMemberAssignments)).toBe(true);
    expect(isInvalidated(queryClient, keys.lessonAssignments)).toBe(false);
    expect(isInvalidated(queryClient, keys.lesson)).toBe(false);
    expect(isInvalidated(queryClient, keys.memberAssignments)).toBe(false);
  });

  it("leaves the assignments of every member alone when the member is not known", async () => {
    const { queryClient, keys } = seededQueryClient();

    await invalidateAfterAssignmentChange(queryClient, { lessonId: LESSON_ID, personId: null });

    expect(isInvalidated(queryClient, keys.memberAssignments)).toBe(false);
    expect(isInvalidated(queryClient, keys.otherMemberAssignments)).toBe(false);
    expect(isInvalidated(queryClient, keys.lessonAssignments)).toBe(true);
    expect(isInvalidated(queryClient, keys.lessonList)).toBe(true);
  });
});

describe("invalidateAfterLessonRefused", () => {
  it("invalidates the lists of lessons, the calendar and the lesson itself", async () => {
    const { queryClient, keys } = seededQueryClient();

    await invalidateAfterLessonRefused(queryClient, LESSON_ID);

    expect(isInvalidated(queryClient, keys.lessonList)).toBe(true);
    expect(isInvalidated(queryClient, keys.classLessonList)).toBe(true);
    expect(isInvalidated(queryClient, keys.calendar)).toBe(true);
    expect(isInvalidated(queryClient, keys.lesson)).toBe(true);
  });

  it("does not touch the assignments, another lesson or the members: nothing was allocated", async () => {
    const { queryClient, keys } = seededQueryClient();

    await invalidateAfterLessonRefused(queryClient, LESSON_ID);

    expect(isInvalidated(queryClient, keys.lessonAssignments)).toBe(false);
    expect(isInvalidated(queryClient, keys.memberAssignments)).toBe(false);
    expect(isInvalidated(queryClient, keys.otherLesson)).toBe(false);
    expect(isInvalidated(queryClient, keys.members)).toBe(false);
    expect(isInvalidated(queryClient, keys.myAssignments)).toBe(false);
  });
});
