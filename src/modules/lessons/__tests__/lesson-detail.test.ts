import { describe, expect, it } from "vitest";

import { LessonStatus } from "@api/generated/model";

import {
  hasScheduleChange,
  isLessonId,
  lessonChangesTitleKey,
  lessonClassLabel,
} from "../lib/lesson-detail";
import {
  buildCancelledLesson,
  buildLesson,
  buildRescheduledLesson,
  CLASS_NAME,
  LESSON_ID,
} from "./handlers";

describe("isLessonId", () => {
  it.each([
    ["a UUID v7, which is what the API generates", LESSON_ID],
    ["a UUID v4", "3b241101-e2bb-4255-8caf-4136c566a962"],
    ["a UUID in upper case", LESSON_ID.toUpperCase()],
  ])("accepts %s", (_label, id) => {
    expect(isLessonId(id)).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["a word", "abc"],
    ["a number", "1"],
    ["the word of the calendar route", "calendar"],
    ["a UUID with spaces around it", ` ${LESSON_ID} `],
    ["a UUID followed by a path", `${LESSON_ID}/assignments`],
    ["a UUID with a missing digit", LESSON_ID.slice(0, -1)],
  ])("rejects %s", (_label, id) => {
    expect(isLessonId(id)).toBe(false);
  });
});

describe("hasScheduleChange", () => {
  it("is false for a lesson that was never rescheduled nor cancelled", () => {
    expect(hasScheduleChange(buildLesson())).toBe(false);
  });

  it("is true for a lesson that was rescheduled", () => {
    expect(hasScheduleChange(buildRescheduledLesson())).toBe(true);
  });

  it("is true for a lesson that was cancelled", () => {
    expect(hasScheduleChange(buildCancelledLesson())).toBe(true);
  });

  it("is true for a lesson that was rescheduled and then cancelled", () => {
    expect(hasScheduleChange(buildCancelledLesson({ originalDate: "2026-03-03" }))).toBe(true);
  });

  it.each([LessonStatus.planned, LessonStatus.confirmed, LessonStatus.done])(
    "is false for a %s lesson with no original date",
    (status) => {
      expect(hasScheduleChange(buildLesson({ status }))).toBe(false);
    },
  );
});

describe("lessonChangesTitleKey", () => {
  it("is Remarcação for a lesson that was only rescheduled", () => {
    expect(lessonChangesTitleKey(buildRescheduledLesson())).toBe("detail.changes.titleRescheduled");
  });

  it("is Cancelamento for a lesson that was only cancelled", () => {
    expect(lessonChangesTitleKey(buildCancelledLesson())).toBe("detail.changes.titleCancelled");
  });

  it("is Remarcação e cancelamento for a lesson that was both", () => {
    expect(lessonChangesTitleKey(buildCancelledLesson({ originalDate: "2026-03-03" }))).toBe(
      "detail.changes.titleBoth",
    );
  });
});

describe("lessonClassLabel", () => {
  it("is the name of the class", () => {
    expect(lessonClassLabel(buildLesson().class)).toBe(CLASS_NAME);
  });

  it("falls back to the code of a class that has no name", () => {
    const lesson = buildLesson();

    expect(lessonClassLabel({ ...lesson.class, name: null })).toBe("INFO-A");
  });

  it("falls back to the code of a class whose name is empty", () => {
    const lesson = buildLesson();

    expect(lessonClassLabel({ ...lesson.class, name: "" })).toBe("INFO-A");
  });
});
