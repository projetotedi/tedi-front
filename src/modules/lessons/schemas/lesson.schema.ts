import { z } from "zod";

import {
  LessonStatus,
  type CancelLessonDto,
  type CreateLessonDto,
  type LessonResponseDto,
  type RescheduleLessonDto,
  type UpdateLessonDto,
} from "@api/generated/model";
import {
  cancelLessonBodyReasonMax,
  createLessonBodyExpectedMonitorsMax,
  createLessonBodyExpectedStudentsMax,
  createLessonBodyLocationMax,
  createLessonBodyObjectiveMax,
  createLessonBodyStartTimeRegExp,
  createLessonBodySubjectMax,
  createLessonBodyTitleMax,
  rescheduleLessonBodyNoteMax,
  rescheduleLessonBodyReasonMax,
  updateLessonBodyPostNotesMax,
} from "@api/generated/zod/lessons/lessons";

import { EDITABLE_LESSON_STATUSES, type EditableLessonStatus } from "../lib/lesson-status";

/** `HH:mm` in 24 hours, the format the API takes for the start and the end of a lesson. */
export const LESSON_TIME = createLessonBodyStartTimeRegExp;

/**
 * The value of the "no lesson plan" option of the origin select. The select only reports a chosen
 * key (never an empty one), so "a lesson on its own" needs a key of its own.
 */
export const NO_LESSON_PLAN = "none";

/**
 * The limits of the contract, by the name the messages of `fieldErrors` use. The reasons of
 * cancelling and of rescheduling are two limits of the contract that happen to be equal, so each
 * dialog tells its own to the message (`reasonMax`).
 */
export const LESSON_LIMITS = {
  titleMax: createLessonBodyTitleMax,
  objectiveMax: createLessonBodyObjectiveMax,
  locationMax: createLessonBodyLocationMax,
  subjectMax: createLessonBodySubjectMax,
  postNotesMax: updateLessonBodyPostNotesMax,
  cancelReasonMax: cancelLessonBodyReasonMax,
  rescheduleReasonMax: rescheduleLessonBodyReasonMax,
  noteMax: rescheduleLessonBodyNoteMax,
  studentsMax: createLessonBodyExpectedStudentsMax,
  monitorsMax: createLessonBodyExpectedMonitorsMax,
} as const;

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
const WHOLE_NUMBER = /^\d+$/;

/**
 * A count typed as text (the field is a text box with a numeric keyboard, not a spinner): empty
 * means "not informed", otherwise a whole number from 0 to `max`.
 */
function optionalCount(max: number) {
  return z
    .string()
    .trim()
    .refine(
      (value) => value === "" || (WHOLE_NUMBER.test(value) && Number(value) <= max),
      "countInvalid",
    );
}

/**
 * The end has to be after the start (the API says 400 `INVALID_TIME_RANGE`, and a lesson does not
 * cross midnight). It is only compared when both are valid times: a missing one already has its own
 * message, and a refinement of the object still runs when a field failed a continuable check.
 */
function checkTimeRange(values: { startTime: string; endTime: string }, context: z.RefinementCtx) {
  const bothAreTimes = LESSON_TIME.test(values.startTime) && LESSON_TIME.test(values.endTime);

  if (bothAreTimes && values.endTime <= values.startTime) {
    context.addIssue({ code: "custom", path: ["endTime"], message: "invalidTimeRange" });
  }
}

/**
 * The form of "Nova aula" and "Editar aula". It differs from `CreateLessonBody` and
 * `UpdateLessonBody` in what the screen types: the counts are text, the plan is a key that may mean
 * "none", the end is compared with the start, and the status and the post-lesson notes belong to the
 * edit only (the create form leaves them at their defaults and never sends them). The messages are
 * keys of `fieldErrors`.
 *
 * What the form does not decide is whether the date is inside the period of the class: the API is
 * the one place that does (400 `LESSON_OUTSIDE_CLASS_PERIOD`), so the rule has one source.
 */
