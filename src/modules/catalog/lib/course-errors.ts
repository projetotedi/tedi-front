import type { FieldPath } from "react-hook-form";

import type { CourseFormValues } from "../schemas/course.schema";
import { toSubmitError, type FieldErrorEntry, type SubmitErrorKind } from "./api-form-errors";
import { isCourseNotFound } from "./course-detail";

export type CourseFieldName = FieldPath<CourseFormValues>;

/** The codes of the API that belong to one field of the form, and the message key of each. */
const FIELD_CODES: ReadonlyMap<string, FieldErrorEntry<CourseFieldName>> = new Map([
  ["COURSE_NAME_TAKEN", { name: "name", message: "nameTaken" }],
  ["PREREQUISITE_CYCLE", { name: "prerequisiteIds", message: "prerequisiteCycle" }],
  ["PREREQUISITE_NOT_FOUND", { name: "prerequisiteIds", message: "prerequisiteNotFound" }],
  ["PREREQUISITE_ARCHIVED", { name: "prerequisiteIds", message: "prerequisiteArchived" }],
] as Array<[string, FieldErrorEntry<CourseFieldName>]>);

const COURSE_FIELDS: ReadonlySet<string> = new Set([
  "name",
  "category",
  "prerequisiteIds",
  "description",
  "objective",
]);

/** A field the API refused with `VALIDATION_FAILED` (a limit the form did not catch). */
function resolveCourseField(field: string): FieldErrorEntry<CourseFieldName> | null {
  const root = field.split(".")[0];
  return COURSE_FIELDS.has(root)
    ? { name: root as CourseFieldName, message: "serverInvalid" }
    : null;
}

export type CourseFormError =
  | { kind: "fields"; fields: FieldErrorEntry<CourseFieldName>[] }
  | { kind: SubmitErrorKind };

/**
 * Turns the error of `createCourse` or `updateCourse` into what the form shows (GUS-129): the
 * name taken (409) and the problems with the prerequisites (400) go on their field; an archived
 * course (409 `COURSE_ARCHIVED`, archived in another tab while the form was open) and a course
 * that no longer exists go to an alert, as network and unexpected errors do.
 */
export function toCourseFormError(error: unknown): CourseFormError {
  const shape =
    typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};

  if (typeof shape.error === "string") {
    const field = FIELD_CODES.get(shape.error);
    if (field && (shape.statusCode === 409 || shape.statusCode === 400)) {
      return { kind: "fields", fields: [field] };
    }
    if (shape.statusCode === 409 && shape.error === "COURSE_ARCHIVED") return { kind: "archived" };
  }
  if (isCourseNotFound(error)) return { kind: "notFound" };

  return toSubmitError(error, resolveCourseField);
}
