import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import {
  getListAccessQueryKey,
  getListInvitesQueryKey,
  getMeQueryKey,
} from "@api/generated/auth/auth";
import {
  getGetMemberRegistrationQueryKey,
  getGetMyProfileQueryKey,
  getListDepartmentsQueryKey,
  getListMemberRegistrationsQueryKey,
  getListMembersQueryKey,
} from "@api/generated/people/people";

import { invalidateMemberLists } from "../lib/registration-queries";

const REGISTRATION_ID = "01952ef7-0000-7000-8000-0000000000c1";

function isInvalidated(queryClient: QueryClient, queryKey: readonly unknown[]): boolean {
  return queryClient.getQueryState(queryKey)?.isInvalidated ?? false;
}

describe("invalidateMemberLists", () => {
  it("invalidates the registrations, members and access lists, whatever their params", async () => {
    const queryClient = new QueryClient();
    const lists = [
      getListMemberRegistrationsQueryKey(),
      getListMemberRegistrationsQueryKey({ status: "approved", page: 2 }),
      getListMembersQueryKey({ page: 1, limit: 12 }),
      getListMembersQueryKey({ search: "lucas" }),
      getListAccessQueryKey({ page: 3 }),
    ];
    for (const key of lists) queryClient.setQueryData(key, { data: [] });

    await invalidateMemberLists(queryClient);

    for (const key of lists) expect(isInvalidated(queryClient, key), String(key)).toBe(true);
  });

  it("leaves the registration detail alone: the caller writes the answer into it", async () => {
    const queryClient = new QueryClient();
    const detailKey = getGetMemberRegistrationQueryKey(REGISTRATION_ID);
    queryClient.setQueryData(detailKey, { id: REGISTRATION_ID });

    await invalidateMemberLists(queryClient);

    expect(isInvalidated(queryClient, detailKey)).toBe(false);
  });

  it("leaves unrelated queries alone", async () => {
    const queryClient = new QueryClient();
    const others = [
      getMeQueryKey(),
      getGetMyProfileQueryKey(),
      getListDepartmentsQueryKey(),
      getListInvitesQueryKey(),
    ];
    for (const key of others) queryClient.setQueryData(key, {});

    await invalidateMemberLists(queryClient);

    for (const key of others) expect(isInvalidated(queryClient, key), String(key)).toBe(false);
  });
});
