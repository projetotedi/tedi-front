import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

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
import { ListPendingApplicationsStatus } from "@api/generated/model";

import {
  invalidateAfterApplied,
  invalidateAfterReviewed,
  PENDING_APPLICATIONS_PARAMS,
} from "../lib/assignment-queries";
import { buildApplication, LESSON_IDS, PEOPLE } from "./handlers";

const LESSON_ID = LESSON_IDS[3];
const OTHER_LESSON_ID = LESSON_IDS[4];

const isInvalidated = (queryClient: QueryClient, key: readonly unknown[]) =>
  queryClient.getQueryState(key)?.isInvalidated;

/**
 * A cache with what the module reads (the agenda with and without a period, the lessons with a
 * vacancy, the queue, the assignments of two lessons and of the member), what `lessons` reads (a
 * list, the calendar, two lessons) and something that is none of them.
 */
function seededQueryClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const keys = {
    myAssignments: [...getListMyAssignmentsQueryKey()] as const,
    myAssignmentsWithPeriod: [
      ...getListMyAssignmentsQueryKey({ from: "2026-03-01", to: "2026-03-31" }),
    ] as const,
    openLessons: [...getListOpenLessonsQueryKey()] as const,
    pending: [...getListPendingApplicationsQueryKey(PENDING_APPLICATIONS_PARAMS)] as const,
    lessonAssignments: getListLessonAssignmentsQueryKey(LESSON_ID),
    otherLessonAssignments: getListLessonAssignmentsQueryKey(OTHER_LESSON_ID),
    memberAssignments: getListMemberAssignmentsQueryKey(PEOPLE.beatriz.id),
    otherMemberAssignments: getListMemberAssignmentsQueryKey(PEOPLE.diego.id),
    lessonList: [...getListLessonsQueryKey({ page: 1 })] as const,
    calendar: [
      ...getListLessonsCalendarQueryKey({ from: "2026-03-01", to: "2026-03-31" }),
    ] as const,
    lesson: getGetLessonQueryKey(LESSON_ID),
    otherLesson: getGetLessonQueryKey(OTHER_LESSON_ID),
    course: ["/courses/x"] as const,
  };

  for (const key of Object.values(keys)) queryClient.setQueryData(key, { seeded: true });

  return { queryClient, keys };
}

describe("PENDING_APPLICATIONS_PARAMS", () => {
  it("is the queue of pending applications, the only one the API has", () => {
    expect(PENDING_APPLICATIONS_PARAMS).toEqual({ status: "pending" });
    expect(PENDING_APPLICATIONS_PARAMS.status).toBe(ListPendingApplicationsStatus.pending);
  });

  it("makes the key of the button and of the dialog the same", () => {
    expect(getListPendingApplicationsQueryKey(PENDING_APPLICATIONS_PARAMS)).toEqual([
      "/applications",
      { status: "pending" },
    ]);
  });
});

describe("invalidateAfterApplied", () => {
  it("invalidates the agenda, the lessons with a vacancy and the queue", async () => {
    const { queryClient, keys } = seededQueryClient();

    await invalidateAfterApplied(queryClient, LESSON_ID);

    expect(isInvalidated(queryClient, keys.myAssignments)).toBe(true);
    expect(isInvalidated(queryClient, keys.openLessons)).toBe(true);
    expect(isInvalidated(queryClient, keys.pending)).toBe(true);
  });

  it("invalidates the agenda read with a period too, whatever it was", async () => {
    const { queryClient, keys } = seededQueryClient();

    await invalidateAfterApplied(queryClient, LESSON_ID);

    expect(isInvalidated(queryClient, keys.myAssignmentsWithPeriod)).toBe(true);
  });

  it("invalidates the assignments of that lesson, and not the ones of another", async () => {
    const { queryClient, keys } = seededQueryClient();

    await invalidateAfterApplied(queryClient, LESSON_ID);

    expect(isInvalidated(queryClient, keys.lessonAssignments)).toBe(true);
    expect(isInvalidated(queryClient, keys.otherLessonAssignments)).toBe(false);
  });

  it("leaves the coverage alone: a pending application takes no place, so lessons are not touched", async () => {
    const { queryClient, keys } = seededQueryClient();

    await invalidateAfterApplied(queryClient, LESSON_ID);

    for (const key of [keys.lessonList, keys.calendar, keys.lesson, keys.otherLesson]) {
      expect(isInvalidated(queryClient, key), JSON.stringify(key)).toBe(false);
    }
    expect(isInvalidated(queryClient, keys.memberAssignments)).toBe(false);
    expect(isInvalidated(queryClient, keys.course)).toBe(false);
  });
});

describe("invalidateAfterReviewed", () => {
  it("invalidates everything that applying does", async () => {
    const { queryClient, keys } = seededQueryClient();

    await invalidateAfterReviewed(queryClient, buildApplication({ lessonId: LESSON_ID }));

    for (const key of [
      keys.myAssignments,
      keys.myAssignmentsWithPeriod,
      keys.openLessons,
      keys.pending,
      keys.lessonAssignments,
    ]) {
      expect(isInvalidated(queryClient, key), JSON.stringify(key)).toBe(true);
    }
    expect(isInvalidated(queryClient, keys.otherLessonAssignments)).toBe(false);
  });

  it("invalidates the lists of lessons, the calendar and the detail of that lesson: they carry the coverage", async () => {
    const { queryClient, keys } = seededQueryClient();

    await invalidateAfterReviewed(queryClient, buildApplication({ lessonId: LESSON_ID }));

    expect(isInvalidated(queryClient, keys.lessonList)).toBe(true);
    expect(isInvalidated(queryClient, keys.calendar)).toBe(true);
    expect(isInvalidated(queryClient, keys.lesson)).toBe(true);
  });

  it("leaves the detail of the other lessons and what is not a lesson alone", async () => {
    const { queryClient, keys } = seededQueryClient();

    await invalidateAfterReviewed(queryClient, buildApplication({ lessonId: LESSON_ID }));

    expect(isInvalidated(queryClient, keys.otherLesson)).toBe(false);
    expect(isInvalidated(queryClient, keys.course)).toBe(false);
  });

  it("invalidates the assignments of the member of the application, and not of another member", async () => {
    const { queryClient, keys } = seededQueryClient();

    await invalidateAfterReviewed(
      queryClient,
      buildApplication({ lessonId: LESSON_ID, person: PEOPLE.beatriz }),
    );

    expect(isInvalidated(queryClient, keys.memberAssignments)).toBe(true);
    expect(isInvalidated(queryClient, keys.otherMemberAssignments)).toBe(false);
  });

  it("works for an application whose person was removed: no member to invalidate", async () => {
    const { queryClient, keys } = seededQueryClient();

    await invalidateAfterReviewed(
      queryClient,
      buildApplication({ lessonId: LESSON_ID, person: null }),
    );

    expect(isInvalidated(queryClient, keys.memberAssignments)).toBe(false);
    expect(isInvalidated(queryClient, keys.otherMemberAssignments)).toBe(false);
    expect(isInvalidated(queryClient, keys.lesson)).toBe(true);
    expect(isInvalidated(queryClient, keys.pending)).toBe(true);
  });
});
