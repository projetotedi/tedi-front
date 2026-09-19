import { Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { PageTitle } from "@shared/components/PageTitle";
import { useDocumentTitle } from "@shared/hooks/useDocumentTitle";

import { useAuth } from "../hooks/useAuth";
import { readReturnTo } from "../lib/return-to";

/**
 * Placeholder deliberado: título, mensagem de sessão expirada e o redirecionamento de
 * returnTo quando a sessão fica válida. O formulário de RA e senha é GUS-84.
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
    <div>
      <PageTitle>{t("login.title")}</PageTitle>
      {reason === "expired" && <p role="alert">{t("session.expired")}</p>}
      {/* GUS-84: formulário de RA e senha entra aqui */}
    </div>
  );
}
