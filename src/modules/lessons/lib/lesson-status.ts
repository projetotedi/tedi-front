import { LessonStatus } from "@api/generated/model";
import type { BadgeProps } from "@shared/ui";

/** The key of the label of each status of a lesson (F4.5) under `status`, in the `lessons` namespace. */
export const LESSON_STATUS_LABEL_KEYS = {
  [LessonStatus.planned]: "status.planned",
  [LessonStatus.confirmed]: "status.confirmed",
  [LessonStatus.done]: "status.done",
  [LessonStatus.cancelled]: "status.cancelled",
} as const satisfies Record<LessonStatus, string>;

/**
 * The tone of the tag of each status, the same on every screen that shows one: planned is quiet,
 * confirmed is blue, done is green and cancelled is red.
 */
export function lessonStatusTone(status: LessonStatus): BadgeProps["tone"] {
  switch (status) {
    case LessonStatus.planned:
      return "neutral";
    case LessonStatus.confirmed:
      return "info";
    case LessonStatus.done:
      return "success";
    case LessonStatus.cancelled:
      return "danger";
  }
}

/**
 * The statuses the edit form offers. `cancelled` is not one of them: the API refuses it on
 * `updateLesson` (400) because cancelling records a reason, and that is `cancelLesson`.
 */
export const EDITABLE_LESSON_STATUSES = [
  LessonStatus.planned,
  LessonStatus.confirmed,
  LessonStatus.done,
] as const;

export type EditableLessonStatus = (typeof EDITABLE_LESSON_STATUSES)[number];
