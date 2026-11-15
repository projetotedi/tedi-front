import { toSubmitError, type FieldErrorEntry } from "./api-form-errors";
import { isCourseNotFound } from "./course-detail";

const COURSE_NAME_TAKEN = "COURSE_NAME_TAKEN";

/**
 * The errors of `duplicateCourse` that belong to the field: another course already has the name
 * (409 `COURSE_NAME_TAKEN`, which counts archived courses and ignores case) and a name the API
 * refused (400 `VALIDATION_FAILED` pointing at `name`). The dialog puts them on the name field, so
 * the person fixes it where it is. Each one is also a key of `course.duplicate.fieldErrors`.
 */
export const DUPLICATE_COURSE_FIELD_ERRORS = ["nameTaken", "nameInvalid"] as const;

export type DuplicateCourseFieldError = (typeof DUPLICATE_COURSE_FIELD_ERRORS)[number];

/**
 * What the dialog tells the person when `POST /courses/:id/duplicate` fails: the two of the field
 * above, and three that have no field to point at, which show as an alert inside the dialog (a key
 * of `course.duplicate.errors` each).
 */
export type DuplicateCourseErrorKind =
  | DuplicateCourseFieldError
  | "courseNotFound"
  | "network"
  | "unknown";

export function isDuplicateCourseFieldError(
  kind: DuplicateCourseErrorKind,
): kind is DuplicateCourseFieldError {
  return (DUPLICATE_COURSE_FIELD_ERRORS as readonly string[]).includes(kind);
}

interface ApiErrorShape {
  statusCode?: unknown;
  error?: unknown;
}

function readApiError(error: unknown): ApiErrorShape {
  return typeof error === "object" && error !== null ? error : {};
}

/** The only field of the body is `name`: a detail about any other field has nowhere to go. */
function resolveNameField(field: string): FieldErrorEntry<"name"> | null {
  return field === "name" ? { name: "name", message: "nameInvalid" } : null;
}

/**
 * Turns the error of `POST /courses/:id/duplicate` into one of the messages of the dialog. It reads
 * the code together with the status, as the other error helpers of the module do: a 404 that does
 * not come from the API (a gateway, a route that is not deployed) says nothing about this course,
 * and a validation error that points at no field of the form is the generic one. A 403 (the
 * permission was revoked while the dialog was open) and a 401 are generic too: the button is
 * hidden from who cannot duplicate, and the session handler takes the person to the login.
 */
export function toDuplicateCourseErrorKind(error: unknown): DuplicateCourseErrorKind {
  const { statusCode, error: code } = readApiError(error);

  if (statusCode === 409 && code === COURSE_NAME_TAKEN) return "nameTaken";
  if (isCourseNotFound(error)) return "courseNotFound";

  const result = toSubmitError(error, resolveNameField);
  if (result.kind === "fields") return "nameInvalid";

  return result.kind === "network" ? "network" : "unknown";
}
