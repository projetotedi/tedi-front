import { z } from "zod";

import type { ApplyToLessonDto, AssignmentRole } from "@api/generated/model";
import {
  ApplyToLessonBody,
  applyToLessonBodyNoteMax,
} from "@api/generated/zod/assignments/assignments";

/** The limit of the note in the contract, by the name the message of `fieldErrors` uses. */
export const APPLY_NOTE_MAX = applyToLessonBodyNoteMax;

/**
 * The form of "Candidatar-se à aula". It is not the DTO (`ApplyToLessonBody`): the role starts with
 * no choice (`null`: the person has to choose, and the screen never picks a role for them when
 * there are two to pick from), so it is accepted as input and refused on the way out; and the note
 * is the text of the box, where blank means "none". The role still takes the values of the
 * generated schema, and the limit of the note comes from the contract, so the front and the API do
 * not drift apart. The note is counted without the spaces around it, the way it is sent. The
 * messages are keys of `apply.fieldErrors`.
 *
 * Whether the role still has a place is the API's to say (409 `ROLE_FULL`): the screen only turns
 * off the roles the list of lessons already showed as full.
 */
export const applyToLessonFormSchema = z.object({
  role: ApplyToLessonBody.shape.role
    .nullable()
    .refine((role): role is AssignmentRole => role !== null, "roleRequired"),
  note: z.string().trim().max(APPLY_NOTE_MAX, "noteTooLong"),
});

export type ApplyToLessonFormInput = z.input<typeof applyToLessonFormSchema>;
export type ApplyToLessonFormValues = z.output<typeof applyToLessonFormSchema>;

/** What the form starts with: no role chosen and no note. */
export function emptyApplyToLessonFormInput(): ApplyToLessonFormInput {
  return { role: null, note: "" };
}

/** The body of `POST /lessons/:id/applications`: a blank note is not informed, so `null`. */
export function toApplyToLessonBody(values: ApplyToLessonFormValues): ApplyToLessonDto {
  const note = values.note.trim();

  return { role: values.role, note: note === "" ? null : note };
}
