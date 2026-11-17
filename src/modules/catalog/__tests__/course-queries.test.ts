import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";

import { getMeQueryKey } from "@api/generated/auth/auth";
import {
  getGetCourseQueryKey,
  getGetLessonPlanQueryKey,
  getGetLessonPlanUsageQueryKey,
  getListCourseLessonPlansQueryKey,
} from "@api/generated/catalog/catalog";
import type { CourseDetailDto } from "@api/generated/model";

import {
  applyReplacedSequence,
  invalidateAfterCourseArchiveChanged,
  invalidateAfterCourseDuplicated,
} from "../lib/course-queries";
import {
  buildArchivedCourse,
  buildCourseDetail,
  buildCourseSequence,
  buildSequenceItem,
  buildReactivatedCourse,
  COURSE_ARCHIVE_REASON,
  COURSE_ARCHIVED_AT,
  COURSE_ID,
  LESSON_PLAN_ID,
} from "./handlers";

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

  it("writes the PUT response into the detail of the course, without invalidating it", async () => {
    queryClient.setQueryData(getGetCourseQueryKey(COURSE_ID), buildCourseDetail());
    const response = buildCourseSequence([buildSequenceItem({ expectedDurationMinutes: 45 })]);

    await applyReplacedSequence(queryClient, COURSE_ID, response);

    const detail = queryClient.getQueryData<CourseDetailDto>(getGetCourseQueryKey(COURSE_ID));
    expect(detail?.lessonPlans).toEqual(response.items);
    expect(detail?.lessonPlanCount).toBe(1);
    expect(detail?.plannedWorkloadMinutes).toBe(45);
    expect(detail?.name).toBe(buildCourseDetail().name);
    expect(isInvalidated(getGetCourseQueryKey(COURSE_ID))).toBe(false);
  });

  it("does not create the detail of a course that nobody opened", async () => {
    await applyReplacedSequence(queryClient, COURSE_ID, buildCourseSequence());

    expect(queryClient.getQueryData(getGetCourseQueryKey(COURSE_ID))).toBeUndefined();
  });

  it("invalidates the detail of the other courses, which count the plans that changed", async () => {
    queryClient.setQueryData(
      getGetCourseQueryKey(OTHER_COURSE_ID),
      buildCourseDetail({ id: OTHER_COURSE_ID }),
    );

    await applyReplacedSequence(queryClient, COURSE_ID, buildCourseSequence());

    expect(isInvalidated(getGetCourseQueryKey(OTHER_COURSE_ID))).toBe(true);
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

describe("invalidateAfterCourseDuplicated", () => {
  it("invalidates the detail of the original and of the other courses, whose plans are now in one more course", async () => {
    queryClient.setQueryData(getGetCourseQueryKey(COURSE_ID), buildCourseDetail());
    queryClient.setQueryData(
      getGetCourseQueryKey(OTHER_COURSE_ID),
      buildCourseDetail({ id: OTHER_COURSE_ID }),
    );

    await invalidateAfterCourseDuplicated(queryClient);

    expect(isInvalidated(getGetCourseQueryKey(COURSE_ID))).toBe(true);
    expect(isInvalidated(getGetCourseQueryKey(OTHER_COURSE_ID))).toBe(true);
  });

  it("invalidates the sequence of every course, whose courseCount changed", async () => {
    queryClient.setQueryData(getListCourseLessonPlansQueryKey(COURSE_ID), buildCourseSequence());
    queryClient.setQueryData(
      getListCourseLessonPlansQueryKey(OTHER_COURSE_ID),
      buildCourseSequence(),
    );

    await invalidateAfterCourseDuplicated(queryClient);

    expect(isInvalidated(getListCourseLessonPlansQueryKey(COURSE_ID))).toBe(true);
    expect(isInvalidated(getListCourseLessonPlansQueryKey(OTHER_COURSE_ID))).toBe(true);
  });

  it.each([
    ["without parameters", ["/courses"]],
    ["with the parameters of a search", ["/courses", { page: 1, search: "redes" }]],
  ])(
    "invalidates a list of courses, the key of the listCourses that the contract does not have yet (%s)",
    async (_label, listKey) => {
      queryClient.setQueryData(listKey, { data: [] });

      await invalidateAfterCourseDuplicated(queryClient);

      expect(isInvalidated(listKey)).toBe(true);
    },
  );

  it("invalidates the lesson plans: their detail (usedIn), their list and the usage the RF-017 reads", async () => {
    const detailKey = getGetLessonPlanQueryKey(LESSON_PLAN_ID);
    const usageKey = getGetLessonPlanUsageQueryKey(LESSON_PLAN_ID, {
      expectedDurationMinutes: 120,
    });
    const listKey = ["/lesson-plans", { page: 1 }] as const;
    queryClient.setQueryData(detailKey, {});
    queryClient.setQueryData(usageKey, {});
    queryClient.setQueryData(listKey, { data: [] });

    await invalidateAfterCourseDuplicated(queryClient);

    expect(isInvalidated(detailKey)).toBe(true);
    expect(isInvalidated(usageKey)).toBe(true);
    expect(isInvalidated(listKey)).toBe(true);
  });

  it("leaves what has nothing to do with courses or lesson plans alone", async () => {
    queryClient.setQueryData(getMeQueryKey(), {});
    queryClient.setQueryData(["/courses-archive"], {});
    queryClient.setQueryData(["/classes", { page: 1 }], {});

    await invalidateAfterCourseDuplicated(queryClient);

    expect(isInvalidated(getMeQueryKey())).toBe(false);
    expect(isInvalidated(["/courses-archive"])).toBe(false);
    expect(isInvalidated(["/classes", { page: 1 }])).toBe(false);
  });

  it("does not write anything into the cache: the answer of the POST is not the detail of a course", async () => {
    await invalidateAfterCourseDuplicated(queryClient);

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});

describe("invalidateAfterCourseArchiveChanged", () => {
  it("writes the status, the date and the reason of the archive into the cached detail at once", async () => {
    queryClient.setQueryData(getGetCourseQueryKey(COURSE_ID), buildCourseDetail());

    await invalidateAfterCourseArchiveChanged(queryClient, buildArchivedCourse());

    const detail = queryClient.getQueryData<CourseDetailDto>(getGetCourseQueryKey(COURSE_ID));
    expect(detail).toMatchObject({
      status: "archived",
      archivedAt: COURSE_ARCHIVED_AT,
      archiveReason: COURSE_ARCHIVE_REASON,
      updatedAt: COURSE_ARCHIVED_AT,
    });
    // The rest of the detail (sequence, workload, prerequisites) stays as it was.
    expect(detail?.lessonPlans).toEqual(buildCourseDetail().lessonPlans);
  });

  it("clears the archive from the cached detail when the course is reactivated", async () => {
    queryClient.setQueryData(
      getGetCourseQueryKey(COURSE_ID),
      buildCourseDetail({ status: "archived", archivedAt: COURSE_ARCHIVED_AT }),
    );

    await invalidateAfterCourseArchiveChanged(queryClient, buildReactivatedCourse());

    expect(
      queryClient.getQueryData<CourseDetailDto>(getGetCourseQueryKey(COURSE_ID)),
    ).toMatchObject({ status: "active", archivedAt: null, archiveReason: null });
  });

  it("does not create a detail that was not in the cache", async () => {
    await invalidateAfterCourseArchiveChanged(queryClient, buildArchivedCourse());

    expect(queryClient.getQueryData(getGetCourseQueryKey(COURSE_ID))).toBeUndefined();
  });

  it("invalidates every key under /courses (lists and details) and leaves the rest alone", async () => {
    const listKey = ["/courses", { status: "active" }] as const;
    const otherDetailKey = getGetCourseQueryKey(OTHER_COURSE_ID);
    const classesKey = ["/classes/summary-by-course", { courseIds: COURSE_ID }] as const;
    queryClient.setQueryData(listKey, { data: [], total: 0, page: 1, limit: 20 });
    queryClient.setQueryData(otherDetailKey, buildCourseDetail({ id: OTHER_COURSE_ID }));
    queryClient.setQueryData(classesKey, []);
    queryClient.setQueryData(getMeQueryKey(), {});

    await invalidateAfterCourseArchiveChanged(queryClient, buildArchivedCourse());

    expect(isInvalidated(listKey)).toBe(true);
    expect(isInvalidated(otherDetailKey)).toBe(true);
    expect(isInvalidated(classesKey)).toBe(false);
    expect(isInvalidated(getMeQueryKey())).toBe(false);
  });
});
