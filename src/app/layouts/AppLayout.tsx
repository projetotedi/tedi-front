import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useMatches } from "react-router-dom";

import { useDocumentTitle } from "@shared/hooks/useDocumentTitle";
import { findRouteTitle } from "@shared/lib/route-handle";
import { Button, Drawer, NavList } from "@shared/ui";

import texture1 from "../../assets/sidebar-texture/texture-1.svg";
import texture2 from "../../assets/sidebar-texture/texture-2.svg";
import texture3 from "../../assets/sidebar-texture/texture-3.svg";
import texture4 from "../../assets/sidebar-texture/texture-4.svg";
import { useAppMenu } from "../useAppMenu";
import { ProfileMenu } from "./ProfileMenu";
import { SidebarBrand } from "./SidebarBrand";

const MOBILE_MENU_ID = "app-menu";

/** Camadas da textura de ondas do Figma (posição e tamanho do componente "Sidebar TEDI"). */
const TEXTURE_LAYERS = [
  { src: texture1, className: "top-[-30px] left-[-135px] w-[752px]" },
  { src: texture2, className: "top-[-85px] left-[-157px] w-[743px]" },
  { src: texture3, className: "top-[-99px] left-[-137px] w-[727px]" },
  { src: texture4, className: "top-[-62px] left-[-151px] w-[749px]" },
];

function SidebarTexture() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {TEXTURE_LAYERS.map((layer) => (
        <img
          key={layer.src}
          src={layer.src}
          alt=""
          className={`absolute max-w-none ${layer.className}`}
        />
      ))}
    </div>
  );
}

/**
 * Casca da área autenticada (Figma "Telas · Conta"): sidebar azul com a marca e o menu
 * filtrado pelo perfil; topbar com o título da página (`handle.title` da rota) e o menu
 * do perfil. Abaixo de 1024px a sidebar vira um Drawer aberto pelo botão de menu.
 */
export function AppLayout() {
  const { t } = useTranslation();
  const matches = useMatches();
  const menu = useAppMenu();
  const [isMenuOpen, setMenuOpen] = useState(false);

  const titleKey = findRouteTitle(matches);
  const title = titleKey ? t(titleKey) : t("app.name");
  useDocumentTitle(titleKey ? `${title} · ${t("app.name")}` : t("app.name"));

  const navItems = menu.map((item) => ({ label: t(item.label), path: item.path, icon: item.icon }));
  const nav = (id: string, onNavigate?: () => void) => (
    <NavList
      id={id}
      items={navItems}
      label={t("layout.nav")}
      emptyLabel={t("layout.menu.empty")}
      onNavigate={onNavigate}
    />
  );

  return (
    <div className="min-h-screen bg-background text-base text-foreground lg:flex">
      <aside className="relative hidden w-70 shrink-0 flex-col gap-4 overflow-hidden border-r border-tedi-sky-border bg-tedi-sky px-4 pt-7 pb-6 lg:flex">
        <SidebarTexture />
        <div className="relative flex flex-col gap-4">
          <SidebarBrand />
          {nav("app-sidebar-nav")}
        </div>
      </aside>

      <Drawer
        id={MOBILE_MENU_ID}
        isOpen={isMenuOpen}
        onOpenChange={setMenuOpen}
        title={t("layout.nav")}
        closeLabel={t("layout.menu.close")}
        className="bg-tedi-sky"
      >
        <div className="flex flex-col gap-4">
          <SidebarBrand />
          {nav("app-drawer-nav", () => setMenuOpen(false))}
        </div>
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-19 items-center justify-between gap-4 border-b border-border bg-surface px-4 lg:px-10">
          <div className="flex items-center gap-2">
            <Button
              isIconOnly
              variant="ghost"
              className="lg:hidden"
              aria-label={t("layout.menu.open")}
              aria-controls={MOBILE_MENU_ID}
              aria-expanded={isMenuOpen}
              onPress={() => setMenuOpen(true)}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            </Button>
            <h1 className="text-xl font-semibold">{title}</h1>
          </div>
          <ProfileMenu />
        </header>
        <main className="flex-1 px-4 py-6 lg:px-10 lg:py-8">
          <div className="mx-auto w-full max-w-360">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
