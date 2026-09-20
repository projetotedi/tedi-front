import type { ReactElement } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { PasswordField } from "@shared/ui";

import type { NewPasswordFormValues } from "../schemas/password.schema";

export interface PasswordFieldsProps {
  isDisabled: boolean;
  /** Liga ao primeiro campo um texto externo (o aviso de erro geral do formulário). */
  describedBy?: string;
}

/**
 * Senha e confirmação, lado a lado a partir do breakpoint `sm`. Serve ao passo 2 do aceite de
 * acesso e à redefinição de senha, que compartilham estes dois campos, os rótulos e as dicas.
 *
 * Lê o formulário pelo contexto (`FormProvider` de quem usa): os dois formulários têm outros
 * campos além destes e não dá para tipar um `control` que serve a ambos sem um cast. Só toca em
 * `password` e `passwordConfirmation`, que existem nos dois.
 */
export function PasswordFields({ isDisabled, describedBy }: PasswordFieldsProps): ReactElement {
  const { t } = useTranslation("auth");
  const { control } = useFormContext<NewPasswordFormValues>();

  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
      {/* `deps`: ao mudar a senha, revalida a confirmação, senão o erro "as senhas não são iguais"
          ficaria na tela depois de a senha ser corrigida. */}
      <Controller
        name="password"
        control={control}
        rules={{ deps: ["passwordConfirmation"] }}
        render={({ field, fieldState }) => (
          <PasswordField
            label={t("invite.fields.password.label")}
            description={t("invite.fields.password.hint")}
            showLabel={t("invite.fields.password.show")}
            hideLabel={t("invite.fields.password.hide")}
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            inputRef={field.ref}
            autoComplete="new-password"
            isRequired
            isDisabled={isDisabled}
            errorMessage={fieldState.error?.message ? t(fieldState.error.message) : undefined}
            aria-describedby={describedBy}
          />
        )}
      />
      <Controller
        name="passwordConfirmation"
        control={control}
        render={({ field, fieldState }) => (
          <PasswordField
            label={t("invite.fields.passwordConfirmation.label")}
            description={t("invite.fields.passwordConfirmation.hint")}
            showLabel={t("invite.fields.passwordConfirmation.show")}
            hideLabel={t("invite.fields.passwordConfirmation.hide")}
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            inputRef={field.ref}
            autoComplete="new-password"
            isRequired
            isDisabled={isDisabled}
            errorMessage={fieldState.error?.message ? t(fieldState.error.message) : undefined}
          />
        )}
      />
    </div>
  );
}
