/**
 * What the dialog tells the person when `POST /classes/:id/lessons/preview` or `.../generate`
 * fails. Each one is a key of `generate.errors`, except `invalidTimeRange`, which is shown on the
 * field of the end time (`generate.fieldErrors.endTimeBeforeStart`).
 */
export type GenerateLessonsErrorKind =
  | "alreadyGenerated"
  | "courseWithoutSequence"
  | "outsideClassPeriod"
  | "classArchived"
  | "classNotFound"
  | "invalidTimeRange"
  | "network"
  | "unknown";

/**
 * The refusals that are rules of the system and not failures: the person did nothing wrong and
 * nothing is broken, so the dialog shows them as a warning (`Alert warning`). The others are shown
 * as an error.
 */
export const GENERATE_LESSONS_WARNINGS: readonly GenerateLessonsErrorKind[] = [
  "alreadyGenerated",
  "courseWithoutSequence",
  "outsideClassPeriod",
  "classArchived",
];

const GATEWAY_STATUS_CODES: ReadonlySet<number> = new Set([502, 503, 504]);

interface ApiErrorShape {
  statusCode?: unknown;
  error?: unknown;
}

function readApiError(error: unknown): ApiErrorShape {
  return typeof error === "object" && error !== null ? (error as ApiErrorShape) : {};
}

/**
 * Turns the error of the preview or of generate into one of the messages of the dialog. It reads
 * the code together with the status, as the other error helpers of the app do: a 404 that does not
 * come from the API (a gateway, a route that is not deployed) says nothing about this class, so it
 * is the generic error. It reads only the shape of the error (`statusCode` and `error`, what the
 * `ApiError` of the client carries), so a module does not import the client to recognize one.
 * A 403 (the permission was revoked while the dialog was open) and a 401 are generic too: the
 * button is hidden from who cannot generate, and the session handler takes the person to the
 * login.
 */
export function toGenerateLessonsErrorKind(error: unknown): GenerateLessonsErrorKind {
  const { statusCode, error: code } = readApiError(error);

  if (statusCode === 409 && code === "LESSONS_ALREADY_GENERATED") return "alreadyGenerated";
  if (statusCode === 409 && code === "COURSE_WITHOUT_SEQUENCE") return "courseWithoutSequence";
  if (statusCode === 409 && code === "LESSONS_OUTSIDE_CLASS_PERIOD") return "outsideClassPeriod";
  if (statusCode === 409 && code === "CLASS_ARCHIVED") return "classArchived";
  if (statusCode === 404 && code === "CLASS_NOT_FOUND") return "classNotFound";
  if (statusCode === 400 && code === "INVALID_TIME_RANGE") return "invalidTimeRange";

  if (error instanceof TypeError) return "network";
  if (typeof statusCode === "number" && GATEWAY_STATUS_CODES.has(statusCode)) return "network";

  return "unknown";
}

/** Whether the dialog shows this refusal as a warning of a rule, and not as an error. */
export function isGenerateLessonsWarning(kind: GenerateLessonsErrorKind): boolean {
  return GENERATE_LESSONS_WARNINGS.includes(kind);
}
