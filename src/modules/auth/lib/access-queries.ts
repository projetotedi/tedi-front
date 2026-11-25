import type { QueryClient } from "@tanstack/react-query";

import { getListAccessQueryKey, getListInvitesQueryKey } from "@api/generated";
import { getListMembersQueryKey } from "@api/generated/people/people";

/**
 * Recarrega a listagem de membros (todas as páginas e filtros em cache): a linha de quem teve o
 * perfil ou o acesso alterado muda sem recarregar a página.
 */
export function invalidateAccessList(queryClient: QueryClient): Promise<void[]> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getListAccessQueryKey() }),
  ]);
}

/** Recarrega os convites pendentes (a contagem do botão e a lista do modal). */
export function invalidatePendingInvites(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: getListInvitesQueryKey() });
}
