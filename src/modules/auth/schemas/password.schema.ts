import * as zod from "zod";

import {
  AcceptInviteBody,
  acceptInviteBodyNameMax,
  acceptInviteBodyPasswordMin,
} from "@api/generated/zod/auth/auth";

/**
 * Senha e confirmação, comuns ao passo 2 do aceite de acesso e à redefinição. O mínimo vem do
 * contrato (`acceptInviteBodyPasswordMin`, decisão 30: só o tamanho, sem regra de composição) e a
 * confirmação só existe no formulário: nunca vai para a API.
 */
const passwordFields = {
  password: zod
    .string()
    .min(acceptInviteBodyPasswordMin, { message: "invite.validation.passwordMin" }),
  passwordConfirmation: zod.string(),
};

/** Erro na confirmação (e não na senha): é o campo que a pessoa precisa redigitar. */
function passwordsMatch(values: { password: string; passwordConfirmation: string }): boolean {
  return values.password === values.passwordConfirmation;
}
const passwordMismatch = {
  message: "invite.validation.passwordMismatch",
  path: ["passwordConfirmation"],
};

/**
 * Formulário da redefinição de senha (`type=password_reset`): só senha e confirmação. As mensagens
 * são chaves de i18n do namespace `auth`, traduzidas no componente.
 */
export const newPasswordFormSchema = zod
  .object(passwordFields)
  .refine(passwordsMatch, passwordMismatch);

export type NewPasswordFormValues = zod.infer<typeof newPasswordFormSchema>;

/**
 * Formulário do aceite de acesso (`type=access`). Parte do `AcceptInviteBody` gerado, sem o `token`
 * (vem da URL) e acrescenta o que o DTO não diz: no DTO `name`, `ra` e `email` são opcionais e o back
 * não os exige no aceite de acesso, então esta validação é a única barreira contra uma Pessoa
 * criada sem nome, RA ou e-mail.
 *
 * `.trim()` nos três campos: o valor validado (e enviado) já vai sem espaços nas pontas, comuns ao
 * colar no celular. O e-mail vazio e o malformado compartilham a mensagem "e-mail válido".
 */
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
  })
  // Por último, para comparar a senha e a confirmação já validadas como campos.
  .refine(passwordsMatch, passwordMismatch);

export type AcceptInviteFormValues = zod.infer<typeof acceptInviteFormSchema>;
