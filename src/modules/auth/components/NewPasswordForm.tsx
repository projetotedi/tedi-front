import { useEffect, useId, type FormEvent, type ReactElement } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Alert, Button } from "@shared/ui";

import { useInviteAcceptance } from "../hooks/useInviteAcceptance";
import { newPasswordFormSchema, type NewPasswordFormValues } from "../schemas/password.schema";
import { PasswordFields } from "./PasswordFields";

export interface NewPasswordFormProps {
  /** Token da URL. Só vai para o corpo do envio: nunca para log, estado global ou armazenamento. */
  token: string;
  /** Senha trocada. */
  onDone: () => void;
  /** O back respondeu `INVALID_INVITE`: o link foi usado, expirou ou foi revogado no meio do caminho. */
  onInvalidInvite: () => void;
}

/**
 * Redefinição de senha pelo link (`type=password_reset`): senha e confirmação, sem etapas, sem
 * etiqueta de perfil e sem o nome da pessoa (o `GET` do convite não o devolve). Não há tela
 * desenhada: usa o layout do passo 2 do cadastro e os mesmos campos (`PasswordFields`).
 *
 * O envio leva só o token e a senha. Nunca nome, RA nem e-mail: o back valida `email` com
 * `@IsEmail()` sempre que ele vem, e um `""` viraria 400.
 */
export function NewPasswordForm({
  token,
  onDone,
  onInvalidInvite,
}: NewPasswordFormProps): ReactElement {
  const { t } = useTranslation("auth");
  const errorId = useId();

  const form = useForm<NewPasswordFormValues>({
    resolver: zodResolver(newPasswordFormSchema),
    mode: "onSubmit",
    defaultValues: { password: "", passwordConfirmation: "" },
  });
  const { handleSubmit, setFocus } = form;

  const { submit, isBusy, showSlowNotice, errorKey } = useInviteAcceptance({
    onAccepted: onDone,
    onInvalidInvite,
  });
  // Neste ramo o back não toca em Pessoa por RA nem por e-mail: um 409 não tem para onde apontar e
  // cai no aviso genérico, como qualquer erro que não seja de conexão.
  const generalErrorKey =
    errorKey === null || errorKey === "invalidInvite"
      ? null
      : errorKey === "network"
        ? "network"
        : "unknown";

  // Os campos foram travados durante o envio, o que tira o foco de quem apertou Enter num deles.
  useEffect(() => {
    if (generalErrorKey) setFocus("password");
  }, [generalErrorKey, setFocus]);

  function submitNewPassword(values: NewPasswordFormValues) {
    // Só token e senha, campo a campo: a confirmação não vai para a rede.
    submit({ token, password: values.password });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    void handleSubmit(submitNewPassword)(event);
  }

  return (
    <FormProvider {...form}>
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold text-foreground">{t("resetPassword.title")}</h1>
        <p className="max-w-130 text-base text-muted">{t("resetPassword.subtitle")}</p>
      </header>
      <div aria-hidden="true" className="h-px bg-separator" />

      <form onSubmit={onSubmit} noValidate aria-busy={isBusy} className="flex flex-col gap-5">
        <PasswordFields isDisabled={isBusy} describedBy={generalErrorKey ? errorId : undefined} />

        {/* Região viva do aviso de conexão lenta: o Alert info fica sempre montado (vazio) e só o
            texto entra e sai. Não trocar por renderização condicional do Alert: leitores de tela
            não anunciam uma região que nasce já preenchida. */}
        <Alert variant="info">{showSlowNotice ? t("invite.slowNotice") : null}</Alert>
        <Alert variant="error" id={errorId}>
          {generalErrorKey ? t(`resetPassword.errors.${generalErrorKey}`) : null}
        </Alert>

        <div className="flex justify-end">
          <Button type="submit" isLoading={isBusy}>
            {isBusy ? t("invite.actions.submitting") : t("resetPassword.submit")}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
