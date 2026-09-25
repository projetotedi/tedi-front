import personsIconUrl from "@shared/assets/icons/persons.svg";
import type { NavItem } from "@shared/lib/navigation";
import { Role } from "@shared/lib/role";

/**
 * Itens do menu lateral que o módulo `auth` contribui. O `AppLayout` junta os de todos os
 * módulos e mostra só os que o perfil do usuário alcança (`minRole`).
 */
export const authNavItems: NavItem[] = [
  {
    to: "/access",
    labelNs: "auth",
    labelKey: "nav.access",
    iconSrc: personsIconUrl,
    minRole: Role.coordinator,
  },
];
