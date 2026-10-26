import { Link, useLocation } from "react-router-dom";

import { findActivePath } from "../lib/active-path";

export interface NavListItem {
  /** Texto já traduzido. */
  label: string;
  path: string;
  /** URL de um SVG decorativo de 24px. */
  icon?: string;
}

export interface NavListProps {
  items: NavListItem[];
  /** Nome acessível do `<nav>`. Sem ele, a lista sai sem landmark, para caber dentro de outro `<nav>`. */
  label?: string;
  /** Mensagem quando não há itens. Sem ela, uma lista vazia não desenha nada. */
  emptyLabel?: string;
  /** Caminho do item atual (`null`: nenhum). Sem ele, vale o item que casa com a rota. */
  activePath?: string | null;
  /** Fica no `<nav>`; sem `label`, na lista. */
  id?: string;
  /**
   * Classes da lista (`<ul>`), que já é uma coluna. Sem elas, os itens ficam a 6px um do
   * outro; quem passa as suas decide o espaçamento (duas classes `gap-*` brigariam).
   */
  className?: string;
  /** Chamado ao escolher um item (ex.: fechar o menu recolhível). */
  onNavigate?: () => void;
}

/**
 * Item de 44px de altura e 16px de fonte, como no Figma da sidebar unificada e no AGENTS.md. O
 * foco fica por dentro (`ring-inset`) porque o painel do `Accordion` corta o que passa da borda.
 */
const ITEM_CLASSES = [
  "flex min-h-11 items-center gap-2.5 rounded-[10px] border-2 py-2 pr-3 pl-3.5",
  "text-base text-foreground outline-hidden",
  "focus-visible:ring-3 focus-visible:ring-tedi-focus-ring focus-visible:ring-inset",
].join(" ");
const IDLE_CLASSES = "border-transparent font-medium hover:bg-white/40";
const CURRENT_CLASSES = "border-tedi-sidebar-accent bg-white font-semibold";

/**
 * Navegação vertical da sidebar. Só um item é o atual (`aria-current="page"`): o de caminho
 * mais longo que casa com a rota, ou o `activePath` quando quem usa já decidiu. Usa `Link`
 * em vez do `NavLink` do react-router, que marcaria `/lessons` e `/lessons/calendar` juntos e
 * não deixa desligar o `aria-current`.
 */
export function NavList({
  items,
  label,
  emptyLabel,
  activePath,
  id,
  className = "gap-1.5",
  onNavigate,
}: NavListProps) {
  const { pathname } = useLocation();

  if (items.length === 0 && !emptyLabel) return null;

  const currentPath =
    activePath === undefined
      ? findActivePath(
          items.map((item) => item.path),
          pathname,
        )
      : activePath;

  const content =
    items.length === 0 ? (
      <p className="px-3 py-2">{emptyLabel}</p>
    ) : (
      <ul id={label ? undefined : id} className={`flex flex-col ${className}`}>
        {items.map((item) => {
          const isCurrent = item.path === currentPath;

          return (
            <li key={item.path}>
              <Link
                to={item.path}
                onClick={onNavigate}
                aria-current={isCurrent ? "page" : undefined}
                className={`${ITEM_CLASSES} ${isCurrent ? CURRENT_CLASSES : IDLE_CLASSES}`}
              >
                {item.icon && <img src={item.icon} alt="" aria-hidden="true" className="size-6" />}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    );

  return label ? (
    <nav id={id} aria-label={label}>
      {content}
    </nav>
  ) : (
    content
  );
}
