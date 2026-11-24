import type { ApiFieldErrorDto } from "@api/generated/model";

/** The fields of "Lançar horas", in the order they are on the screen: the first invalid one takes the focus. */
export const LOG_HOURS_FIELDS = ["activity", "category", "date", "hours", "notes"] as const;
export type LogHoursFieldName = (typeof LOG_HOURS_FIELDS)[number];

/** The keys, under `logHours.fieldErrors`, of the refusals of the API that belong to a field. */
export type LogHoursFieldMessage = "serverInvalid" | "dateInFuture";

/** The keys, under `logHours.errors`, of the refusals that have no field to point at. */
export type LogHoursIssue = "selfOnBehalf" | "forbidden" | "memberNotFound" | "network" | "unknown";

export type LogHoursError =
  | { kind: "fields"; fields: { name: LogHoursFieldName; message: LogHoursFieldMessage }[] }
  | { kind: "issue"; issue: LogHoursIssue };

/** The field of the form each property of `CreateHourEntryDto` is typed in. */
const FIELD_OF_PROPERTY: Readonly<Record<string, LogHoursFieldName>> = {
  activity: "activity",
  category: "category",
  date: "date",
  declaredMinutes: "hours",
  notes: "notes",
};

const GATEWAY_STATUS_CODES: ReadonlySet<number> = new Set([502, 503, 504]);

const FORBIDDEN_CODES: ReadonlySet<unknown> = new Set(["FORBIDDEN", "FORBIDDEN_SCOPE"]);

interface ApiErrorShape {
  statusCode?: unknown;
  error?: unknown;
  details?: unknown;
}

/** Only the shape of the error (what `ApiError` carries), so a module does not import the HTTP client. */
function readApiError(error: unknown): ApiErrorShape {
  if (typeof error !== "object" || error === null) return {};

  return {
    statusCode: "statusCode" in error ? error.statusCode : undefined,
    error: "error" in error ? error.error : undefined,
    details: "details" in error ? error.details : undefined,
  };
}

function isFieldDetail(detail: unknown): detail is ApiFieldErrorDto {
  return (
    typeof detail === "object" &&
    detail !== null &&
    "field" in detail &&
    typeof detail.field === "string" &&
    "message" in detail &&
    typeof detail.message === "string"
  );
}

/** A failed connection (`TypeError`) or a gateway (502, 503, 504). */
function isNetworkFailure(error: unknown, statusCode: unknown): boolean {
  return (
    error instanceof TypeError ||
    (typeof statusCode === "number" && GATEWAY_STATUS_CODES.has(statusCode))
  );
}

/** The fields a 400 `VALIDATION_FAILED` points at that the form has, once each, in screen order. */
function validationFields(details: unknown): LogHoursError {
  const named = new Set<LogHoursFieldName>();
  for (const detail of Array.isArray(details) ? details.filter(isFieldDetail) : []) {
    if (Object.prototype.hasOwnProperty.call(FIELD_OF_PROPERTY, detail.field)) {
      named.add(FIELD_OF_PROPERTY[detail.field]);
    }
  }
  const fields = LOG_HOURS_FIELDS.filter((name) => named.has(name)).map((name) => ({
    name,
    message: "serverInvalid" as const,
  }));

  return fields.length > 0 ? { kind: "fields", fields } : { kind: "issue", issue: "unknown" };
}

/**
 * What "Lançar horas" tells the person when the API refuses the entry. It reads the code together
 * with the status: a 404 that does not come from the API (a gateway, a route that is not deployed)
 * says nothing about the member, and a code with another status is not the refusal it names.
 *
 * - 400 `VALIDATION_FAILED`: the fields it points at (`declaredMinutes` is Horas); one that points at
 *   none of them is `unknown`. 400 `HOUR_ENTRY_DATE_IN_FUTURE`: Data (the clock of the machine is
 *   ahead of the one of the API, in America/Sao_Paulo);
 * - 400 `SELF_ON_BEHALF_NOT_ALLOWED`, 403 `FORBIDDEN`/`FORBIDDEN_SCOPE` and 404 `MEMBER_NOT_FOUND`:
 *   the refusals of logging on behalf of somebody (oneself, a member out of the department of the
 *   director, a member that is gone);
 * - a failed connection or a gateway: `network`. Anything else: `unknown`.
 */
