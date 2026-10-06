import * as zod from "zod";

import {
  AcceptInviteBody,
  acceptInviteBodyNameMax,
  acceptInviteBodyPasswordMin,
} from "@api/generated/zod/auth/auth";

const passwordFields = {
  password: zod
    .string()
    .min(acceptInviteBodyPasswordMin, { message: "invite.validation.passwordMin" }),
  passwordConfirmation: zod.string(),
};

function passwordsMatch(values: { password: string; passwordConfirmation: string }): boolean {
  return values.password === values.passwordConfirmation;
}
const passwordMismatch = {
  message: "invite.validation.passwordMismatch",
  path: ["passwordConfirmation"],
};

export const newPasswordFormSchema = zod
  .object(passwordFields)
  .refine(passwordsMatch, passwordMismatch);

export type NewPasswordFormValues = zod.infer<typeof newPasswordFormSchema>;

export const academicStepSchema = zod.object({
  ra: zod.string().trim().min(1, { message: "invite.validation.raRequired" }),
  email: zod
    .string()
    .trim()
    .pipe(zod.email({ message: "invite.validation.emailInvalid" })),
});

export const personalStepSchema = zod.object({
  name: zod
    .string()
    .trim()
    .min(1, { message: "invite.validation.nameRequired" })
    .max(acceptInviteBodyNameMax, { message: "invite.validation.nameMax" }),
});

export type AcademicStepValues = zod.infer<typeof academicStepSchema>;
export type PersonalStepValues = zod.infer<typeof personalStepSchema>;

// Os campos de cada etapa vêm do schema dela: o `trigger` do formulário valida só estes.
export const STEP_ONE_FIELDS = [
  "ra",
  "email",
] as const satisfies readonly (keyof AcademicStepValues)[];
export const STEP_TWO_FIELDS = ["name"] as const satisfies readonly (keyof PersonalStepValues)[];

// No DTO, `name`, `ra` e `email` são opcionais e o back não os exige: só este schema os obriga.
export const acceptInviteFormSchema = AcceptInviteBody.omit({ token: true })
  .extend({
    ...academicStepSchema.shape,
    ...personalStepSchema.shape,
    ...passwordFields,
  })
  .refine(passwordsMatch, passwordMismatch);

export type AcceptInviteFormValues = zod.infer<typeof acceptInviteFormSchema>;
