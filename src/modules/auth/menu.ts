import type { MenuItem } from "@shared/lib/menu";

/**
 * Itens do menu lateral do módulo. A `permission` repete o `RequirePermission` da rota em
 * `authProtectedRoutes` (decisão 18: menu e guarda são duas verdades, revisar juntas).
 *
 * "Membros" é o item do grupo Pessoas (`common:nav.members`, `/members`): a gestão de acessos
 * (GUS-87) é a tela real por trás dele, não uma rota `/access` separada. Usa `members.list`
 * (GUS-150): a tela lê `GET /members`, que a coordenação e o diretor listam; o membro não vê o
 * item. As ações de acesso dentro da tela (convidar, validar) ficam atrás de `invites.manage`,
 * só da coordenação. Substitui a linha correspondente em `app/menu.ts` (`prototypeMenuItems`).
 */
export const authMenuItems: MenuItem[] = [
  {
    label: "common:nav.members",
    path: "/members",
    permission: "members.list",
    group: "people",
  },
];
