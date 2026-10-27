import { useCallback, useState } from "react";

import { isMenuGroupId, type MenuGroupId, type MenuItem } from "@shared/lib/menu";

/** Chave do `sessionStorage` com os grupos do menu que a pessoa deixou abertos nesta sessão. */
export const EXPANDED_GROUPS_STORAGE_KEY = "tedi.sidebar.expandedGroups";

/** Grupos guardados na sessão; valor ausente, ilegível ou de outro formato vira lista vazia. */
function readStoredGroups(): MenuGroupId[] {
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(EXPANDED_GROUPS_STORAGE_KEY) ?? "[]");
    return Array.isArray(stored) ? [...new Set(stored.filter(isMenuGroupId))] : [];
  } catch {
    return [];
  }
}

function storeGroups(groups: MenuGroupId[]): void {
  try {
    sessionStorage.setItem(EXPANDED_GROUPS_STORAGE_KEY, JSON.stringify(groups));
  } catch {
    // Sem sessionStorage (bloqueado ou cheio): o estado vale só enquanto a sidebar existir.
  }
}

/** `groups` com `group` incluído; a mesma lista quando já está (ou não há grupo a incluir). */
function withGroup(groups: MenuGroupId[], group: MenuGroupId | null): MenuGroupId[] {
  return group === null || groups.includes(group) ? groups : [...groups, group];
}

/**
 * Grupos abertos do menu lateral. O grupo do item da rota atual vem aberto, e abre de novo
 * sempre que a rota muda para outro item. O que a pessoa abre ou fecha à mão fica no
 * `sessionStorage` (só nesta aba, até fechá-la) e volta quando a sidebar é montada de novo,
 * como ao abrir o Drawer; a abertura que vem da rota não é guardada sozinha.
 */
export function useExpandedMenuGroups(activeItem: MenuItem | null): {
  expandedGroups: MenuGroupId[];
  setExpandedGroups: (groups: MenuGroupId[]) => void;
} {
  const activePath = activeItem?.path ?? null;
  const activeGroup = activeItem?.group ?? null;

  const [expandedGroups, setExpandedGroupsState] = useState<MenuGroupId[]>(() =>
    withGroup(readStoredGroups(), activeGroup),
  );
  const [lastActivePath, setLastActivePath] = useState(activePath);

  // Ajuste de estado durante a renderização (sem useEffect): evita um quadro com o grupo fechado.
  if (activePath !== lastActivePath) {
    setLastActivePath(activePath);
    setExpandedGroupsState(withGroup(expandedGroups, activeGroup));
  }

  const setExpandedGroups = useCallback((groups: MenuGroupId[]) => {
    setExpandedGroupsState(groups);
    storeGroups(groups);
  }, []);

  return { expandedGroups, setExpandedGroups };
}
