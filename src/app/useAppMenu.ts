import { useAuth } from "@modules/auth";
import { filterMenuByPermission, type MenuItem } from "@shared/lib/menu";

import { appMenuItems } from "./menu";

/** Itens do menu que o usuário logado pode ver. */
export function useAppMenu(): MenuItem[] {
  const { user } = useAuth();
  return filterMenuByPermission(appMenuItems, user);
}
