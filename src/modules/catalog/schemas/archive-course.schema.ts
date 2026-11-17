import { z } from "zod";

import type { ArchiveDto } from "@api/generated/model";
import { archiveCourseBodyReasonMax } from "@api/generated/zod/catalog/catalog";

export const ARCHIVE_COURSE_LIMITS = { reasonMax: archiveCourseBodyReasonMax } as const;

/** The form of Arquivar curso: only the reason, optional, up to the limit of the contract. */
export const archiveCourseFormSchema = z.object({
  reason: z.string().trim().max(ARCHIVE_COURSE_LIMITS.reasonMax, "reasonTooLong"),
});

export type ArchiveCourseFormValues = z.infer<typeof archiveCourseFormSchema>;

/** The body of `archiveCourse`: the reason only when it was filled in, else no body at all. */
export function toArchiveCourseBody(values: ArchiveCourseFormValues): ArchiveDto | undefined {
  const reason = values.reason.trim();
  return reason ? { reason } : undefined;
}
