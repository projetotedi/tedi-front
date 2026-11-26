const GATEWAY_STATUS_CODES: ReadonlySet<number> = new Set([502, 503, 504]);

interface ApiErrorShape {
  statusCode?: unknown;
  error?: unknown;
  details?: unknown;
}

function readApiErrorShape(error: unknown): ApiErrorShape {
  return typeof error === "object" && error !== null ? (error as ApiErrorShape) : {};
}

/** A refusal of the API about an enrollment: the key under `enrollment.errors`. */
export type EnrollmentErrorKind =
  | "classFull"
  | "classClosed"
  | "classArchived"
  | "classNotFound"
  | "studentArchived"
  | "studentNotFound"
  | "alreadyEnrolled"
  | "enrollmentNotFound"
  | "notRemovable"
  | "effectiveDateInFuture"
  | "effectiveDateBeforeEnrollment"
  | "network"
  | "unknown";

const CODES: ReadonlyMap<string, EnrollmentErrorKind> = new Map([
  ["CLASS_FULL", "classFull"],
  ["CLASS_CLOSED", "classClosed"],
  ["CLASS_ARCHIVED", "classArchived"],
  ["CLASS_NOT_FOUND", "classNotFound"],
  ["STUDENT_ARCHIVED", "studentArchived"],
  ["STUDENT_NOT_FOUND", "studentNotFound"],
  ["DUPLICATE_STUDENT", "studentNotFound"],
  ["ALREADY_ENROLLED", "alreadyEnrolled"],
  ["ENROLLMENT_NOT_FOUND", "enrollmentNotFound"],
  ["ENROLLMENT_NOT_REMOVABLE", "notRemovable"],
  ["EFFECTIVE_DATE_IN_FUTURE", "effectiveDateInFuture"],
  ["EFFECTIVE_DATE_BEFORE_ENROLLMENT", "effectiveDateBeforeEnrollment"],
]);

/**
 * What a refusal of `enrollStudents`, `updateEnrollmentStatus` or `removeEnrollment` means for the
 * screen, by the code of the API (GUS-108). A network failure or a gateway error is `network`;
 * anything else, `unknown`.
 */
export function toEnrollmentError(error: unknown): EnrollmentErrorKind {
  const shape = readApiErrorShape(error);
  const kind = typeof shape.error === "string" ? CODES.get(shape.error) : undefined;

  if (kind !== undefined) return kind;
  if (error instanceof TypeError) return "network";
  if (typeof shape.statusCode === "number" && GATEWAY_STATUS_CODES.has(shape.statusCode)) {
    return "network";
  }
  return "unknown";
}

/**
 * The seats left that a 409 `CLASS_FULL` carries, as a decimal string in `details[0].message`.
 * `null` when the refusal is another or does not say it.
 */
export function seatsLeftOf(error: unknown): number | null {
  const shape = readApiErrorShape(error);
  if (shape.error !== "CLASS_FULL" || !Array.isArray(shape.details)) return null;

  const message = (shape.details[0] as { message?: unknown } | undefined)?.message;
  const seats = typeof message === "string" ? Number.parseInt(message, 10) : Number.NaN;
  return Number.isInteger(seats) && seats >= 0 ? seats : null;
}
