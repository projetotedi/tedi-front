import { QueryClient, type QueryKey } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import {
  getGetHoursOverviewQueryKey,
  getGetMemberHoursQueryKey,
  getGetMyHoursSummaryQueryKey,
  getListMyHourEntriesQueryKey,
  getListPendingHourEntriesQueryKey,
} from "@api/generated/hours/hours";

import {
  invalidateAfterLoggedForMember,
  invalidateAfterOwnEntryChange,
} from "../lib/entry-queries";
import { ANA_ID, BEATRIZ_ID } from "./entries-handlers";

const OTHER_MEMBER_ID = "6a1f0c2e-5555-4a55-8a55-555555555555";

const MY_SUMMARY_ALL = getGetMyHoursSummaryQueryKey();
const MY_SUMMARY_MONTH = getGetMyHoursSummaryQueryKey({ from: "2026-03-01", to: "2026-03-31" });
const MY_RECENT = getListMyHourEntriesQueryKey({ limit: 5 });
const MY_STATEMENT_PAGE_2 = getListMyHourEntriesQueryKey({ page: 2, limit: 20 });
const QUEUE = getListPendingHourEntriesQueryKey({ page: 1 });
const OVERVIEW = getGetHoursOverviewQueryKey();
const MY_HOURS_AS_MEMBER = getGetMemberHoursQueryKey(ANA_ID, { page: 1 });
const BEATRIZ_HOURS = getGetMemberHoursQueryKey(BEATRIZ_ID, { page: 1 });
const OTHER_MEMBER_HOURS = getGetMemberHoursQueryKey(OTHER_MEMBER_ID);

const ALL_KEYS: QueryKey[] = [
  MY_SUMMARY_ALL,
  MY_SUMMARY_MONTH,
  MY_RECENT,
  MY_STATEMENT_PAGE_2,
  QUEUE,
  OVERVIEW,
  MY_HOURS_AS_MEMBER,
  BEATRIZ_HOURS,
  OTHER_MEMBER_HOURS,
];

/** A cache with something under every key, none of it out of date. */
function seededClient(): QueryClient {
  const queryClient = new QueryClient();
  for (const queryKey of ALL_KEYS) queryClient.setQueryData(queryKey, { cached: true });
  return queryClient;
}

function isInvalidated(queryClient: QueryClient, queryKey: QueryKey): boolean | undefined {
  return queryClient.getQueryState(queryKey)?.isInvalidated;
}

describe("entry queries", () => {
  it("after my own change, invalidates every summary and every page of my entries, my hours as a member, the queue and the overview", async () => {
    const queryClient = seededClient();

    await invalidateAfterOwnEntryChange(queryClient, ANA_ID);

    for (const queryKey of [
      MY_SUMMARY_ALL,
      MY_SUMMARY_MONTH,
      MY_RECENT,
      MY_STATEMENT_PAGE_2,
      MY_HOURS_AS_MEMBER,
      QUEUE,
      OVERVIEW,
    ]) {
      expect(isInvalidated(queryClient, queryKey), JSON.stringify(queryKey)).toBe(true);
    }
  });

  it("after my own change, leaves the hours of the other members alone", async () => {
    const queryClient = seededClient();

    await invalidateAfterOwnEntryChange(queryClient, ANA_ID);

    expect(isInvalidated(queryClient, BEATRIZ_HOURS)).toBe(false);
    expect(isInvalidated(queryClient, OTHER_MEMBER_HOURS)).toBe(false);
  });

  it("with no session, tells no member's hours", async () => {
    const queryClient = seededClient();

    await invalidateAfterOwnEntryChange(queryClient, null);

    expect(isInvalidated(queryClient, MY_SUMMARY_ALL)).toBe(true);
    for (const queryKey of [MY_HOURS_AS_MEMBER, BEATRIZ_HOURS, OTHER_MEMBER_HOURS]) {
      expect(isInvalidated(queryClient, queryKey), JSON.stringify(queryKey)).toBe(false);
    }
  });

  it("after logging for a member, invalidates that member's hours, the queue and the overview, and not my hours nor another member's", async () => {
    const queryClient = seededClient();

    await invalidateAfterLoggedForMember(queryClient, BEATRIZ_ID);

    for (const queryKey of [BEATRIZ_HOURS, QUEUE, OVERVIEW]) {
      expect(isInvalidated(queryClient, queryKey), JSON.stringify(queryKey)).toBe(true);
    }
    for (const queryKey of [
      MY_SUMMARY_ALL,
      MY_SUMMARY_MONTH,
      MY_RECENT,
      MY_STATEMENT_PAGE_2,
      MY_HOURS_AS_MEMBER,
      OTHER_MEMBER_HOURS,
    ]) {
      expect(isInvalidated(queryClient, queryKey), JSON.stringify(queryKey)).toBe(false);
    }
  });
});
