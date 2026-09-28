import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import logoTediUrl from "../../assets/brand/logo-tedi.svg";

/** Marca do topo da sidebar: logo do TEDI (Figma). */
export function SidebarBrand() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-1.5 pb-2 pl-2">
      <Link
        to="/"
        aria-label={t("layout.home")}
        className="relative block h-15 w-17 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-foreground"
      >
        <img src={logoTediUrl} alt={t("app.name")} width={66} height={60} />
      </Link>
      <p className="text-sm font-medium text-tedi-brand-muted">{t("app.tagline")}</p>
    </div>
  );
}
