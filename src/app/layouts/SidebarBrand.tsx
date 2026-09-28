import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import logoCursor from "../../assets/brand/logo-cursor.svg";

/**
 * Marca do topo da sidebar como no Figma: "TEDI" com o "E" num retângulo tracejado e um
 * cursor. TODO: trocar pelo SVG do logo quando o designer entregar.
 */
export function SidebarBrand() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-1.5 pb-2 pl-2">
      <Link
        to="/"
        aria-label={t("layout.home")}
        className="relative block h-15 w-17 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-foreground"
      >
        <span
          aria-hidden="true"
          className="absolute top-1.5 left-0 text-[28px] leading-none font-bold tracking-wide text-black"
        >
          {t("app.name")}
        </span>
        <span
          aria-hidden="true"
          className="absolute top-px left-[15px] h-10 w-5 border-[1.5px] border-dashed border-black"
        />
        <img
          src={logoCursor}
          alt=""
          aria-hidden="true"
          className="absolute top-[37px] left-[32px] h-5 w-3"
        />
      </Link>
      <p className="text-sm font-medium text-tedi-brand-muted">{t("app.tagline")}</p>
    </div>
  );
}
