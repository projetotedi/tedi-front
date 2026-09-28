import { useAuth } from "@modules/auth";
import { filterMenuByRole, type MenuItem } from "@shared/lib/menu";

import { appMenuItems } from "./menu";

/** Itens do menu que o perfil do usuário logado pode ver. */
export function useAppMenu(): MenuItem[] {
  const { user } = useAuth();
  return filterMenuByRole(appMenuItems, user?.role);
}
