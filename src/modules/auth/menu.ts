import type { MenuItem } from "@shared/lib/menu";

/**
 * Itens do menu lateral do módulo. A `permission` repete o `RequirePermission` da rota em
 * `authProtectedRoutes` (decisão 18: menu e guarda são duas verdades, revisar juntas).
 *
 * "Membros" é o item do grupo Pessoas (`common:nav.members`, `/members`): a gestão de acessos
 * (GUS-87) é a tela real por trás dele, não uma rota `/access` separada. Usa `access.manage`
 * (e não `members.list`) porque a tela chama `GET /access`, só da coordenação (decisão 9); o
 * diretor não vê o item. Abrir para ele depende de uma listagem de membros no back (E1.b).
 * Substitui a linha correspondente em `app/menu.ts` (`prototypeMenuItems`).
 */
export const authMenuItems: MenuItem[] = [
  {
    label: "common:nav.members",
    path: "/members",
    permission: "access.manage",
    group: "people",
  },
];
