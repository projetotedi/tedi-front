import type { ApiFieldErrorDto } from "@api/generated/model";

/**
 * The keys, under `warnings`, of the refusals that are a rule of the system and not a mistake of
 * the person: the member already has a place in the lesson, the lesson already has its teacher, the
 * lesson is cancelled, the member is not active, the assignment is not active any more. They show as
 * a warning.
 */
export type AssignmentWarningKind =
  | "duplicateRole"
  | "teacherTaken"
  | "lessonCancelled"
  | "memberInactive"
  | "assignmentNotActive";

/** The keys, under `errors`, of the refusals that have no field to point at: they show as an alert. */
export type AssignmentAlertKind =
  | "lessonNotFound"
  | "assignmentNotFound"
  | "forbidden"
  | "network"
  | "unknown";

/** The fields of the form of a new assignment, by the name of the property an API error points at. */
export type AssignmentFieldName = "personId" | "lessonId" | "role" | "status";

/** The keys, under `fieldErrors`, of the refusals of the API that belong to a field. */
export type AssignmentFieldErrorKey = "memberNotFound" | "serverInvalid";

/**
 * The name is generic so a form types it with the fields it has: `setError(name, ...)` of React Hook
 * Form then takes it without a cast.
 */
export interface AssignmentFieldError<TName extends AssignmentFieldName = AssignmentFieldName> {
  name: TName;
  message: AssignmentFieldErrorKey;
}

export interface AssignmentWarning {
  kind: "warning";
  warning: AssignmentWarningKind;
}

export interface AssignmentAlert {
  kind: "alert";
  alert: AssignmentAlertKind;
}

/** What has no field to show on: a warning of the system or an alert. */
export type AssignmentIssue = AssignmentWarning | AssignmentAlert;

export type AssignmentSubmitError<TName extends AssignmentFieldName = AssignmentFieldName> =
  | { kind: "fields"; fields: AssignmentFieldError<TName>[] }
  | AssignmentIssue;

const GATEWAY_STATUS_CODES: ReadonlySet<number> = new Set([502, 503, 504]);

const FORBIDDEN_CODES: ReadonlySet<unknown> = new Set(["FORBIDDEN", "FORBIDDEN_SCOPE"]);

interface ApiErrorShape {
  statusCode?: unknown;
  error?: unknown;
  details?: unknown;
}

/** Only the shape of the error (what `ApiError` carries), so a module does not import the HTTP client. */
function readApiError(error: unknown): ApiErrorShape {
  return typeof error === "object" && error !== null ? (error as ApiErrorShape) : {};
}

function isFieldDetail(detail: unknown): detail is ApiFieldErrorDto {
  if (typeof detail !== "object" || detail === null) return false;
  const { field, message } = detail as Partial<ApiFieldErrorDto>;
  return typeof field === "string" && typeof message === "string";
}

function alert(kind: AssignmentAlertKind): AssignmentAlert {
  return { kind: "alert", alert: kind };
}

function warning(kind: AssignmentWarningKind): AssignmentWarning {
  return { kind: "warning", warning: kind };
}

/** A failed connection (`TypeError`) or a gateway (502, 503, 504) is the network; anything else is `unknown`. */
function transportError(error: unknown, statusCode: unknown): AssignmentAlert {
  if (error instanceof TypeError) return alert("network");
  if (typeof statusCode === "number" && GATEWAY_STATUS_CODES.has(statusCode)) {
    return alert("network");
  }
  return alert("unknown");
}

function onField<TName extends AssignmentFieldName>(
  allowedFields: readonly TName[],
  name: AssignmentFieldName,
  message: AssignmentFieldErrorKey,
): AssignmentSubmitError<TName> {
  const field = allowedFields.find((allowed) => allowed === name);

  return field === undefined
    ? alert("unknown")
    : { kind: "fields", fields: [{ name: field, message }] };
}

/** The fields a 400 `VALIDATION_FAILED` points at that the form has, once each, in screen order. */
function validationFields<TName extends AssignmentFieldName>(
  details: unknown,
  allowedFields: readonly TName[],
): AssignmentSubmitError<TName> {
  const named = new Set<string>(
    Array.isArray(details) ? details.filter(isFieldDetail).map((detail) => detail.field) : [],
  );
  const fields = allowedFields
    .filter((name) => named.has(name))
    .map((name): AssignmentFieldError<TName> => ({ name, message: "serverInvalid" }));

  return fields.length > 0 ? { kind: "fields", fields } : alert("unknown");
}

