import { useEffect, useId, useRef, type FormEvent, type ReactElement } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { getMeQueryKey, useLogin } from "@api/generated";
import { Alert, Button, PasswordField, TextField } from "@shared/ui";

import { useSlowRequestNotice } from "../hooks/useSlowRequestNotice";
import { toLoginErrorKey } from "../lib/login-error";
import { loginFormSchema, type LoginFormValues } from "../schemas/login-form.schema";

/**
 * Formulário de RA e senha. Não navega: o `POST /auth/login` devolve o mesmo `MeResponseDto` de
 * `GET /auth/me`, então o sucesso só preenche o cache da sessão; o `AuthProvider` passa a
 * "authenticated" e o `LoginPage` redireciona para o `returnTo` (ou `/`).
 */
export function LoginForm(): ReactElement {
  const { t } = useTranslation("auth");
  const queryClient = useQueryClient();
  const errorId = useId();

  const { control, handleSubmit, setFocus } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { ra: "", password: "" },
    mode: "onSubmit",
  });

  const login = useLogin({
    mutation: {
      onSuccess: (user) => {
        queryClient.setQueryData(getMeQueryKey(), user);
      },
    },
  });

  // Depois de um sucesso a tela só está esperando o redirecionamento: continua travada.
  const isBusy = login.isPending || login.isSuccess;
  const showSlowNotice = useSlowRequestNotice(login.isPending);
  const errorKey = login.isError ? toLoginErrorKey(login.error) : null;

  // O foco volta ao RA depois do erro. Precisa ser aqui, e não no onError da mutação: o onError
  // roda antes de o React reabilitar os campos, e um input desabilitado não recebe foco.
  useEffect(() => {
    if (login.isError) setFocus("ra");
  }, [login.isError, setFocus]);

  // Trava síncrona contra envio duplo. `isPending` só chega ao componente no render seguinte e o
  // handleSubmit valida de forma assíncrona: dois envios seguidos (duplo clique, Enter repetido)
  // passam os dois pela validação antes disso. Verificar e marcar aqui não tem `await` no meio.
  const inFlightRef = useRef(false);

  function submitCredentials(values: LoginFormValues) {
    if (isBusy || inFlightRef.current) return;
    inFlightRef.current = true;
    login.mutate(
      { data: values },
      {
        onSettled: () => {
          inFlightRef.current = false;
        },
      },
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    void handleSubmit(submitCredentials)(event);
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={isBusy} className="flex flex-col gap-5">
      <Controller
        name="ra"
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            label={t("login.ra.label")}
            placeholder={t("login.ra.placeholder")}
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            inputRef={field.ref}
            autoComplete="username"
            isDisabled={isBusy}
            errorMessage={fieldState.error?.message ? t(fieldState.error.message) : undefined}
            aria-describedby={errorKey ? errorId : undefined}
          />
        )}
      />
      <Controller
        name="password"
        control={control}
        render={({ field, fieldState }) => (
          <PasswordField
            label={t("login.password.label")}
            placeholder={t("login.password.placeholder")}
            description={t("login.password.hint")}
            showLabel={t("login.password.show")}
            hideLabel={t("login.password.hide")}
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            inputRef={field.ref}
            autoComplete="current-password"
            isDisabled={isBusy}
            errorMessage={fieldState.error?.message ? t(fieldState.error.message) : undefined}
          />
        )}
      />

      {/* Texto puro, sem link e sem ação (a redefinição self-service é a GUS-88). Segue o Figma,
          por decisão do usuário, no lugar do "Fale com a coordenação" do card/decisão 15: azul do
          token de acento e alinhado à direita, mas sem sublinhado, cursor de link nem hover, para
          não parecer clicável. Não trocar por <a> ou <button>: não há para onde levar. */}
      <p className="text-right text-base text-accent">{t("login.forgotPassword")}</p>

      {/* Região viva do aviso de conexão lenta: o Alert info fica sempre montado (vazio) e só o
          texto entra e sai. Não trocar por renderização condicional do Alert: leitores de tela
          não anunciam uma região que nasce já preenchida. */}
      <Alert variant="info">{showSlowNotice ? t("login.slowNotice") : null}</Alert>
      <Alert variant="error" id={errorId}>
        {errorKey ? t(`login.errors.${errorKey}`) : null}
      </Alert>

      <Button type="submit" fullWidth isLoading={isBusy}>
        {isBusy ? t("login.submitting") : t("login.submit")}
      </Button>
    </form>
  );
}
