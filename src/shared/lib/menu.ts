import { can, type Permission, type PermissionSubject } from "./permissions";

/**
 * Item do menu lateral. Cada módulo exporta os seus (`<modulo>MenuItems`) e o app os
 * concatena em `src/app/menu.ts`.
 */
export interface MenuItem {
  /** Chave de i18n com namespace (ex.: "auth:access.title"). */
  label: string;
  /** Caminho absoluto de uma rota declarada no `routes.tsx` do módulo. */
  path: string;
  /** Permissão para ver o item; deve bater com o `RequirePermission` da rota. */
  permission: Permission;
  /** URL de um SVG decorativo de 24px (import de arquivo `.svg`). */
  icon: string;
}

/** Itens que o usuário pode ver, na ordem original. Sem sessão, nenhum. */
export function filterMenuByPermission(
  items: readonly MenuItem[],
  user: PermissionSubject | null | undefined,
): MenuItem[] {
  return items.filter((item) => can(user, item.permission));
}