export const lessonFormSchema = z
  .object({
    lessonPlanId: z.string(),
    title: z.string().trim().min(1, "titleRequired").max(LESSON_LIMITS.titleMax, "titleTooLong"),
    objective: z.string().max(LESSON_LIMITS.objectiveMax, "objectiveTooLong"),
    date: z.string().regex(CALENDAR_DATE, "dateRequired"),
    location: z.string().max(LESSON_LIMITS.locationMax, "locationTooLong"),
    startTime: z.string().regex(LESSON_TIME, "startTimeRequired"),
    endTime: z.string().regex(LESSON_TIME, "endTimeRequired"),
    expectedStudents: optionalCount(LESSON_LIMITS.studentsMax),
    expectedMonitors: optionalCount(LESSON_LIMITS.monitorsMax),
    subject: z.string().max(LESSON_LIMITS.subjectMax, "subjectTooLong"),
    status: z.enum(EDITABLE_LESSON_STATUSES),
    postNotes: z.string().max(LESSON_LIMITS.postNotesMax, "postNotesTooLong"),
  })
  .superRefine(checkTimeRange);

export type LessonFormValues = z.infer<typeof lessonFormSchema>;

/** The names of the fields of the lesson form, which are also the names the API errors point at. */
export type LessonFormField = keyof LessonFormValues;

/** What a new lesson starts with: planned, on its own, and every field empty. */
export function emptyLessonFormValues(): LessonFormValues {
  return {
    lessonPlanId: NO_LESSON_PLAN,
    title: "",
    objective: "",
    date: "",
    location: "",
    startTime: "",
    endTime: "",
    expectedStudents: "",
    expectedMonitors: "",
    subject: "",
    status: LessonStatus.planned,
    postNotes: "",
  };
}

function isEditableStatus(status: LessonStatus): status is EditableLessonStatus {
  return (EDITABLE_LESSON_STATUSES as readonly LessonStatus[]).includes(status);
}

/**
 * The lesson as the form shows it: `null` is an empty field and a number is its text. A cancelled
 * lesson has no edit form (it cannot be changed), so its status falls back to planned only to keep
 * this total; nothing renders the form for it.
 */
export function toLessonFormValues(lesson: LessonResponseDto): LessonFormValues {
  return {
    lessonPlanId: lesson.lessonPlan?.id ?? NO_LESSON_PLAN,
    title: lesson.title,
    objective: lesson.objective ?? "",
    date: lesson.date,
    location: lesson.location ?? "",
    startTime: lesson.startTime,
    endTime: lesson.endTime,
    expectedStudents: lesson.expectedStudents === null ? "" : String(lesson.expectedStudents),
    expectedMonitors: lesson.expectedMonitors === null ? "" : String(lesson.expectedMonitors),
    subject: lesson.subject ?? "",
    status: isEditableStatus(lesson.status) ? lesson.status : LessonStatus.planned,
    postNotes: lesson.postNotes ?? "",
  };
}

/** A blank text is "not informed": the API takes `null`, and a blank string is not stored. */
function toNullableText(value: string): string | null {
  const text = value.trim();
  return text === "" ? null : text;
}

function toNullableCount(value: string): number | null {
  const text = value.trim();
  return text === "" ? null : Number(text);
}

export interface CreateLessonContext {
  classId: string;
  /** The position of the chosen plan in the sequence of the course; `null` without a plan. */
  sequenceOrder: number | null;
}

/**
 * The body of `POST /lessons`. The plan goes with the position it has in the sequence of the
 * course (the API checks that the plan is at exactly that position) and without a plan the lesson is
 * on its own (`lessonPlanId: null`, no position). The title always goes: the person sees and may
 * change what the plan filled in. Blank texts go as `null`, so the API does not copy the plan over
 * what the person cleared. `status` and `postNotes` are not part of the DTO: a lesson is born
 * planned and its notes are written after it.
 */
