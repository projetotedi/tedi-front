/**
 * The keys, under `form.errors`, of the refusals of the API that belong to the course field of the
 * class form.
 */
export type CourseFieldErrorKey = "courseChangeNotAllowed" | "courseArchived" | "courseNotFound";

interface ApiErrorShape {
  statusCode?: unknown;
  error?: unknown;
}

function readApiErrorShape(error: unknown): ApiErrorShape {
  return typeof error === "object" && error !== null ? (error as ApiErrorShape) : {};
}

/**
 * Which refusal of the API is about the course of the class, if any: 409 `COURSE_CHANGE_NOT_ALLOWED`
 * (the class is no longer planned, or already has enrollments), 409 `COURSE_ARCHIVED` (RF-020) and
 * 400 `COURSE_NOT_FOUND`. It reads the status with the code, as the error helpers of the other
 * modules do, and only the shape of the error (`statusCode` and `error`, what `ApiError` carries),
 * so a module does not import the HTTP client to recognize one. Anything else is `null`.
 */
export function toCourseFieldError(error: unknown): CourseFieldErrorKey | null {
  const { statusCode, error: code } = readApiErrorShape(error);

  if (statusCode === 409 && code === "COURSE_CHANGE_NOT_ALLOWED") return "courseChangeNotAllowed";
  if (statusCode === 409 && code === "COURSE_ARCHIVED") return "courseArchived";
  if (statusCode === 400 && code === "COURSE_NOT_FOUND") return "courseNotFound";
  return null;
}
