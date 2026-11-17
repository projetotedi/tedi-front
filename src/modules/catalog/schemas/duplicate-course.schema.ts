import { z } from "zod";

import type { DuplicateCourseDto } from "@api/generated/model";
import { duplicateCourseBodyNameMax } from "@api/generated/zod/catalog/catalog";

export const DUPLICATE_COURSE_LIMITS = {
  nameMax: duplicateCourseBodyNameMax,
} as const;

/**
 * The form of "Duplicar curso" is one required field, the name of the new course. The generated
 * `DuplicateCourseBody` only has the maximum length, and a name typed as spaces would pass it, so
 * the form keeps its own schema: it trims first and then asks for at least one character. The
 * messages are keys of `course.duplicate.fieldErrors`. That the name is unique among all courses
 * (archived ones included, ignoring case) is the API's to say: it answers 409 `COURSE_NAME_TAKEN`.
 */
export const duplicateCourseFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "nameRequired")
    .max(DUPLICATE_COURSE_LIMITS.nameMax, "nameTooLong"),
});

export type DuplicateCourseFormValues = z.infer<typeof duplicateCourseFormSchema>;

export function toDuplicateCourseBody(values: DuplicateCourseFormValues): DuplicateCourseDto {
  return { name: values.name.trim() };
}