function createWarning(code: unknown): AssignmentWarning | null {
  switch (code) {
    case "DUPLICATE_ROLE_IN_LESSON":
      return warning("duplicateRole");
    case "LESSON_TEACHER_TAKEN":
      return warning("teacherTaken");
    case "LESSON_CANCELLED":
      return warning("lessonCancelled");
    case "MEMBER_INACTIVE":
      return warning("memberInactive");
    default:
      return null;
  }
}

/**
 * What the dialog of a new assignment tells the person when its request fails. It reads the code
 * together with the status, as the error helpers of the other modules do: a 404 that does not come
 * from the API (a gateway, a route that is not deployed) says nothing about this lesson, and a code
 * with another status is not the refusal it names. A 401 and a 403 are generic too: the button is
 * hidden from who cannot assign, and the session handler takes the person to the login.
 *
 * - 409 `DUPLICATE_ROLE_IN_LESSON`, `LESSON_TEACHER_TAKEN`, `LESSON_CANCELLED` and
 *   `MEMBER_INACTIVE`: a warning, because each is a rule of the system and the person chooses what
 *   to do about it;
 * - 400 `MEMBER_NOT_FOUND`: the member field. When the member is fixed (the form was opened from her
 *   sheet) there is no field, and the refusal is the generic alert;
 * - 400 `VALIDATION_FAILED`: the fields it points at that the form has (a refusal that points at
 *   none of them is the generic one);
 * - 404 `LESSON_NOT_FOUND`: the alert of the lesson that is gone;
 * - a failed connection (`TypeError`) or a gateway (502, 503, 504): `network`. Anything else:
 *   `unknown`.
 *
 * `allowedFields` are the fields the form can show an error on, in the order they appear on the
 * screen, which is what decides which one takes the focus when the API refuses more than one.
 */
export function toCreateAssignmentError<TName extends AssignmentFieldName>(
  error: unknown,
  allowedFields: readonly TName[],
): AssignmentSubmitError<TName> {
  const { statusCode, error: code, details } = readApiError(error);

  if (statusCode === 409) {
    const refusal = createWarning(code);
    if (refusal !== null) return refusal;
  }
  if (statusCode === 400 && code === "MEMBER_NOT_FOUND") {
    return onField(allowedFields, "personId", "memberNotFound");
  }
  if (statusCode === 400 && code === "VALIDATION_FAILED") {
    return validationFields(details, allowedFields);
  }
  if (statusCode === 404 && code === "LESSON_NOT_FOUND") return alert("lessonNotFound");

  return transportError(error, statusCode);
}

/**
 * What the dialog of cancelling an assignment tells the person when its request fails. 409
 * `ASSIGNMENT_NOT_ACTIVE` is a warning (somebody else decided that assignment first, so there is
 * nothing left to cancel), 404 `ASSIGNMENT_NOT_FOUND` is the alert of the assignment that is gone,
 * the network is `network` and anything else is `unknown`.
 */
export function toCancelAssignmentError(error: unknown): AssignmentIssue {
  const { statusCode, error: code } = readApiError(error);

  if (statusCode === 409 && code === "ASSIGNMENT_NOT_ACTIVE") return warning("assignmentNotActive");
  if (statusCode === 404 && code === "ASSIGNMENT_NOT_FOUND") return alert("assignmentNotFound");

  return transportError(error, statusCode);
}

/**
 * The kind of alert for a list that could not be loaded (the assignments of a lesson or of a member).
 * 403 `FORBIDDEN` or `FORBIDDEN_SCOPE` is `forbidden`: a director sees the assignments of the members
 * of her own department only (A14), and that is told, not shown as a failure. 404 `LESSON_NOT_FOUND`
 * is `lessonNotFound`; the network is `network` and anything else, the 404 of a member included, is
 * `unknown`.
 */
export function toAssignmentRequestError(error: unknown): AssignmentAlertKind {
  const { statusCode, error: code } = readApiError(error);

  if (statusCode === 403 && FORBIDDEN_CODES.has(code)) return "forbidden";
  if (statusCode === 404 && code === "LESSON_NOT_FOUND") return "lessonNotFound";

  return transportError(error, statusCode).alert;
}
