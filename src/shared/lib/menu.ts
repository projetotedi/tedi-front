import { type Role, roleSatisfies } from "./role";

/**
 * Item do menu lateral. Cada módulo exporta os seus (`<modulo>MenuItems`) e o app os
 * concatena em `src/app/menu.ts`.
 */
export interface MenuItem {
  /** Chave de i18n com namespace (ex.: "auth:access.title"). */
  label: string;
  /** Caminho absoluto de uma rota declarada no `routes.tsx` do módulo. */
  path: string;
  /** Perfil mínimo para ver o item; deve bater com o `RequireRole` da rota. */
  minRole: Role;
  /** URL de um SVG decorativo de 24px (import de arquivo `.svg`). */
  icon: string;
}

/** Itens que o perfil atende, na ordem original. Sem perfil (sem sessão), nenhum. */
export function filterMenuByRole(
  items: readonly MenuItem[],
  role: Role | null | undefined,
): MenuItem[] {
  return items.filter((item) => roleSatisfies(role, item.minRole));
}
