import * as zod from "zod";

import { acceptInviteBodyPasswordMin } from "@api/generated/zod/auth/auth";

/**
 * Senha e confirmação: a parte que o link de redefinição (`NewPasswordForm`) e o cadastro por
 * convite (etapa 3, em `accept-invite-form.schema.ts`) têm em comum.
 */
export const passwordFields = {
  password: zod
    .string()
    .min(acceptInviteBodyPasswordMin, { message: "invite.validation.passwordMin" }),
  passwordConfirmation: zod.string(),
};

export function passwordsMatch(values: {
  password: string;
  passwordConfirmation: string;
}): boolean {
  return values.password === values.passwordConfirmation;
}

export const passwordMismatch = {
  message: "invite.validation.passwordMismatch",
  path: ["passwordConfirmation"],
};

export const newPasswordFormSchema = zod
  .object(passwordFields)
  .refine(passwordsMatch, passwordMismatch);

export type NewPasswordFormValues = zod.infer<typeof newPasswordFormSchema>;
