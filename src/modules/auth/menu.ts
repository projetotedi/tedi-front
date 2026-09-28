import type { MenuItem } from "@shared/lib/menu";
import { Role } from "@shared/lib/role";

import accessIcon from "./assets/access.svg";

/**
 * Itens do menu lateral do módulo. O `minRole` repete o `RequireRole` da rota em
 * `authProtectedRoutes` (decisão 18: menu e guarda são duas verdades, revisar juntas).
 * "Acessos" não está no protótipo do Figma; entra porque a GUS-86 exige (CA1).
 */
export const authMenuItems: MenuItem[] = [
  { label: "auth:access.title", path: "/access", minRole: Role.coordinator, icon: accessIcon },
];
