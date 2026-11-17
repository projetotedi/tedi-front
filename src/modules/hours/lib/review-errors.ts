/** What a refusal of a review says, as the screens tell it apart. */
export type ReviewErrorKind =
  | "notPending"
  | "notFound"
  | "selfReview"
  | "unchanged"
  | "invalid"
  | "generic";

interface ApiErrorFields {
  statusCode: unknown;
  code: unknown;
  details: unknown;
}

/** What the error says, read without importing the HTTP client (the API error is an object with these fields). */
function readApiError(error: unknown): ApiErrorFields {
  if (typeof error !== "object" || error === null) {
    return { statusCode: undefined, code: undefined, details: undefined };
  }
  return {
    statusCode: "statusCode" in error ? error.statusCode : undefined,
    code: "error" in error ? error.error : undefined,
    details: "details" in error ? error.details : undefined,
  };
}

/**
 * The kind of a refusal of validate, adjust or reject. The code is read together with the status, as
 * the other modules do: a code with another status is not the refusal it names.
 *
 * - 409 `ENTRY_NOT_PENDING`: somebody reviewed it first. 409 `SELF_REVIEW_NOT_ALLOWED`: it is the
 *   person's own entry;
 * - `HOUR_ENTRY_NOT_FOUND`: 404 on the routes of one entry, 400 on the batch: it was removed;
 * - 400 `ADJUSTED_MINUTES_UNCHANGED`: the adjustment kept the declared minutes;
 * - 400 `VALIDATION_FAILED`: a field was refused;
 * - anything else (connection, 5xx, 403): generic.
 */
export function toReviewError(error: unknown): ReviewErrorKind {
  const { statusCode, code } = readApiError(error);

  if (statusCode === 409 && code === "ENTRY_NOT_PENDING") return "notPending";
  if (statusCode === 409 && code === "SELF_REVIEW_NOT_ALLOWED") return "selfReview";
  if ((statusCode === 404 || statusCode === 400) && code === "HOUR_ENTRY_NOT_FOUND") {
    return "notFound";
  }
  if (statusCode === 400 && code === "ADJUSTED_MINUTES_UNCHANGED") return "unchanged";
  if (statusCode === 400 && code === "VALIDATION_FAILED") return "invalid";

  return "generic";
}

/** The fields a 400 `VALIDATION_FAILED` points at (`details[].field`), in the order it sends them. */
export function invalidFields(error: unknown): string[] {
  const { details } = readApiError(error);
  if (!Array.isArray(details)) return [];

  return details.flatMap((detail: unknown) =>
    typeof detail === "object" &&
    detail !== null &&
    "field" in detail &&
    typeof detail.field === "string"
      ? [detail.field]
      : [],
  );
}

/** The refusals after which the queue on the screen is out of date: it is read again. */
export const STALE_QUEUE_ERRORS: ReadonlySet<ReviewErrorKind> = new Set(["notPending", "notFound"]);
