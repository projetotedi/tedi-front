import * as zod from "zod";

import { LoginBody, loginBodyPasswordMin } from "@api/generated/zod/auth/auth";

/** O DTO gerado aceita RA vazio e traz mensagens em inglês: aqui o RA é obrigatório e as mensagens são chaves de i18n. */
export const loginFormSchema = LoginBody.extend({
  ra: zod.string().min(1, { message: "login.validation.raRequired" }),
  password: zod.string().min(loginBodyPasswordMin, { message: "login.validation.passwordMin" }),
});

export type LoginFormValues = zod.infer<typeof loginFormSchema>;
