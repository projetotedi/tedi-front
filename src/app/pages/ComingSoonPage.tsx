import { useTranslation } from "react-i18next";

/** Destino dos itens do protótipo cujo módulo ainda não existe. O título vem da topbar. */
export function ComingSoonPage() {
  const { t } = useTranslation();

  return <p>{t("comingSoon.description")}</p>;
}
