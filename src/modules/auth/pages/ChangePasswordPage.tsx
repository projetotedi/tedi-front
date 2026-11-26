import { useEffect, useId, useState, type FormEvent, type ReactElement } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { FormProvider, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { getMeQueryKey, useChangePassword } from "@api/generated";
import type { MeResponseDto } from "@api/generated/model";
import { useDocumentTitle } from "@shared/hooks/useDocumentTitle";
import { Alert, Button, toast } from "@shared/ui";

import { PasswordFields } from "../components/PasswordFields";
import { PublicScreen } from "../components/PublicScreen";
import { useAuth } from "../hooks/useAuth";
import { buildLoginPath } from "../lib/return-to";
import { newPasswordFormSchema, type NewPasswordFormValues } from "../schemas/password.schema";

const FORM_CARD_WIDTH = "max-w-200";
const PROFILE_PATH = "/profile";

type ChangePasswordError = "network" | "unknown";

interface ApiErrorShape {
  statusCode?: unknown;
  error?: unknown;
}

function readApiErrorShape(error: unknown): ApiErrorShape {
  return typeof error === "object" && error !== null ? (error as ApiErrorShape) : {};
}

function ChangePasswordForm({ user }: { user: MeResponseDto }): ReactElement {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const errorId = useId();
  const [submitError, setSubmitError] = useState<ChangePasswordError | null>(null);

  const form = useForm<NewPasswordFormValues>({
    resolver: zodResolver(newPasswordFormSchema),
    mode: "onSubmit",
    defaultValues: { password: "", passwordConfirmation: "" },
  });
  const { handleSubmit, setError, setFocus } = form;
  const changePassword = useChangePassword();
  const isBusy = changePassword.isPending;

  useEffect(() => {
    if (submitError) setFocus("password");
  }, [submitError, setFocus]);

  function finish() {
    queryClient.setQueryData<MeResponseDto>(getMeQueryKey(), (current) =>
      current ? { ...current, mustChangePassword: false } : current,
    );
    void queryClient.invalidateQueries({ queryKey: getMeQueryKey() });
    navigate(PROFILE_PATH, { replace: true });
  }

  function save(values: NewPasswordFormValues) {
    if (isBusy) return;
    setSubmitError(null);

    changePassword.mutate(
      { data: { newPassword: values.password } },
      {
        onSuccess: () => {
          toast.success(t("changePassword.success"));
          finish();
        },
        onError: (error) => {
          const { statusCode, error: code } = readApiErrorShape(error);
          if (statusCode === 400 && code === "PASSWORD_UNCHANGED") {
            setError("password", { type: "server", message: "changePassword.errors.unchanged" });
            setFocus("password");
            return;
          }
          if (statusCode === 409 && code === "PASSWORD_CHANGE_NOT_REQUIRED") {
            finish();
            return;
          }
          setSubmitError(error instanceof TypeError ? "network" : "unknown");
        },
      },
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    void handleSubmit(save)(event);
  }

  return (
    <FormProvider {...form}>
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold text-foreground">{t("changePassword.title")}</h1>
        <p className="max-w-130 text-base text-muted">{t("changePassword.subtitle")}</p>
      </header>
      <div aria-hidden="true" className="h-px bg-separator" />

      <form onSubmit={onSubmit} noValidate aria-busy={isBusy} className="flex flex-col gap-5">
        <p className="rounded-xl bg-tedi-summary px-4 py-3 text-base text-foreground">
          <span className="font-semibold">{user.name}</span>
          {t("changePassword.account")}
        </p>
        <PasswordFields
          variant="reset"
          isDisabled={isBusy}
          describedBy={submitError ? errorId : undefined}
        />

        <Alert variant="error" id={errorId}>
          {submitError ? t(`changePassword.errors.${submitError}`) : null}
        </Alert>

        <div className="flex justify-end">
          <Button type="submit" isLoading={isBusy}>
            {t("changePassword.submit")}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

/**
 * Troca obrigatória de senha no primeiro acesso (GUS-142, Figma "Trocar senha no primeiro
 * acesso"), no layout público. Só tem sentido com sessão: anônimo vai para o login (voltando para
 * cá) e quem não precisa trocar vai para Meu perfil. A troca manda só a nova senha
 * (`POST /auth/password`, GUS-93); a confirmação não vai para a rede. Depois de salvar, a sessão
 * deixa de pedir a troca e a pessoa cai em Meu perfil com um aviso de sucesso. Enquanto a troca
 * não acontece, `RequireRole` traz a pessoa de volta para esta tela de qualquer rota autenticada.
 */
export function ChangePasswordPage(): ReactElement {
  const { t } = useTranslation("auth");
  const { status, user } = useAuth();
  const location = useLocation();

  useDocumentTitle(t("changePassword.title"));

  if (status === "loading") return <p role="status">{t("session.loading")}</p>;
  if (status === "anonymous" || user === null) {
    return <Navigate to={buildLoginPath(location)} replace />;
  }
  if (!user.mustChangePassword) return <Navigate to={PROFILE_PATH} replace />;

  return (
    <PublicScreen cardWidthClassName={FORM_CARD_WIDTH}>
      <ChangePasswordForm user={user} />
    </PublicScreen>
  );
}
