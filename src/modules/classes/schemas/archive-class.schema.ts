import { z } from "zod";

import type { ArchiveDto } from "@api/generated/model";
import { archiveClassBodyReasonMax } from "@api/generated/zod/classes/classes";

export const ARCHIVE_CLASS_LIMITS = { reasonMax: archiveClassBodyReasonMax } as const;

/** The form of Arquivar turma: only the reason, optional, up to the limit of the contract. */
export const archiveClassFormSchema = z.object({
  reason: z.string().trim().max(ARCHIVE_CLASS_LIMITS.reasonMax, "reasonTooLong"),
});

export type ArchiveClassFormValues = z.infer<typeof archiveClassFormSchema>;

/** The body of `archiveClass`: the reason only when it was filled in, else no body at all. */
export function toArchiveClassBody(values: ArchiveClassFormValues): ArchiveDto | undefined {
  const reason = values.reason.trim();
  return reason ? { reason } : undefined;
}
