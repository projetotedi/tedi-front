import { LessonStatus, type LessonClassRefDto, type LessonResponseDto } from "@api/generated/model";
import { GetLessonParams } from "@api/generated/zod/lessons/lessons";

/**
 * The id of the route comes from the URL, which can be typed by hand or come from an old link. The
 * contract says a lesson id is a UUID (`GetLessonParams`, generated), so anything else cannot exist
 * and there is nothing to ask the API: the screen says "not found" with no request. The same rule
 * as `isClassId` in the `classes` module.
 */
export function isLessonId(value: string): boolean {
  return GetLessonParams.safeParse({ id: value }).success;
}

/**
 * Whether the lesson has a change of schedule to tell: it was rescheduled (`originalDate` is the
 * first day it was set for, and only a reschedule fills it) or it was cancelled (and then it has a
 * reason). The card "Remarcação" / "Cancelamento" only exists for such a lesson.
 */
export function hasScheduleChange(lesson: LessonResponseDto): boolean {
  return lesson.originalDate !== null || lesson.status === LessonStatus.cancelled;
}

/** The keys, in the `lessons` namespace, of the title of the card of the changes of a lesson. */
export type LessonChangesTitleKey =
  | "detail.changes.titleRescheduled"
  | "detail.changes.titleCancelled"
  | "detail.changes.titleBoth";

/**
 * The title of the card of the changes: "Remarcação" for a lesson that was only rescheduled,
 * "Cancelamento" for one that was cancelled with its date untouched, and "Remarcação e
 * cancelamento" for one that was rescheduled and cancelled afterwards (a cancelled lesson keeps the
 * `originalDate` it already had).
 */
export function lessonChangesTitleKey(lesson: LessonResponseDto): LessonChangesTitleKey {
  const isRescheduled = lesson.originalDate !== null;
  const isCancelled = lesson.status === LessonStatus.cancelled;

  if (isRescheduled && isCancelled) return "detail.changes.titleBoth";
  return isCancelled ? "detail.changes.titleCancelled" : "detail.changes.titleRescheduled";
}

/**
 * How the class is named on the screens of a lesson: its name, and its code when nobody typed a
 * name (`name` is an optional label, `code` is always there).
 */
export function lessonClassLabel(lessonClass: LessonClassRefDto): string {
  return lessonClass.name || lessonClass.code;
}
