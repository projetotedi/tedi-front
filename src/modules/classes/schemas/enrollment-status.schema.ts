import { z } from "zod";

import { EnrollmentStatus, type UpdateEnrollmentStatusDto } from "@api/generated/model";
import { updateEnrollmentStatusBodyReasonMax } from "@api/generated/zod/classes/classes";

export const ENROLLMENT_STATUS_LIMITS = { reasonMax: updateEnrollmentStatusBodyReasonMax } as const;

const STATUSES = Object.values(EnrollmentStatus) as [EnrollmentStatus, ...EnrollmentStatus[]];

/**
 * The form of Alterar situação da matrícula: the new status and the day it holds from are
 * required; the reason is optional, up to the limit of the contract. The API checks the day
 * against the enrollment and today (400 with the field). The form starts with no status chosen
 * (`""`), which the schema refuses.
 */
export const enrollmentStatusFormSchema = z.object({
  status: z.string().refine((value) => (STATUSES as string[]).includes(value), {
    message: "required",
  }),
  effectiveDate: z.string().min(1, "required"),
  reason: z.string().trim().max(ENROLLMENT_STATUS_LIMITS.reasonMax, "reasonTooLong"),
});

export type EnrollmentStatusFormValues = z.infer<typeof enrollmentStatusFormSchema>;

/** The body of `updateEnrollmentStatus`: the reason only when it was filled in. */
export function toEnrollmentStatusBody(
  values: EnrollmentStatusFormValues,
): UpdateEnrollmentStatusDto {
  const reason = values.reason.trim();
  return {
    status: values.status as EnrollmentStatus,
    effectiveDate: values.effectiveDate,
    ...(reason ? { reason } : {}),
  };
}
