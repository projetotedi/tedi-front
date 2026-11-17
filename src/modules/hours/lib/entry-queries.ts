import type { QueryClient, QueryKey } from "@tanstack/react-query";

import {
  getGetHoursOverviewQueryKey,
  getGetMemberHoursQueryKey,
  getGetMyHoursSummaryQueryKey,
  getListMyHourEntriesQueryKey,
  getListPendingHourEntriesQueryKey,
} from "@api/generated/hours/hours";
import type { ListMyHourEntriesParams } from "@api/generated/model";

/** The card "Meus lançamentos" of the profile: the five most recent entries. */
export const MY_RECENT_ENTRIES_PARAMS = { limit: 5 } as const satisfies ListMyHourEntriesParams;

/** The page of the full statement: the default page of the API. */
export const MY_STATEMENT_PAGE_SIZE = 20;

/**
 * Marks the keys out of date and reads again the ones on the screen. `invalidateQueries` settles even
 * when a read fails (it does not throw by default), so one slow or failed list does not keep the
 * others from being read: each is its own query.
 */
async function invalidate(queryClient: QueryClient, keys: QueryKey[]): Promise<void> {
  await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

/** The queue of validation and the overview of the bank (GUS-165): an entry that is pending or leaves changes both. */
function reviewKeys(): QueryKey[] {
  return [getListPendingHourEntriesQueryKey(), getGetHoursOverviewQueryKey()];
}

/**
 * What the app has to know after the person logs hours for herself or removes an entry: her summary
 * (every period: the tiles have none, "Horas por categoria" has the month), her entries (the card of
 * the profile and every page of the statement) and what the coordination looks at. The keys without
 * parameters are the prefix of all of them. The hours of the members are not touched: these are hers.
 */
export function invalidateAfterOwnEntryChange(queryClient: QueryClient): Promise<void> {
  return invalidate(queryClient, [
    getGetMyHoursSummaryQueryKey(),
    getListMyHourEntriesQueryKey(),
    ...reviewKeys(),
  ]);
}

/**
 * What the app has to know after somebody logs hours on behalf of a member: the hours of that member
 * (her statement and her bank, whatever the page) and what the coordination looks at. The hours of
 * who logged them do not change, nor the ones of the other members.
 */
export function invalidateAfterLoggedForMember(
  queryClient: QueryClient,
  memberId: string,
): Promise<void> {
  return invalidate(queryClient, [getGetMemberHoursQueryKey(memberId), ...reviewKeys()]);
}