export function toLogHoursError(error: unknown): LogHoursError {
  const { statusCode, error: code, details } = readApiError(error);

  if (statusCode === 400) {
    if (code === "VALIDATION_FAILED") return validationFields(details);
    if (code === "HOUR_ENTRY_DATE_IN_FUTURE") {
      return { kind: "fields", fields: [{ name: "date", message: "dateInFuture" }] };
    }
    if (code === "SELF_ON_BEHALF_NOT_ALLOWED") return { kind: "issue", issue: "selfOnBehalf" };
  }
  if (statusCode === 403 && FORBIDDEN_CODES.has(code)) return { kind: "issue", issue: "forbidden" };
  if (statusCode === 404 && code === "MEMBER_NOT_FOUND") {
    return { kind: "issue", issue: "memberNotFound" };
  }

  return { kind: "issue", issue: isNetworkFailure(error, statusCode) ? "network" : "unknown" };
}

/**
 * How a refusal with no field shows in "Lançar horas", and whether it turns the button off. Logging
 * for oneself is a warning (the way is the button of the profile); the member out of reach or gone
 * is an error; both say the same request would be refused again. The network and the unknown let
 * the person try again.
 */
export function logHoursIssueDisplay(issue: LogHoursIssue): {
  variant: "warning" | "error";
  blocks: boolean;
} {
  switch (issue) {
    case "selfOnBehalf":
      return { variant: "warning", blocks: true };
    case "forbidden":
    case "memberNotFound":
      return { variant: "error", blocks: true };
    case "network":
    case "unknown":
      return { variant: "error", blocks: false };
    default: {
      const unknownIssue: never = issue;
      return unknownIssue;
    }
  }
}

/** The keys, under `removeEntry.warnings` and `removeEntry.errors`, of the refusals of removing an entry. */
export type RemoveEntryIssue =
  | { kind: "warning"; warning: "notPending" | "attendance" }
  | { kind: "alert"; alert: "notFound" | "network" | "unknown" };

/**
 * What "Remover lançamento" tells the person when the API refuses, read the same way (code and
 * status together). The statement only offers removing a pending entry that did not come from the
 * attendance, so a refusal means it changed meanwhile:
 *
 * - 409 `ENTRY_NOT_PENDING`: the coordination validated it first (warning);
 * - 409 `ATTENDANCE_ENTRY_NOT_REMOVABLE`: it is an hour of a lesson (warning);
 * - 404 `HOUR_ENTRY_NOT_FOUND`: it is gone (alert);
 * - a failed connection or a gateway: `network`. Anything else: `unknown`.
 */
export function toRemoveEntryError(error: unknown): RemoveEntryIssue {
  const { statusCode, error: code } = readApiError(error);

  if (statusCode === 409 && code === "ENTRY_NOT_PENDING") {
    return { kind: "warning", warning: "notPending" };
  }
  if (statusCode === 409 && code === "ATTENDANCE_ENTRY_NOT_REMOVABLE") {
    return { kind: "warning", warning: "attendance" };
  }
  if (statusCode === 404 && code === "HOUR_ENTRY_NOT_FOUND") {
    return { kind: "alert", alert: "notFound" };
  }

  return { kind: "alert", alert: isNetworkFailure(error, statusCode) ? "network" : "unknown" };
}

/**
 * Whether the refusal says the entry is not what the statement showed (validated, a lesson hour or
 * gone): there is nothing left to remove, and the lists behind are out of date.
 */
export function isStaleEntry(issue: RemoveEntryIssue): boolean {
  switch (issue.kind) {
    case "warning":
      return true;
    case "alert":
      return issue.alert === "notFound";
    default: {
      const unknownIssue: never = issue;
      return unknownIssue;
    }
  }
}
