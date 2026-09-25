import { useTranslation } from "react-i18next";

/** Placeholder da tela de Acessos (GUS-87/88). O título vem da topbar, pelo `handle` da rota. */
export function AccessPage() {
  const { t } = useTranslation("auth");

  return <p>{t("access.comingSoon")}</p>;
}
