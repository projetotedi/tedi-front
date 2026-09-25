import { roleSatisfies, type Role } from "./role";

/**
 * Um item do menu lateral, declarado por cada módulo (ex.: `authNavItems`) e filtrado pelo
 * perfil no layout autenticado. Sem conhecimento de domínio: o rótulo é uma chave de i18n.
 */
export interface NavItem {
  /** Rota de destino. */
  to: string;
  /** Namespace de i18n do rótulo (o do módulo dono do item). */
  labelNs: string;
  /** Chave de i18n do rótulo dentro de `labelNs`. */
  labelKey: string;
  /** URL do ícone (SVG importado como asset). */
  iconSrc: string;
  /** Perfil mínimo para ver o item. Omitido = todo usuário autenticado vê. */
  minRole?: Role;
}

/** Os itens que `role` pode ver. Sem `minRole` o item sempre aparece; `null` nunca satisfaz um `minRole`. */
export function visibleNavItems(items: NavItem[], role: Role | null): NavItem[] {
  return items.filter((item) => item.minRole === undefined || roleSatisfies(role, item.minRole));
}
