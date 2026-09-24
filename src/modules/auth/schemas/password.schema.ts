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

// No DTO, `name`, `ra` e `email` são opcionais e o back não os exige: só este schema os obriga.
export const acceptInviteFormSchema = AcceptInviteBody.omit({ token: true })
  .extend({
    name: zod
      .string()
      .trim()
      .min(1, { message: "invite.validation.nameRequired" })
      .max(acceptInviteBodyNameMax, { message: "invite.validation.nameMax" }),
    ra: zod.string().trim().min(1, { message: "invite.validation.raRequired" }),
    email: zod
      .string()
      .trim()
      .pipe(zod.email({ message: "invite.validation.emailInvalid" })),
    ...passwordFields,
    // Só validação de tela: o DTO não tem esse campo, então nada é persistido ainda (fica para a
    // E9.b, que vai guardar o registro de consentimento).
    privacyConsent: zod
      .boolean()
      .refine((value) => value, { message: "invite.validation.privacyConsentRequired" }),
  })
  .refine(passwordsMatch, passwordMismatch);

export type AcceptInviteFormValues = zod.infer<typeof acceptInviteFormSchema>;
