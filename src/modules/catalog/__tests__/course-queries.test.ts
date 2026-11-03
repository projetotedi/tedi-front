import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";

import { getMeQueryKey } from "@api/generated/auth/auth";
import {
  getGetLessonPlanQueryKey,
  getGetLessonPlanUsageQueryKey,
  getListCourseLessonPlansQueryKey,
} from "@api/generated/catalog/catalog";

import { applyReplacedSequence } from "../lib/course-queries";
import { buildCourseSequence, buildSequenceItem, COURSE_ID, LESSON_PLAN_ID } from "./handlers";

const OTHER_COURSE_ID = "01952ef7-0000-7000-8000-0000000000c2";

let queryClient: QueryClient;

const isInvalidated = (queryKey: readonly unknown[]) =>
  queryClient.getQueryState(queryKey)?.isInvalidated;

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe("applyReplacedSequence", () => {
  it("puts the PUT response in the cache of the course, as it is", async () => {
    queryClient.setQueryData(getListCourseLessonPlansQueryKey(COURSE_ID), buildCourseSequence());
    const response = buildCourseSequence([buildSequenceItem({ expectedDurationMinutes: 45 })]);

    await applyReplacedSequence(queryClient, COURSE_ID, response);

    expect(queryClient.getQueryData(getListCourseLessonPlansQueryKey(COURSE_ID))).toEqual(response);
    expect(isInvalidated(getListCourseLessonPlansQueryKey(COURSE_ID))).toBe(false);
  });

  it("invalidates the sequence of the other courses, which count the plans that changed", async () => {
    queryClient.setQueryData(
      getListCourseLessonPlansQueryKey(OTHER_COURSE_ID),
      buildCourseSequence(),
    );

    await applyReplacedSequence(queryClient, COURSE_ID, buildCourseSequence());

    expect(isInvalidated(getListCourseLessonPlansQueryKey(OTHER_COURSE_ID))).toBe(true);
  });

  it("invalidates the lesson plans: their detail (usedIn) and the usage the RF-017 reads", async () => {
    const detailKey = getGetLessonPlanQueryKey(LESSON_PLAN_ID);
    const usageKey = getGetLessonPlanUsageQueryKey(LESSON_PLAN_ID, {
      expectedDurationMinutes: 120,
    });
    queryClient.setQueryData(detailKey, {});
    queryClient.setQueryData(usageKey, {});

    await applyReplacedSequence(queryClient, COURSE_ID, buildCourseSequence());

    expect(isInvalidated(detailKey)).toBe(true);
    expect(isInvalidated(usageKey)).toBe(true);
  });

  it("leaves what has nothing to do with the sequence alone", async () => {
    queryClient.setQueryData(getMeQueryKey(), {});

    await applyReplacedSequence(queryClient, COURSE_ID, buildCourseSequence());

    expect(isInvalidated(getMeQueryKey())).toBe(false);
  });
});
