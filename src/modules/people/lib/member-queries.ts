import type { QueryClient } from "@tanstack/react-query";

import { getGetMemberQueryKey } from "@api/generated/people/people";
import { invalidateAccessList } from "@modules/auth";

/**
 * After a member is edited, deactivated or gets another access profile: the record of the member
 * (`getMember`) and every cached page of `listMembers` and `listAccess`. `listMembers` is also the
 * list that Nova alocação offers (`status=active`), so a deactivated member leaves it at once.
 */
export async function invalidateAfterMemberChanged(
  queryClient: QueryClient,
  memberId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: getGetMemberQueryKey(memberId) }),
    invalidateAccessList(queryClient),
  ]);
}
