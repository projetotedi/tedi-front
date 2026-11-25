import { describe, expect, it } from "vitest";

import { LessonStatus } from "@api/generated/model";

import { LESSON_STATUS_LABEL_KEYS, lessonStatusTone } from "../lib/lesson-status";

describe("LESSON_STATUS_LABEL_KEYS", () => {
  it("has a label key for every status of the contract", () => {
    expect(Object.keys(LESSON_STATUS_LABEL_KEYS).sort()).toEqual(
      Object.values(LessonStatus).sort(),
    );
  });

  it("points each status to its key under status in the locale", () => {
    expect(LESSON_STATUS_LABEL_KEYS).toEqual({
      planned: "status.planned",
      confirmed: "status.confirmed",
      done: "status.done",
      cancelled: "status.cancelled",
    });
  });
});

describe("lessonStatusTone", () => {
  it.each([
    [LessonStatus.planned, "neutral"],
    [LessonStatus.confirmed, "info"],
    [LessonStatus.done, "success"],
    [LessonStatus.cancelled, "danger"],
  ] as const)("%s is a %s tag", (status, tone) => {
    expect(lessonStatusTone(status)).toBe(tone);
  });
});
