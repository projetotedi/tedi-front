import { describe, expect, it } from "vitest";

import { CourseStatus } from "@api/generated/model";

import {
  isCourseId,
  isCourseNotFound,
  toCourseSequence,
  withReplacedSequence,
} from "../lib/course-detail";
import {
  buildArchivedCourseDetail,
  buildCourseDetail,
  buildCourseSequence,
  buildMockSequenceItem,
  buildSequenceItem,
  COURSE_ID,
  COURSE_SMARTPHONES,
} from "./handlers";

function apiError(statusCode: number, error?: string) {
  return Object.assign(new Error(error ?? String(statusCode)), { statusCode, error });
}

describe("isCourseId", () => {
  it.each([
    ["a UUID v7, which is what the API generates", COURSE_ID],
    ["a UUID v4", "3b241101-e2bb-4255-8caf-4136c566a962"],
    ["a UUID in upper case", COURSE_ID.toUpperCase()],
  ])("accepts %s", (_label, id) => {
    expect(isCourseId(id)).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["a word", "abc"],
    ["a UUID with spaces around it", ` ${COURSE_ID} `],
    ["a UUID followed by a path", `${COURSE_ID}/lesson-plans`],
    ["a UUID with a missing digit", COURSE_ID.slice(0, -1)],
  ])("rejects %s", (_label, id) => {
    expect(isCourseId(id)).toBe(false);
  });
});

describe("isCourseNotFound", () => {
  it("is true for the 404 COURSE_NOT_FOUND of the contract", () => {
    expect(isCourseNotFound(apiError(404, "COURSE_NOT_FOUND"))).toBe(true);
  });

  it.each([
    ["a 404 that is not from the API (no code)", apiError(404)],
    ["a 404 of a lesson plan", apiError(404, "LESSON_PLAN_NOT_FOUND")],
    ["the code with another status", apiError(500, "COURSE_NOT_FOUND")],
    ["400 VALIDATION_FAILED", apiError(400, "VALIDATION_FAILED")],
    ["403", apiError(403, "FORBIDDEN")],
    ["500", apiError(500, "INTERNAL_SERVER_ERROR")],
    ["a request that never got an answer", new TypeError("Failed to fetch")],
    ["a string", "COURSE_NOT_FOUND"],
    ["undefined", undefined],
    ["null", null],
    ["an empty object", {}],
  ])("is false for %s", (_label, error) => {
    expect(isCourseNotFound(error)).toBe(false);
  });
});

describe("toCourseSequence", () => {
  it("gives the plans and the workload of the detail, as the sequence of the course", () => {
    const course = buildCourseDetail();

    expect(toCourseSequence(course)).toEqual({
      courseId: COURSE_ID,
      items: course.lessonPlans,
      plannedWorkloadMinutes: 420,
    });
  });

  it("keeps the order and the workload of a course with no plans", () => {
    const course = buildCourseDetail({ lessonPlans: [] });

    expect(toCourseSequence(course)).toEqual({
      courseId: COURSE_ID,
      items: [],
      plannedWorkloadMinutes: 0,
    });
  });
});

describe("withReplacedSequence", () => {
  it("takes the plans, how many they are and the workload from the PUT response", () => {
    const course = buildCourseDetail();
    const response = buildCourseSequence([buildSequenceItem({ expectedDurationMinutes: 45 })]);

    const replaced = withReplacedSequence(course, response);

    expect(replaced.lessonPlans).toEqual(response.items);
    expect(replaced.lessonPlanCount).toBe(1);
    expect(replaced.plannedWorkloadMinutes).toBe(45);
  });

  it("uses the workload that the API answered, it does not add the durations up", () => {
    const response = {
      ...buildCourseSequence([buildSequenceItem(), buildMockSequenceItem("lesson-plan-07")]),
      plannedWorkloadMinutes: 195,
    };

    expect(withReplacedSequence(buildCourseDetail(), response).plannedWorkloadMinutes).toBe(195);
  });

  it("keeps the rest of the detail: name, status, people and prerequisites", () => {
    const course = buildArchivedCourseDetail();

    const replaced = withReplacedSequence(course, buildCourseSequence([buildSequenceItem()]));

    expect(replaced).toEqual({
      ...course,
      lessonPlans: replaced.lessonPlans,
      lessonPlanCount: 1,
      plannedWorkloadMinutes: 90,
    });
    expect(replaced.status).toBe(CourseStatus.archived);
    expect(replaced.prerequisites).toEqual([
      expect.objectContaining({ id: COURSE_SMARTPHONES.courseId }),
    ]);
  });

  it("does not change the detail it received", () => {
    const course = buildCourseDetail();
    const before = structuredClone(course);

    withReplacedSequence(course, buildCourseSequence([]));

    expect(course).toEqual(before);
  });
});
