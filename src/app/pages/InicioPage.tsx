import { useTranslation } from "react-i18next";

import { PageTitle } from "@shared/components/PageTitle";
import { useDocumentTitle } from "@shared/hooks/useDocumentTitle";

/**
 * Página inicial provisória. Quando o módulo auth existir, a rota index passa a
 * redirecionar para a tela principal do perfil do usuário e este arquivo sai.
 */
export function InicioPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("app.name"));

  return (
    <section>
      <PageTitle>{t("app.name")}</PageTitle>
    </section>
  );
}
