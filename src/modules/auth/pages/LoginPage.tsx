import { Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useDocumentTitle } from "@shared/hooks/useDocumentTitle";
import { Alert } from "@shared/ui";

import { LoginForm } from "../components/LoginForm";
import { useAuth } from "../hooks/useAuth";
import { readReturnTo } from "../lib/return-to";

/**
 * Tela de login: cartão com o formulário de RA e senha, mensagem de sessão expirada e
 * redirecionamento para o `returnTo` (ou `/`) assim que a sessão fica válida.
 */
export function LoginPage() {
  const { status } = useAuth();
  const { t } = useTranslation("auth");
  const location = useLocation();

  useDocumentTitle(t("login.title"));

  if (status === "authenticated") {
    return <Navigate to={readReturnTo(location.search)} replace />;
  }

  const reason = new URLSearchParams(location.search).get("reason");

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="flex w-full max-w-110 flex-col gap-5 rounded-3xl bg-surface p-8 shadow-surface">
        {/* GUS-84: aguardando o SVG do logo com o designer; wordmark provisório em texto. */}
        <p className="text-center text-5xl font-black tracking-tight">{t("login.brand")}</p>
        {/* O design não mostra título: fica só para leitores de tela e para o título da página. */}
        <h1 className="sr-only">{t("login.title")}</h1>
        {reason === "expired" && <Alert variant="error">{t("session.expired")}</Alert>}
        <LoginForm />
      </div>
      <p className="text-center text-sm">{t("login.footer")}</p>
    </div>
  );
}
