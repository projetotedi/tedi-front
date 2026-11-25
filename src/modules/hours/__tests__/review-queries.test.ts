import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { invalidateAfterReview, invalidateIfStale } from "../lib/review-queries";
import { BEATRIZ_ID, ENTRY_0503_ID, ENTRY_1403_ID } from "./bank-fixtures";

const ENTRIES = [
  { id: ENTRY_0503_ID, personId: BEATRIZ_ID },
  { id: ENTRY_1403_ID, personId: BEATRIZ_ID },
];

function invalidatedKeys(queryClient: QueryClient): unknown[] {
  return vi.mocked(queryClient.invalidateQueries).mock.calls.map(([filters]) => filters?.queryKey);
}

function spiedClient(): QueryClient {
  const queryClient = new QueryClient();
  vi.spyOn(queryClient, "invalidateQueries");
  return queryClient;
}

describe("review queries", () => {
  it("invalidateAfterReview reads again the queue, the overview, the bank of each member once and each history", async () => {
    const queryClient = spiedClient();

    await invalidateAfterReview(queryClient, ENTRIES);

    expect(invalidatedKeys(queryClient)).toEqual([
      ["/hour-entries"],
      ["/hours/overview"],
      [`/members/${BEATRIZ_ID}/hours`],
      [`/hour-entries/${ENTRY_0503_ID}/history`],
      [`/hour-entries/${ENTRY_1403_ID}/history`],
    ]);
  });

  it.each([
    ["409 ENTRY_NOT_PENDING", { statusCode: 409, error: "ENTRY_NOT_PENDING" }],
    ["400 HOUR_ENTRY_NOT_FOUND", { statusCode: 400, error: "HOUR_ENTRY_NOT_FOUND" }],
  ])("invalidateIfStale reads everything again after %s", async (_case, error) => {
    const queryClient = spiedClient();

    await invalidateIfStale(queryClient, error, ENTRIES);

    expect(invalidatedKeys(queryClient)).toContainEqual(["/hour-entries"]);
    expect(invalidatedKeys(queryClient)).toContainEqual(["/hours/overview"]);
  });

  it.each([
    ["409 SELF_REVIEW_NOT_ALLOWED", { statusCode: 409, error: "SELF_REVIEW_NOT_ALLOWED" }],
    ["500", { statusCode: 500, error: "INTERNAL_ERROR" }],
    ["a failed connection", new TypeError("Failed to fetch")],
  ])("invalidateIfStale reads nothing again after %s", async (_case, error) => {
    const queryClient = spiedClient();

    await invalidateIfStale(queryClient, error, ENTRIES);

    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });
});
