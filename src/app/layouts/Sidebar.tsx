import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

import {
  findActiveMenuItem,
  groupMenuItems,
  isMenuGroupId,
  type MenuGroup,
  type MenuItem,
} from "@shared/lib/menu";
import { Accordion, NavList } from "@shared/ui";

import { SidebarBrand } from "./SidebarBrand";
import { useExpandedMenuGroups } from "./useExpandedMenuGroups";

/**
 * Trilho do Figma que liga os itens de um grupo aberto: barra vertical de 3px à esquerda e um
 * conector de 9px por item, só decoração. Com itens de 44px e 6px de respiro em cima (4px de
 * folga da linha do grupo e 2px do Figma), a barra começa 14px acima do centro do primeiro item
 * e termina na base do conector do último (a 23px da base da lista), fechando em "L".
 */
const TRAIL_CLASSES = [
  "relative gap-1 pt-1.5 pr-1.5 pb-0.5 pl-6",
  "before:absolute before:top-3.5 before:bottom-[23px] before:left-2.5 before:w-[3px] before:bg-tedi-sidebar-accent",
  "[&>li]:relative [&>li]:before:absolute [&>li]:before:top-1/2 [&>li]:before:-left-[11px]",
  "[&>li]:before:h-0.5 [&>li]:before:w-[9px] [&>li]:before:-translate-y-1/2 [&>li]:before:bg-tedi-sidebar-accent",
].join(" ");

export interface SidebarProps {
  /** Id do `<nav>`: a sidebar fixa e a do Drawer existem ao mesmo tempo e precisam de ids distintos. */
  navId: string;
  /** Itens que o perfil pode ver (já filtrados por permissão). */
  items: readonly MenuItem[];
  /** Domínios na ordem de exibição; um grupo sem item para o perfil não aparece. */
  groups: readonly MenuGroup[];
  /** Chamado ao escolher um item (ex.: fechar o Drawer). */
  onNavigate?: () => void;
}

/**
 * Marca e menu da sidebar (a fixa e a do Drawer): um `Accordion` com um grupo por domínio, e os
 * itens dele numa `NavList` sem landmark própria, dentro do único `<nav>`. O grupo da rota atual
 * já vem aberto e o item dela, marcado (`aria-current="page"`); o que a pessoa abre à mão fica
 * na sessão (`useExpandedMenuGroups`). Não conhece módulos: itens e grupos chegam por props.
 */
export function Sidebar({ navId, items, groups, onNavigate }: SidebarProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const activeItem = findActiveMenuItem(items, pathname);
  const { expandedGroups, setExpandedGroups } = useExpandedMenuGroups(activeItem);
  const sections = groupMenuItems(items, groups);

  return (
    <div className="relative flex flex-col gap-4">
      <SidebarBrand />
      <nav id={navId} aria-label={t("layout.nav")}>
        {sections.length === 0 ? (
          <p className="px-3 py-2">{t("layout.menu.empty")}</p>
        ) : (
          <Accordion
            items={sections.map((section) => ({
              id: section.group.id,
              title: t(section.group.label),
              icon: section.group.icon,
              content: (
                <NavList
                  items={section.items.map((item) => ({ label: t(item.label), path: item.path }))}
                  activePath={activeItem?.path ?? null}
                  onNavigate={onNavigate}
                  className={TRAIL_CLASSES}
                />
              ),
            }))}
            expandedKeys={expandedGroups}
            onExpandedChange={(keys) => setExpandedGroups(keys.filter(isMenuGroupId))}
          />
        )}
      </nav>
    </div>
  );
}
