import personsIcon from "../../assets/icons/persons.svg";
import type { MenuItem } from "@shared/lib/menu";

/**
 * Itens do menu lateral do módulo. A `permission` repete o `RequirePermission` da rota em
 * `authProtectedRoutes` (decisão 18: menu e guarda são duas verdades, revisar juntas).
 *
 * "Membros e Planejamento" é o item do protótipo do Figma (`common:nav.members`, `/members`):
 * a gestão de acessos (GUS-87) é a tela real por trás dele, não uma rota `/access` separada.
 * Usa `access.manage` (e não `members.list`) porque a tela chama `GET /access`, só da
 * coordenação; o diretor passa a ver o item na GUS-109. Substitui a linha correspondente em
 * `app/menu.ts` (`prototypeMenuItems`), no mesmo lugar.
 */
export const authMenuItems: MenuItem[] = [
  {
    label: "common:nav.members",
    path: "/members",
    permission: "access.manage",
    icon: personsIcon,
  },
];
