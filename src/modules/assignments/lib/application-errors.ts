import type { ApiFieldErrorDto } from "@api/generated/model";

/** The fields of the form of applying, in the order they appear on the screen. */
export const APPLY_FIELDS = ["role", "note"] as const;
export type ApplyFieldName = (typeof APPLY_FIELDS)[number];

/** The keys, under `apply.errors`, of the refusals that have no field to point at: they show as an alert. */
export type ApplyErrorKind =
  | "roleFull"
  | "alreadyApplied"
  | "lessonClosed"
  | "lessonNotFound"
  | "memberInactive"
  | "network"
  | "unknown";

export type ApplySubmitError =
  | { kind: "fields"; fields: { name: ApplyFieldName; message: "serverInvalid" }[] }
  | { kind: ApplyErrorKind };

/** The keys, under `pendingApplications.errors`, of the refusals of confirming or declining. */
export type ReviewErrorKind =
  | "roleFull"
  | "notPending"
  | "notFound"
  | "lessonCancelled"
  | "memberInactive"
  | "network"
  | "unknown";

const GATEWAY_STATUS_CODES: ReadonlySet<number> = new Set([502, 503, 504]);

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

/** The fields a 400 `VALIDATION_FAILED` points at that the form has, once each, in screen order. */
function validationFields(details: unknown): ApplySubmitError {
  const named = new Set<string>(
    Array.isArray(details) ? details.filter(isFieldDetail).map((detail) => detail.field) : [],
  );
  const fields = APPLY_FIELDS.filter((name) => named.has(name)).map((name) => ({
    name,
    message: "serverInvalid" as const,
  }));

  return fields.length > 0 ? { kind: "fields", fields } : { kind: "unknown" };
}

function isNetworkFailure(error: unknown, statusCode: unknown): boolean {
  return (
    error instanceof TypeError ||
    (typeof statusCode === "number" && GATEWAY_STATUS_CODES.has(statusCode))
  );
}

/**
 * What the dialog of applying tells the person when its request fails. It reads the code together
 * with the status, as the error helpers of the other modules do: a 404 that does not come from the
 * API (a gateway, a route that is not deployed) says nothing about this lesson, and a code with
 * another status is not the refusal it names. A 401 and a 403 are generic too: the button is for
 * who has `assignments.manageOwn`, and the session handler takes the person to the login.
 *
 * - 409 `ROLE_FULL`: the role was filled in the meantime. 409 `ALREADY_APPLIED`: the member already
 *   holds a place in the lesson, as either role;
 * - 409 `LESSON_IN_PAST` and 409 `LESSON_CANCELLED`: the lesson takes no more applications (it
 *   already happened, or was cancelled), which is one message;
 * - 409 `MEMBER_INACTIVE` and 404 `LESSON_NOT_FOUND`: the matching alert;
 * - 400 `VALIDATION_FAILED`: the fields it points at that the form has (a refusal that points at
 *   none of them is the generic one);
 * - a failed connection (`TypeError`) or a gateway (502, 503, 504): `network`. Anything else:
 *   `unknown`.
 */
export function toApplySubmitError(error: unknown): ApplySubmitError {
  const { statusCode, error: code, details } = readApiError(error);

  if (statusCode === 400 && code === "VALIDATION_FAILED") return validationFields(details);
  if (statusCode === 404 && code === "LESSON_NOT_FOUND") return { kind: "lessonNotFound" };
  if (statusCode === 409) {
    if (code === "ROLE_FULL") return { kind: "roleFull" };
    if (code === "ALREADY_APPLIED") return { kind: "alreadyApplied" };
    if (code === "LESSON_IN_PAST" || code === "LESSON_CANCELLED") return { kind: "lessonClosed" };
    if (code === "MEMBER_INACTIVE") return { kind: "memberInactive" };
  }

  return isNetworkFailure(error, statusCode) ? { kind: "network" } : { kind: "unknown" };
}

/**
 * What the dialog of the pending applications tells the person when confirming or declining fails,
 * read the same way (code and status together):
 *
 * - 409 `ROLE_FULL`: the place of that role was filled by another confirmation;
 * - 409 `APPLICATION_NOT_PENDING` and 404 `APPLICATION_NOT_FOUND`: somebody else decided it first,
 *   or it is gone;
 * - 409 `LESSON_CANCELLED`: the lesson was cancelled, so it can only be declined;
 * - 409 `MEMBER_INACTIVE`: the member is no longer active;
 * - a failed connection or a gateway: `network`. Anything else: `unknown`.
 */
export function toReviewError(error: unknown): ReviewErrorKind {
  const { statusCode, error: code } = readApiError(error);

  if (statusCode === 404 && code === "APPLICATION_NOT_FOUND") return "notFound";
  if (statusCode === 409) {
    if (code === "ROLE_FULL") return "roleFull";
    if (code === "APPLICATION_NOT_PENDING") return "notPending";
    if (code === "LESSON_CANCELLED") return "lessonCancelled";
    if (code === "MEMBER_INACTIVE") return "memberInactive";
  }

  return isNetworkFailure(error, statusCode) ? "network" : "unknown";
}
