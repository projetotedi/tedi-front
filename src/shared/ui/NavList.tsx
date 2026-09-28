import { NavLink } from "react-router-dom";

export interface NavListItem {
  /** Texto já traduzido. */
  label: string;
  path: string;
  /** URL de um SVG decorativo de 24px. */
  icon?: string;
}

export interface NavListProps {
  items: NavListItem[];
  /** Nome acessível do `<nav>`. */
  label: string;
  /** Mensagem quando não há itens. */
  emptyLabel: string;
  id?: string;
  /** Chamado ao escolher um item (ex.: fechar o menu recolhível). */
  onNavigate?: () => void;
}

/**
 * Navegação vertical da sidebar. Usa o `NavLink` do react-router (item ativo com
 * `aria-current="page"`) em vez de um componente do HeroUI, que não tem navegação lateral.
 * O Figma desenha os itens com ~40px e texto de 14px; aqui ficam 44px e 16px (AGENTS.md).
 */
export function NavList({ items, label, emptyLabel, id, onNavigate }: NavListProps) {
  return (
    <nav id={id} aria-label={label}>
      {items.length === 0 ? (
        <p className="px-3 py-2">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                onClick={onNavigate}
                className={({ isActive }) =>
                  [
                    "flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2 text-base font-medium text-foreground",
                    "outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2",
                    isActive ? "bg-surface shadow-surface" : "hover:bg-white/50",
                  ].join(" ")
                }
              >
                {item.icon && <img src={item.icon} alt="" aria-hidden="true" className="size-6" />}
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
