import { findActivePath } from "./active-path";
import { can, type Permission, type PermissionSubject } from "./permissions";

/**
 * Domínios do menu lateral. É só o vocabulário: o rótulo, o ícone e a ordem de exibição ficam
 * em `src/app/menu.ts`. Vive aqui para o typecheck pegar um `group` digitado errado no
 * `<modulo>MenuItems`, já que um módulo não pode importar de `app/`.
 */
export const MENU_GROUP_IDS = ["catalog", "classes", "lessons", "people", "hours"] as const;
export type MenuGroupId = (typeof MENU_GROUP_IDS)[number];

export function isMenuGroupId(value: unknown): value is MenuGroupId {
  return MENU_GROUP_IDS.some((id) => id === value);
}

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
  /** Domínio do menu em que o item aparece. */
  group: MenuGroupId;
}

/** Domínio do menu lateral: um cabeçalho que abre e fecha os itens dele. */
export interface MenuGroup {
  id: MenuGroupId;
  /** Chave de i18n com namespace (ex.: "common:nav.groups.catalog"). */
  label: string;
  /** URL de um SVG decorativo de 24px (import de arquivo `.svg`). */
  icon: string;
}

/** Um domínio com os itens que ele tem para o usuário. */
export interface MenuSection {
  group: MenuGroup;
  items: MenuItem[];
}

/** Itens que o usuário pode ver, na ordem original. Sem sessão, nenhum. */
export function filterMenuByPermission(
  items: readonly MenuItem[],
  user: PermissionSubject | null | undefined,
): MenuItem[] {
  return items.filter((item) => can(user, item.permission));
}

/**
 * Agrupa os itens por domínio. A ordem dos grupos é a de `groups`; dentro de cada um vale a
 * ordem de `items`. Grupo sem item some (o perfil não vê nada nele) e item de um grupo que
 * não está em `groups` fica de fora.
 */
export function groupMenuItems(
  items: readonly MenuItem[],
  groups: readonly MenuGroup[],
): MenuSection[] {
  return groups
    .map((group) => ({ group, items: items.filter((item) => item.group === group.id) }))
    .filter((section) => section.items.length > 0);
}

/**
 * Item do menu que representa a rota atual: o de caminho mais longo que casa com `pathname`
 * (`/lessons/calendar` vence `/lessons`; `/classes/abc` cai em `/classes`). Nenhum, se a rota
 * está fora do menu (ex.: `/profile`).
 */
export function findActiveMenuItem(items: readonly MenuItem[], pathname: string): MenuItem | null {
  const activePath = findActivePath(
    items.map((item) => item.path),
    pathname,
  );

  return items.find((item) => item.path === activePath) ?? null;
}
