import type { QueryClient } from "@tanstack/react-query";

import { getGetMemberHoursQueryKey } from "@api/generated/hours/hours";

/**
 * What writing or clearing an observation changes: the hours of the member (`/members/:id/hours`,
 * whatever the period or the page: the key has no params), where the observation comes back with the
 * summary. The overview is left alone, because it always answers `note: null`. It settles when the
 * hours of the member on the screen have been read again (`invalidateQueries` does not reject:
 * `throwOnError` is off by default), so a button kept busy by the mutation frees only then.
 */
export function invalidateAfterNoteChange(
  queryClient: QueryClient,
  memberId: string,
): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: getGetMemberHoursQueryKey(memberId) });
}
