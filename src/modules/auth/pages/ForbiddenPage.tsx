import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { PageTitle } from "@shared/components/PageTitle";
import { useDocumentTitle } from "@shared/hooks/useDocumentTitle";

/**
 * Renderizada no lugar pela RequireRole quando o perfil não atende o `minRole` da rota.
 * A sessão continua ativa e a URL não muda (decisão 18) — só um botão de volta.
 */
export function ForbiddenPage() {
  const { t } = useTranslation("auth");

  useDocumentTitle(t("forbidden.title"));

  return (
    <div>
      <PageTitle>{t("forbidden.title")}</PageTitle>
      <p>{t("forbidden.description")}</p>
      <Link to="/">{t("forbidden.backHome")}</Link>
    </div>
  );
}
