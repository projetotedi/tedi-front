import type { FieldPath } from "react-hook-form";
import { z } from "zod";

import {
  ClassStatus,
  type ClassDetailDto,
  type CreateClassDto,
  type UpdateClassDto,
} from "@api/generated/model";
import {
  createClassBodyCapacityMax,
  createClassBodyCodeMax,
  createClassBodyLocationMax,
} from "@api/generated/zod/classes/classes";

export const CLASS_FORM_LIMITS = {
  codeMax: createClassBodyCodeMax,
  locationMax: createClassBodyLocationMax,
  capacityMax: createClassBodyCapacityMax,
} as const;

/** The edition is "<year>.<term>", as the API takes it (`editionName`). */
const EDITION_PATTERN = /^\d{4}\.[1-9]$/;

/**
 * The form of a class (GUS-133). It has no level: the level is the category of the course, read from
 * the course (RN-14), so there is nothing to type and nothing to send. The capacity is kept as the
 * text of the field, so a field left blank or with letters is an error of the field and not a `NaN`.
 */
export const classFormSchema = z
  .object({
    courseId: z.string().min(1, "required"),
    code: z.string().trim().min(1, "required").max(CLASS_FORM_LIMITS.codeMax, "codeTooLong"),
    edition: z.string().trim().min(1, "required").regex(EDITION_PATTERN, "invalidEdition"),
    start: z.string().min(1, "required"),
    end: z.string().min(1, "required"),
    location: z.string().trim().max(CLASS_FORM_LIMITS.locationMax, "locationTooLong"),
    capacity: z
      .string()
      .trim()
      .min(1, "required")
      .refine((value) => /^\d+$/.test(value), "invalidCapacity")
      .refine((value) => Number(value) >= 1, "invalidCapacity")
      .refine((value) => Number(value) <= CLASS_FORM_LIMITS.capacityMax, "capacityTooHigh"),
    status: z.enum(ClassStatus),
  })
  .superRefine((values, context) => {
    if (values.start && values.end && values.end < values.start) {
      context.addIssue({ code: "custom", path: ["end"], message: "invalidPeriod" });
    }
  });

export type ClassFormValues = z.infer<typeof classFormSchema>;
export type ClassFormFieldName = FieldPath<ClassFormValues>;

/** A new class: no course, the status Planejada, and the rest blank. */
export function emptyClassFormValues(courseId = ""): ClassFormValues {
  return {
    courseId,
    code: "",
    edition: "",
    start: "",
    end: "",
    location: "",
    capacity: "",
    status: ClassStatus.planned,
  };
}

/** The form filled with the class as the API has it. */
export function toClassFormValues(classDetail: ClassDetailDto): ClassFormValues {
  return {
    courseId: classDetail.course.id,
    code: classDetail.code,
    edition: classDetail.edition.name,
    start: classDetail.startDate,
    end: classDetail.endDate,
    location: classDetail.location ?? "",
    capacity: String(classDetail.capacity),
    status: classDetail.status,
  };
}

/** The body of `createClass`: the location only when it was filled in. */
export function toCreateClassBody(values: ClassFormValues): CreateClassDto {
  const location = values.location.trim();

  return {
    courseId: values.courseId,
    code: values.code.trim(),
    editionName: values.edition.trim(),
    startDate: values.start,
    endDate: values.end,
    capacity: Number(values.capacity),
    status: values.status,
    ...(location ? { location } : {}),
  };
}

/**
 * The body of `updateClass`: only what changed from the class as it was loaded, so a field nobody
 * touched is never sent (and the course, which the API refuses to change in some cases, goes only
 * when another one was picked). A location that was cleared goes as `null`.
 */
export function toUpdateClassBody(
  values: ClassFormValues,
  initial: ClassFormValues,
): UpdateClassDto {
  const body: UpdateClassDto = {};
  const location = values.location.trim();

  if (values.courseId !== initial.courseId) body.courseId = values.courseId;
  if (values.code.trim() !== initial.code) body.code = values.code.trim();
  if (values.edition.trim() !== initial.edition) body.editionName = values.edition.trim();
  if (values.start !== initial.start) body.startDate = values.start;
  if (values.end !== initial.end) body.endDate = values.end;
  if (location !== initial.location) body.location = location || null;
  if (Number(values.capacity) !== Number(initial.capacity)) {
    body.capacity = Number(values.capacity);
  }
  if (values.status !== initial.status) body.status = values.status;

  return body;
}
