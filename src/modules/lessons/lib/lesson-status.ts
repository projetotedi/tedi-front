import { LessonStatus } from "@api/generated/model";

/** The key, in the `lessons` namespace, of the label of each status. */
export const LESSON_STATUS_LABEL_KEYS = {
  [LessonStatus.planned]: "status.planned",
  [LessonStatus.confirmed]: "status.confirmed",
  [LessonStatus.done]: "status.done",
  [LessonStatus.cancelled]: "status.cancelled",
} as const satisfies Record<LessonStatus, string>;

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
