import { z } from "zod";

import type { HourEntryCategory, SetHourCategoryNoteDto } from "@api/generated/model";
import { setNoteBodyNoteMax } from "@api/generated/zod/hours/hours";

/**
 * The form of the observation of a category. It differs from the generated `SetNoteBody` because it
 * trims the text before counting (the API trims it too, and a note of spaces only clears it) and its
 * messages are keys of `categoryNote.errors`. The limit comes from the contract.
 */
export const categoryNoteFormSchema = z.object({
  note: z.string().trim().max(setNoteBodyNoteMax, "tooLong"),
});

export type CategoryNoteFormInput = z.input<typeof categoryNoteFormSchema>;
export type CategoryNoteFormValues = z.output<typeof categoryNoteFormSchema>;

/** The body of `PUT /members/:id/hours/notes`: the trimmed text, or `null` (clears it) when it is blank. */
export function toSetNoteBody(
  category: HourEntryCategory,
  values: CategoryNoteFormValues,
): SetHourCategoryNoteDto {
  return { category, note: values.note === "" ? null : values.note };
}
