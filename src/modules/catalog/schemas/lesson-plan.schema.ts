import { z } from "zod";

import type { ArchiveDto, CreateLessonPlanDto, LessonPlanResponseDto } from "@api/generated/model";
import {
  archiveLessonPlanBodyReasonMax,
  createLessonPlanBodyContentsItemMax,
  createLessonPlanBodyContentsMax,
  createLessonPlanBodyExpectedDurationMinutesMax,
  createLessonPlanBodyMaterialUrlMax,
  createLessonPlanBodyObjectiveMax,
  createLessonPlanBodyTitleMax,
} from "@api/generated/zod/catalog/catalog";

const MINUTES_PER_HOUR = 60;
const MAX_MINUTES_FIELD = MINUTES_PER_HOUR - 1;
const WHOLE_NUMBER = /^\d+$/;

export const LESSON_PLAN_LIMITS = {
  titleMax: createLessonPlanBodyTitleMax,
  objectiveMax: createLessonPlanBodyObjectiveMax,
  contentMax: createLessonPlanBodyContentsItemMax,
  contentsMax: createLessonPlanBodyContentsMax,
  urlMax: createLessonPlanBodyMaterialUrlMax,
  reasonMax: archiveLessonPlanBodyReasonMax,
  maxHours: Math.floor(createLessonPlanBodyExpectedDurationMinutesMax / MINUTES_PER_HOUR),
  maxDurationMinutes: createLessonPlanBodyExpectedDurationMinutesMax,
} as const;

function parseWholeNumber(value: string): number | null {
  if (value === "") return 0;
  return WHOLE_NUMBER.test(value) ? Number(value) : null;
}

function isEmptyOrHttpUrl(value: string): boolean {
  if (value === "") return true;
  if (/\s/.test(value)) return false;

  try {
    const url = new URL(value);
    const isHttp = url.protocol === "http:" || url.protocol === "https:";
    return isHttp && url.hostname.includes(".");
  } catch {
    return false;
  }
}

export const lessonPlanFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "titleRequired")
      .max(LESSON_PLAN_LIMITS.titleMax, "titleTooLong"),
    hours: z.string().trim(),
    minutes: z.string().trim(),
    contents: z
      .array(
        z.object({
          value: z
            .string()
            .trim()
            .min(1, "contentRequired")
            .max(LESSON_PLAN_LIMITS.contentMax, "contentTooLong"),
        }),
      )
      .min(1, "contentsRequired")
      .max(LESSON_PLAN_LIMITS.contentsMax, "contentsTooMany"),
    objective: z.string().trim().max(LESSON_PLAN_LIMITS.objectiveMax, "objectiveTooLong"),
    materialUrl: z
      .string()
      .trim()
      .max(LESSON_PLAN_LIMITS.urlMax, "materialUrlTooLong")
      .refine(isEmptyOrHttpUrl, "materialUrlInvalid"),
  })
  .superRefine((values, context) => {
    const hours = parseWholeNumber(values.hours);
    const minutes = parseWholeNumber(values.minutes);
    const isMinutesInRange = minutes !== null && minutes <= MAX_MINUTES_FIELD;

    if (hours === null) {
      context.addIssue({ code: "custom", path: ["hours"], message: "hoursInvalid" });
    }
    if (!isMinutesInRange) {
      context.addIssue({ code: "custom", path: ["minutes"], message: "minutesInvalid" });
    }
    if (hours === null || minutes === null || !isMinutesInRange) return;

    const total = hours * MINUTES_PER_HOUR + minutes;

    if (total < 1) {
      context.addIssue({ code: "custom", path: ["hours"], message: "durationRequired" });
    } else if (total > LESSON_PLAN_LIMITS.maxDurationMinutes) {
      context.addIssue({ code: "custom", path: ["hours"], message: "durationTooLong" });
    }
  });

export type LessonPlanFormValues = z.infer<typeof lessonPlanFormSchema>;

export function buildEmptyFormValues(): LessonPlanFormValues {
  return {
    title: "",
    hours: "",
    minutes: "",
    contents: [{ value: "" }],
    objective: "",
    materialUrl: "",
  };
}

export function toDurationMinutes(hours: string, minutes: string): number {
  return (
    (parseWholeNumber(hours.trim()) ?? 0) * MINUTES_PER_HOUR +
    (parseWholeNumber(minutes.trim()) ?? 0)
  );
}

export function toLessonPlanBody(values: LessonPlanFormValues): CreateLessonPlanDto {
  return {
    title: values.title.trim(),
    objective: values.objective.trim() || null,
    expectedDurationMinutes: toDurationMinutes(values.hours, values.minutes),
    contents: values.contents.map((content) => content.value.trim()),
    materialUrl: values.materialUrl.trim() || null,
  };
}

export function toFormValues(plan: LessonPlanResponseDto): LessonPlanFormValues {
  return {
    title: plan.title,
    hours: String(Math.floor(plan.expectedDurationMinutes / MINUTES_PER_HOUR)),
    minutes: String(plan.expectedDurationMinutes % MINUTES_PER_HOUR),
    contents:
      plan.contents.length > 0 ? plan.contents.map((value) => ({ value })) : [{ value: "" }],
    objective: plan.objective ?? "",
    materialUrl: plan.materialUrl ?? "",
  };
}

export const archiveLessonPlanFormSchema = z.object({
  reason: z.string().trim().max(LESSON_PLAN_LIMITS.reasonMax, "reasonTooLong"),
});

export type ArchiveLessonPlanFormValues = z.infer<typeof archiveLessonPlanFormSchema>;

export function toArchiveBody(values: ArchiveLessonPlanFormValues): ArchiveDto | undefined {
  const reason = values.reason.trim();
  return reason ? { reason } : undefined;
}
