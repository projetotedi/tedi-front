import type { QueryClient } from "@tanstack/react-query";

import { getListAccessQueryKey } from "@api/generated/auth/auth";
import {
  getListMemberRegistrationsQueryKey,
  getListMembersQueryKey,
} from "@api/generated/people/people";

/**
 * Aprovar ou recusar muda o que as três listagens mostram: a fila de cadastros (`/member-registrations`),
 * os membros (`/members`) e os acessos (`/access`, a tela de Membros da coordenação). Invalida pelo
 * prefixo, então qualquer página, busca ou filtro em cache é refeito.
 *
 * O detalhe (`/member-registrations/:id`) não entra: o prefixo da lista não o alcança, e quem
 * conhece a resposta da ação a grava nele com `setQueryData` em vez de buscar de novo.
 */
export function invalidateMemberLists(queryClient: QueryClient): Promise<void[]> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: getListMemberRegistrationsQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getListAccessQueryKey() }),
  ]);
}
