import { z } from "zod";

import type { RejectHourEntryDto } from "@api/generated/model";
import { rejectHourEntryBodyReasonMax } from "@api/generated/zod/hours/hours";

/**
 * The form of Rejeitar lançamento. It differs from the generated DTO because it trims the reason
 * before counting (the API refuses a reason of spaces only) and its messages are keys of
 * `reject.errors`. The limit comes from the contract.
 */
export const rejectEntryFormSchema = z.object({
  reason: z.string().trim().min(1, "reasonRequired").max(rejectHourEntryBodyReasonMax, "tooLong"),
});

export type RejectEntryFormInput = z.input<typeof rejectEntryFormSchema>;
export type RejectEntryFormValues = z.output<typeof rejectEntryFormSchema>;

/** The body of `PATCH /hour-entries/:id/reject`: the trimmed reason. */
export function toRejectBody(values: RejectEntryFormValues): RejectHourEntryDto {
  return { reason: values.reason };
}
