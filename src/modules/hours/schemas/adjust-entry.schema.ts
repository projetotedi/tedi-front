import { z } from "zod";

import type { AdjustHourEntryDto } from "@api/generated/model";
import {
  adjustHourEntryBodyJustificationMax,
  adjustHourEntryBodyValidatedMinutesMax,
} from "@api/generated/zod/hours/hours";

const HOURS_INPUT = /^(\d{1,2})h([0-5]\d)?$/i;

/** "2h" → 120, "2h30" → 150, " 2H30 " → 150; anything else → null. The TEDI form of hours (formatHours). */
export function parseHoursInput(value: string): number | null {
  const parts = HOURS_INPUT.exec(value.trim());
  if (parts === null) return null;

  const minutes = parts[2] === undefined ? 0 : Number(parts[2]);
  return Number(parts[1]) * 60 + minutes;
}

/**
 * The form of Ajustar lançamento. It is not the DTO (AdjustHourEntryBody): the new value is typed in
 * hours ("2h30") and becomes minutes, and it must differ from the declared minutes (the API answers
 * 400 ADJUSTED_MINUTES_UNCHANGED). Limits come from the contract. The messages are keys of `adjust.errors`.
 */
export function adjustEntryFormSchema(declaredMinutes: number) {
  return z.object({
    newValue: z
      .string()
      .trim()
      .min(1, "newValueRequired")
      .transform((value, ctx) => {
        const minutes = parseHoursInput(value);
        if (minutes === null) {
          ctx.addIssue({ code: "custom", message: "newValueFormat" });
          return z.NEVER;
        }
        return minutes;
      })
      .pipe(
        z
          .number()
          .min(1, "newValueRange")
          .max(adjustHourEntryBodyValidatedMinutesMax, "newValueRange")
          .refine((minutes) => minutes !== declaredMinutes, "unchanged"),
      ),
    justification: z
      .string()
      .trim()
      .min(1, "justificationRequired")
      .max(adjustHourEntryBodyJustificationMax, "tooLong"),
  });
}

export type AdjustEntryFormInput = z.input<ReturnType<typeof adjustEntryFormSchema>>;
export type AdjustEntryFormValues = z.output<ReturnType<typeof adjustEntryFormSchema>>;

/** The body of `PATCH /hour-entries/:id/adjust`: the minutes and the trimmed justification. */
export function toAdjustBody(values: AdjustEntryFormValues): AdjustHourEntryDto {
  return { validatedMinutes: values.newValue, justification: values.justification };
}
