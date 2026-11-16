import type { ApiFieldErrorDto } from "@api/generated/model";

/** The fields of the lesson forms, by the name of the property of the DTO an API error points at. */
export type LessonFieldName =
  | "lessonPlanId"
  | "title"
  | "objective"
  | "date"
  | "location"
  | "startTime"
  | "endTime"
  | "expectedStudents"
  | "expectedMonitors"
  | "subject"
  | "status"
  | "postNotes"
  | "reason"
  | "note";

/** The keys, under `fieldErrors`, of the refusals of the API that belong to a field. */
export type LessonFieldErrorKey =
  | "outsideClassPeriod"
  | "invalidTimeRange"
  | "lessonPlanUnavailable"
  | "serverInvalid";

/** The keys, under `errors`, of the refusals that have no field to point at: they show as an alert. */
export type LessonAlertErrorKind =
  | "lessonCancelled"
  | "classArchived"
  | "classNotFound"
  | "lessonNotFound"
  | "network"
  | "unknown";

/**
 * The name is generic so a form types it with the fields it has: `setError(name, ...)` of React
 * Hook Form then takes it without a cast (the dialog of cancelling only has `reason`).
 */
export interface LessonFieldError<TName extends LessonFieldName = LessonFieldName> {
  name: TName;
  message: LessonFieldErrorKey;
}

export type LessonSubmitError<TName extends LessonFieldName = LessonFieldName> =
  | { kind: "fields"; fields: LessonFieldError<TName>[] }
  | { kind: LessonAlertErrorKind };

/**
 * The fields each form can show an API error on, in the order they appear on the screen. The order
 * is what decides which field takes the focus when the API refuses more than one. A field that is
 * not on the list has nowhere to show the error, so a refusal about it becomes the generic alert:
 * the date of a lesson that is being edited is read-only, for instance.
 */
export const CREATE_LESSON_FIELDS = [
  "lessonPlanId",
  "title",
  "objective",
  "date",
  "location",
  "startTime",
  "endTime",
  "expectedStudents",
  "expectedMonitors",
  "subject",
] as const satisfies readonly LessonFieldName[];

export const EDIT_LESSON_FIELDS = [
  "title",
  "objective",
  "location",
  "expectedStudents",
  "expectedMonitors",
  "subject",
  "status",
  "postNotes",
] as const satisfies readonly LessonFieldName[];

export const CANCEL_LESSON_FIELDS = ["reason"] as const satisfies readonly LessonFieldName[];

export const RESCHEDULE_LESSON_FIELDS = [
  "date",
  "startTime",
  "endTime",
  "location",
  "reason",
  "note",
] as const satisfies readonly LessonFieldName[];

const GATEWAY_STATUS_CODES: ReadonlySet<number> = new Set([502, 503, 504]);

const LESSON_PLAN_ERROR_CODES: ReadonlySet<unknown> = new Set([
  "LESSON_PLAN_ARCHIVED",
  "LESSON_PLAN_NOT_FOUND",
  "LESSON_PLAN_NOT_IN_COURSE_SEQUENCE",
]);

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

function onField<TName extends LessonFieldName>(
  allowedFields: readonly TName[],
  name: LessonFieldName,
  message: LessonFieldErrorKey,
): LessonSubmitError<TName> {
  const field = allowedFields.find((allowed) => allowed === name);

  return field === undefined
    ? { kind: "unknown" }
    : { kind: "fields", fields: [{ name: field, message }] };
}

/** The fields a 400 `VALIDATION_FAILED` points at that the form has, once each, in screen order. */
function validationFields<TName extends LessonFieldName>(
  details: unknown,
  allowedFields: readonly TName[],
): LessonSubmitError<TName> {
  const named = new Set<string>(
    Array.isArray(details) ? details.filter(isFieldDetail).map((detail) => detail.field) : [],
  );
  const fields = allowedFields
    .filter((name) => named.has(name))
    .map((name): LessonFieldError<TName> => ({ name, message: "serverInvalid" }));

  return fields.length > 0 ? { kind: "fields", fields } : { kind: "unknown" };
}

/**
 * What a lesson dialog tells the person when its request fails. It reads the code together with the
 * status, as the error helpers of the other modules do: a 404 that does not come from the API (a
 * gateway, a route that is not deployed) says nothing about this lesson, and a code with another
 * status is not the refusal it names. A 401 and a 403 are generic too: the button is hidden from who
 * cannot manage lessons, and the session handler takes the person to the login.
 *
 * - 400 `LESSON_OUTSIDE_CLASS_PERIOD`: the date. 400 `INVALID_TIME_RANGE`: the end time. 400 on the
 *   plan (archived, not found, or not in the sequence at that position): the plan field. 400
 *   `VALIDATION_FAILED`: the fields it points at that the form has (a refusal that points at none
 *   of them is the generic one);
 * - 400 `CLASS_NOT_FOUND`, 404 `LESSON_NOT_FOUND`, 409 `LESSON_CANCELLED` and 409 `CLASS_ARCHIVED`:
 *   the matching alert (a cancelled lesson is final, and the lessons of an archived class are
 *   read-only, RN-27);
 * - a failed connection (`TypeError`) or a gateway (502, 503, 504): `network`. Anything else: `unknown`.
 */
export function toLessonSubmitError<TName extends LessonFieldName>(
  error: unknown,
  allowedFields: readonly TName[],
): LessonSubmitError<TName> {
  const { statusCode, error: code, details } = readApiError(error);

  if (statusCode === 400) {
    if (code === "LESSON_OUTSIDE_CLASS_PERIOD") {
      return onField(allowedFields, "date", "outsideClassPeriod");
    }
    if (code === "INVALID_TIME_RANGE") return onField(allowedFields, "endTime", "invalidTimeRange");
    if (LESSON_PLAN_ERROR_CODES.has(code)) {
      return onField(allowedFields, "lessonPlanId", "lessonPlanUnavailable");
    }
    if (code === "VALIDATION_FAILED") return validationFields(details, allowedFields);
    if (code === "CLASS_NOT_FOUND") return { kind: "classNotFound" };
  }
  if (statusCode === 404 && code === "LESSON_NOT_FOUND") return { kind: "lessonNotFound" };
  if (statusCode === 409 && code === "LESSON_CANCELLED") return { kind: "lessonCancelled" };
  if (statusCode === 409 && code === "CLASS_ARCHIVED") return { kind: "classArchived" };

  if (error instanceof TypeError) return { kind: "network" };
  if (typeof statusCode === "number" && GATEWAY_STATUS_CODES.has(statusCode)) {
    return { kind: "network" };
  }
  return { kind: "unknown" };
}

/** The kind of alert for a failed request that has no field to show the error on (loading the lesson). */
export function toLessonRequestError(error: unknown): LessonAlertErrorKind {
  const result = toLessonSubmitError(error, []);
  return result.kind === "fields" ? "unknown" : result.kind;
}