export function toCreateLessonBody(
  values: LessonFormValues,
  { classId, sequenceOrder }: CreateLessonContext,
): CreateLessonDto {
  const hasPlan = values.lessonPlanId !== NO_LESSON_PLAN;

  return {
    classId,
    lessonPlanId: hasPlan ? values.lessonPlanId : null,
    ...(hasPlan && sequenceOrder !== null ? { sequenceOrder } : {}),
    title: values.title.trim(),
    objective: toNullableText(values.objective),
    date: values.date,
    location: toNullableText(values.location),
    startTime: values.startTime,
    endTime: values.endTime,
    expectedStudents: toNullableCount(values.expectedStudents),
    expectedMonitors: toNullableCount(values.expectedMonitors),
    subject: toNullableText(values.subject),
  };
}

/**
 * The body of `PATCH /lessons/:id`: only what the edit form can change. The class, the plan and the
 * position never change (RN-20), and the date and the times only change by rescheduling, which keeps
 * the original date; none of them is sent. A blank text is `null`, which clears the field.
 */
export function toUpdateLessonBody(values: LessonFormValues): UpdateLessonDto {
  return {
    title: values.title.trim(),
    objective: toNullableText(values.objective),
    location: toNullableText(values.location),
    subject: toNullableText(values.subject),
    expectedStudents: toNullableCount(values.expectedStudents),
    expectedMonitors: toNullableCount(values.expectedMonitors),
    status: values.status,
    postNotes: toNullableText(values.postNotes),
  };
}

/**
 * The form of "Cancelar aula" is one required field. The generated `CancelLessonBody` only has the
 * maximum length and a reason typed as spaces would pass it, so the form trims first and then asks
 * for at least one character (the API refuses a blank reason too).
 */
export const cancelLessonFormSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "reasonRequired")
    .max(LESSON_LIMITS.cancelReasonMax, "reasonTooLong"),
});

export type CancelLessonFormValues = z.infer<typeof cancelLessonFormSchema>;

export function toCancelLessonBody(values: CancelLessonFormValues): CancelLessonDto {
  return { reason: values.reason.trim() };
}

/**
 * The form of "Remarcar aula": the new date and both times (the contract asks for the end too), and
 * the place, the reason and the note, which are optional. The reason is free text: that is what the
 * contract has, and not the list of the Figma.
 */
export const rescheduleLessonFormSchema = z
  .object({
    date: z.string().regex(CALENDAR_DATE, "dateRequired"),
    startTime: z.string().regex(LESSON_TIME, "startTimeRequired"),
    endTime: z.string().regex(LESSON_TIME, "endTimeRequired"),
    location: z.string().max(LESSON_LIMITS.locationMax, "locationTooLong"),
    reason: z.string().max(LESSON_LIMITS.rescheduleReasonMax, "reasonTooLong"),
    note: z.string().max(LESSON_LIMITS.noteMax, "noteTooLong"),
  })
  .superRefine(checkTimeRange);

export type RescheduleLessonFormValues = z.infer<typeof rescheduleLessonFormSchema>;

/** What the dialog opens with: the date empty (it has to be chosen), the rest as the lesson has it. */
export function toRescheduleFormValues(lesson: LessonResponseDto): RescheduleLessonFormValues {
  return {
    date: "",
    startTime: lesson.startTime,
    endTime: lesson.endTime,
    location: lesson.location ?? "",
    reason: "",
    note: "",
  };
}

/**
 * The body of `PATCH /lessons/:id/reschedule`. A blank place is `null`, which clears it (the API
 * keeps the place only when the field is omitted, and a lesson can lose its room); a blank reason
 * or note is `null` too, which leaves the ones of the previous reschedule empty.
 */
export function toRescheduleLessonBody(values: RescheduleLessonFormValues): RescheduleLessonDto {
  return {
    date: values.date,
    startTime: values.startTime,
    endTime: values.endTime,
    location: toNullableText(values.location),
    reason: toNullableText(values.reason),
    note: toNullableText(values.note),
  };
}
