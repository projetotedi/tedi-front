import { z } from "zod";

import type { HourEntryCategory, SetHourCategoryNoteDto } from "@api/generated/model";
import { setNoteBodyNoteMax } from "@api/generated/zod/hours/hours";

export const categoryNoteFormSchema = z.object({
  note: z.string().trim().max(setNoteBodyNoteMax, "tooLong"),
});

export type CategoryNoteFormInput = z.input<typeof categoryNoteFormSchema>;
export type CategoryNoteFormValues = z.output<typeof categoryNoteFormSchema>;

export function toNoteBody(
  category: HourEntryCategory,
  values: CategoryNoteFormValues,
): SetHourCategoryNoteDto {
  return { category, note: values.note === "" ? null : values.note };
}
