import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";

import { authNavItems, useAuth } from "@modules/auth";
import { visibleNavItems } from "@shared/lib/navigation";

import textureOneUrl from "./assets/sidebar-texture-1.svg";
import textureTwoUrl from "./assets/sidebar-texture-2.svg";
import textureThreeUrl from "./assets/sidebar-texture-3.svg";
import textureFourUrl from "./assets/sidebar-texture-4.svg";

// Ondas de fundo do Figma (frames 63:2947 a 63:2950): o SVG de cada uma vem do arquivo, sem
// edição, com o tamanho do SVG. As quatro se sobrepõem e cobrem a altura da sidebar, cada uma com
// o próprio deslocamento; as posições foram ajustadas contra o print do frame 63:3122 (correlação
// das ondas do print com cada SVG, com resolução de cerca de 2px).
const TEXTURES = [
  { src: textureOneUrl, width: 769.8, height: 1012.4, position: "-left-[145px] -top-[37px]" },
  { src: textureTwoUrl, width: 755.2, height: 1079.3, position: "-left-[164px] -top-[89px]" },
  { src: textureThreeUrl, width: 734.2, height: 1120.6, position: "-left-[139px] -top-[102px]" },
  { src: textureFourUrl, width: 753.1, height: 1078.8, position: "-left-[150px] -top-[64px]" },
] as const;

/**
 * Menu lateral: marca "TEDI" e os itens de navegação que os módulos declaram, filtrados pelo
 * perfil de quem está logado. Hoje só o item de Membros (do `auth`), para coordenação; o menu
 * completo por perfil é da GUS-86. Abaixo de `lg` empilha no topo da página.
 */
export function AppSidebar() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const items = visibleNavItems(authNavItems, user?.role ?? null);

  return (
    <aside className="relative w-full shrink-0 overflow-clip border-b border-tedi-sidebar-border bg-tedi-sky px-4 pt-7 pb-6 lg:sticky lg:top-0 lg:h-screen lg:w-70 lg:border-r lg:border-b-0">
      {TEXTURES.map((texture) => (
        <img
          key={texture.src}
          src={texture.src}
          alt=""
          aria-hidden="true"
          width={texture.width}
          height={texture.height}
          className={`pointer-events-none absolute max-w-none ${texture.position}`}
        />
      ))}

      {/* Recuo de 8px e a legenda 22px abaixo do "TEDI": medidas do frame (a marca ocupa ~87px). */}
      <div className="relative px-2">
        <p className="text-[28px] font-bold tracking-[0.56px] text-black">{t("app.name")}</p>
        <p className="mt-5.5 text-xs font-medium text-tedi-sidebar-muted">{t("app.tagline")}</p>
      </div>

      {items.length > 0 ? (
        <nav aria-label={t("layout.mainNav")} className="relative mt-8">
          <ul className="flex flex-col gap-1">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2 text-base font-medium text-foreground outline-offset-4 focus-visible:outline-2 focus-visible:outline-focus aria-[current=page]:bg-white aria-[current=page]:shadow-tedi-nav"
                >
                  <img src={item.iconSrc} alt="" aria-hidden="true" width={24} height={24} />
                  {t(item.labelKey, { ns: item.labelNs })}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </aside>
  );
}
