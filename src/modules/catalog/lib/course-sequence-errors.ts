import { toRequestErrorKind } from "./api-form-errors";

/**
 * What the dialog tells the person when the `PUT` of the sequence fails. `courseNotFound` also
 * covers the `GET` of the page. A key of `course.sequence.errors` for each one.
 */
export type SequenceErrorKind =
  | "duplicate"
  | "courseArchived"
  | "planArchived"
  | "planNotFound"
  | "courseNotFound"
  | "network"
  | "unknown";

interface ApiErrorShape {
  statusCode?: unknown;
  error?: unknown;
}

function readApiError(error: unknown): ApiErrorShape {
  return typeof error === "object" && error !== null ? error : {};
}

/**
 * Turns the error of `GET` or `PUT /courses/:id/lesson-plans` into one of the messages of the
 * dialog. On the sequence the API answers an archived lesson plan with 400, not with the 409 that
 * the plan routes use, and answers an id that is not a UUID with `VALIDATION_FAILED`, which for the
 * person is the same as a plan that does not exist (the ids of the sequence come from the picker,
 * never typed, so there is no field to point at).
 */
export function toSequenceErrorKind(error: unknown): SequenceErrorKind {
  const { statusCode, error: code } = readApiError(error);

  if (statusCode === 400 && code === "DUPLICATE_LESSON_PLAN") return "duplicate";
  if (statusCode === 409 && code === "COURSE_ARCHIVED") return "courseArchived";
  if (statusCode === 400 && code === "LESSON_PLAN_ARCHIVED") return "planArchived";
  if (statusCode === 400 && (code === "LESSON_PLAN_NOT_FOUND" || code === "VALIDATION_FAILED")) {
    return "planNotFound";
  }
  if (statusCode === 404) return "courseNotFound";

  return toRequestErrorKind(error) === "network" ? "network" : "unknown";
}
