export type AttendanceErrorKind =
  | "lessonInFuture"
  | "lessonCancelled"
  | "lessonNotFound"
  | "classArchived"
  | "notInRollCall"
  | "alreadySigned"
  | "notAbsent"
  | "statusUnchanged"
  | "attendanceNotFound"
  | "assignmentNotConfirmed"
  | "selfAttendance"
  | "forbidden"
  | "invalid"
  | "network"
  | "unknown";

interface ApiErrorShape {
  statusCode?: unknown;
  error?: unknown;
}

const KIND_BY_CODE: Readonly<Record<string, AttendanceErrorKind>> = {
  LESSON_IN_FUTURE: "lessonInFuture",
  LESSON_CANCELLED: "lessonCancelled",
  LESSON_NOT_FOUND: "lessonNotFound",
  CLASS_ARCHIVED: "classArchived",
  ENROLLMENT_NOT_IN_ROLL_CALL: "notInRollCall",
  STUDENT_ATTENDANCE_ALREADY_SIGNED: "alreadySigned",
  STUDENT_ATTENDANCE_NOT_ABSENT: "notAbsent",
  STUDENT_ATTENDANCE_STATUS_UNCHANGED: "statusUnchanged",
  STUDENT_ATTENDANCE_NOT_FOUND: "attendanceNotFound",
  ASSIGNMENT_NOT_CONFIRMED: "assignmentNotConfirmed",
  SELF_ATTENDANCE_NOT_ALLOWED: "selfAttendance",
  FORBIDDEN_SCOPE: "forbidden",
  FORBIDDEN: "forbidden",
  DUPLICATE_ENROLLMENT: "invalid",
  DUPLICATE_ASSIGNMENT: "invalid",
  VALIDATION_FAILED: "invalid",
};

const GATEWAY_STATUS_CODES: ReadonlySet<unknown> = new Set([502, 503, 504]);

export function toAttendanceError(error: unknown): AttendanceErrorKind {
  if (error instanceof TypeError) return "network";
  const { statusCode, error: code } =
    typeof error === "object" && error !== null ? (error as ApiErrorShape) : {};
  if (GATEWAY_STATUS_CODES.has(statusCode)) return "network";
  return (typeof code === "string" ? KIND_BY_CODE[code] : undefined) ?? "unknown";
}
