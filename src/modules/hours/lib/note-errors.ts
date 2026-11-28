import { readApiError } from "./review-errors";

/** What a refusal of the observation of a category says, as the dialog tells it apart. */
export type NoteErrorKind = "invalid" | "forbidden" | "memberNotFound" | "generic";

/**
 * The kind of a refusal of `PUT /members/:id/hours/notes`. The code is read together with the status,
 * as the other modules do: a code with another status is not the refusal it names.
 *
 * - 400 `VALIDATION_FAILED`: the text was refused (`invalidFields` of `review-errors` says which field);
 * - 403 `FORBIDDEN` or `FORBIDDEN_SCOPE`: the person may not write observations;
 * - 404 `MEMBER_NOT_FOUND`: the member is unknown, was removed or is a student;
 * - anything else (connection, 5xx): generic.
 */
export function toNoteError(error: unknown): NoteErrorKind {
  const { statusCode, code } = readApiError(error);

  if (statusCode === 400 && code === "VALIDATION_FAILED") return "invalid";
  if (statusCode === 403 && (code === "FORBIDDEN" || code === "FORBIDDEN_SCOPE")) {
    return "forbidden";
  }
  if (statusCode === 404 && code === "MEMBER_NOT_FOUND") return "memberNotFound";

  return "generic";
}
