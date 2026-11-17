import type { ClassFormFieldName } from "../schemas/class-form.schema";
import { toCourseFieldError } from "./class-api-errors";

const GATEWAY_STATUS_CODES: ReadonlySet<number> = new Set([502, 503, 504]);

interface ApiErrorShape {
  statusCode?: unknown;
  error?: unknown;
  details?: unknown;
}

function readApiErrorShape(error: unknown): ApiErrorShape {
  return typeof error === "object" && error !== null ? (error as ApiErrorShape) : {};
}

/** What went wrong with a request that is not about one field: the key under `actionErrors`. */
export type ClassActionErrorKind =
  | "archived"
  | "notFound"
  | "hasActiveEnrollments"
  | "network"
  | "unknown";

export type ClassFormError =
  | { kind: "field"; name: ClassFormFieldName; message: string }
  | { kind: "action"; error: ClassActionErrorKind };

/** The fields of a 400 `VALIDATION_FAILED`, by the name of the body, with the message to show. */
const VALIDATION_FIELDS: ReadonlyMap<string, { name: ClassFormFieldName; message: string }> =
  new Map([
    ["courseId", { name: "courseId", message: "required" }],
    ["code", { name: "code", message: "codeInvalid" }],
    ["editionName", { name: "edition", message: "invalidEdition" }],
    ["startDate", { name: "start", message: "required" }],
    ["endDate", { name: "end", message: "invalidPeriod" }],
    ["location", { name: "location", message: "locationTooLong" }],
    ["capacity", { name: "capacity", message: "invalidCapacity" }],
  ]);

function firstValidationField(shape: ApiErrorShape) {
  if (!Array.isArray(shape.details)) return null;
  for (const detail of shape.details as unknown[]) {
    const field = (detail as { field?: unknown } | null)?.field;
    const entry = typeof field === "string" ? VALIDATION_FIELDS.get(field) : undefined;
    if (entry) return entry;
  }
  return null;
}

/**
 * What a refusal of the API about a request that does not belong to a field means for the screen:
 * the class was archived meanwhile (409 `CLASS_ARCHIVED`), does not exist (404 `CLASS_NOT_FOUND`),
 * still has students (409 `CLASS_HAS_ACTIVE_ENROLLMENTS`, when archiving), the network failed, or
 * anything else.
 */
export function toClassActionError(error: unknown): ClassActionErrorKind {
  const shape = readApiErrorShape(error);

  if (shape.statusCode === 409 && shape.error === "CLASS_ARCHIVED") return "archived";
  if (shape.statusCode === 404 && shape.error === "CLASS_NOT_FOUND") return "notFound";
  if (shape.statusCode === 409 && shape.error === "CLASS_HAS_ACTIVE_ENROLLMENTS") {
    return "hasActiveEnrollments";
  }
  if (error instanceof TypeError) return "network";
  if (typeof shape.statusCode === "number" && GATEWAY_STATUS_CODES.has(shape.statusCode)) {
    return "network";
  }
  return "unknown";
}

/**
 * Where a refusal of `createClass` or `updateClass` goes in the form (GUS-133, GUS-170): the code
 * taken in the edition (409 `CLASS_CODE_TAKEN`) on the code, a period that ends before it starts
 * (400 `INVALID_PERIOD`) on the end, fewer seats than students (409 `CAPACITY_BELOW_ENROLLED`) on
 * the seats, the refusals about the course (`toCourseFieldError`) on the course and the fields of a
 * 400 `VALIDATION_FAILED` on their own field. Anything else is not a field's: it is an alert above
 * the buttons.
 */
export function toClassFormError(error: unknown): ClassFormError {
  const shape = readApiErrorShape(error);

  if (shape.statusCode === 409 && shape.error === "CLASS_CODE_TAKEN") {
    return { kind: "field", name: "code", message: "codeTaken" };
  }
  if (shape.statusCode === 400 && shape.error === "INVALID_PERIOD") {
    return { kind: "field", name: "end", message: "invalidPeriod" };
  }
  if (shape.statusCode === 409 && shape.error === "CAPACITY_BELOW_ENROLLED") {
    return { kind: "field", name: "capacity", message: "capacityBelowEnrolled" };
  }
  const courseError = toCourseFieldError(error);
  if (courseError !== null) return { kind: "field", name: "courseId", message: courseError };

  if (shape.statusCode === 400 && shape.error === "VALIDATION_FAILED") {
    const field = firstValidationField(shape);
    if (field) return { kind: "field", ...field };
  }
  return { kind: "action", error: toClassActionError(error) };
}
