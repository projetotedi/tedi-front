import personsIcon from "../../assets/icons/persons.svg";
import type { MenuItem } from "@shared/lib/menu";
import { Role } from "@shared/lib/role";

/**
 * Itens do menu lateral do módulo. O `minRole` repete o `RequireRole` da rota em
 * `authProtectedRoutes` (decisão 18: menu e guarda são duas verdades, revisar juntas).
 *
 * "Membros e Planejamento" é o item do protótipo do Figma (`common:nav.members`, `/members`):
 * a gestão de acessos (GUS-87) é a tela real por trás dele, não uma rota `/access` separada.
 * Substitui a linha correspondente em `app/menu.ts` (`prototypeMenuItems`), no mesmo lugar.
 */
export const authMenuItems: MenuItem[] = [
  {
    label: "common:nav.members",
    path: "/members",
    minRole: Role.coordinator,
    icon: personsIcon,
  },
];
