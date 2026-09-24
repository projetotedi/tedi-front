import { Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useDocumentTitle } from "@shared/hooks/useDocumentTitle";
import { Alert } from "@shared/ui";

import { LoginForm } from "../components/LoginForm";
import { LoginFormSkeleton } from "../components/LoginFormSkeleton";
import { PublicScreen } from "../components/PublicScreen";
import { useAuth } from "../hooks/useAuth";
import { readReturnTo } from "../lib/return-to";

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
    <PublicScreen cardWidthClassName="max-w-110">
      {/* O design não mostra título: fica só para leitores de tela e para o título da página. */}
      <h1 className="sr-only">{t("login.title")}</h1>
      {reason === "expired" && <Alert variant="error">{t("session.expired")}</Alert>}
      {status === "loading" ? <LoginFormSkeleton /> : <LoginForm />}
    </PublicScreen>
  );
}
