import * as zod from "zod";

import { LoginBody, loginBodyPasswordMin } from "@api/generated/zod/auth/auth";

/**
 * Schema do formulário de login. Parte do `LoginBody` gerado (o mesmo contrato do back) e só
 * acrescenta o que o DTO não diz: o RA não pode ficar vazio (o DTO aceita `""`) e as mensagens
 * viram chaves de i18n do namespace `auth` (o zod traria textos em inglês). O mínimo da senha
 * continua vindo do contrato (`loginBodyPasswordMin`).
 */
export const loginFormSchema = LoginBody.extend({
  ra: zod.string().min(1, { message: "login.validation.raRequired" }),
  password: zod.string().min(loginBodyPasswordMin, { message: "login.validation.passwordMin" }),
});

/** Mesmo formato de `LoginDto`: vai direto para `useLogin().mutate({ data })`. */
export type LoginFormValues = zod.infer<typeof loginFormSchema>;
