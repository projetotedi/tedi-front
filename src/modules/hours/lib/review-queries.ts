import type { QueryClient } from "@tanstack/react-query";

import {
  getGetHourEntryHistoryQueryKey,
  getGetHoursOverviewQueryKey,
  getGetMemberHoursQueryKey,
  getListPendingHourEntriesQueryKey,
} from "@api/generated/hours/hours";
import type { MemberHourEntryResponseDto } from "@api/generated/model";

/**
 * What a review (validate, adjust, reject, or a refusal that says the queue is out of date) changes:
 * the queue (`/hour-entries`, whatever its filters: the probes of the period too), the overview
 * (`/hours/overview`, any period, search or page), the bank of each member of the entries (their
 * key has the id inside the path, so there is no common prefix) and the history of each entry.
 * It settles when the queue has been read again; the rest goes on in the background
 * (`invalidateQueries` does not reject: `throwOnError` is off by default).
 */
export async function invalidateAfterReview(
  queryClient: QueryClient,
  entries: ReadonlyArray<Pick<MemberHourEntryResponseDto, "id" | "personId">>,
): Promise<void> {
  const queueRead = queryClient.invalidateQueries({
    queryKey: getListPendingHourEntriesQueryKey(),
  });
  void Promise.all([
    queryClient.invalidateQueries({ queryKey: getGetHoursOverviewQueryKey() }),
    ...[...new Set(entries.map((entry) => entry.personId))].map((personId) =>
      queryClient.invalidateQueries({ queryKey: getGetMemberHoursQueryKey(personId) }),
    ),
    ...entries.map((entry) =>
      queryClient.invalidateQueries({ queryKey: getGetHourEntryHistoryQueryKey(entry.id) }),
    ),
  ]);
  await queueRead;
}
