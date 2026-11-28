import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { getGetHoursOverviewQueryKey, getGetMemberHoursQueryKey } from "@api/generated/hours/hours";

import { invalidateAfterNoteChange } from "../lib/note-queries";
import { BEATRIZ_ID, FROM, RAFAEL_ID, TO } from "./bank-fixtures";

describe("invalidateAfterNoteChange", () => {
  it("reads again the hours of the member, of any period, and nothing else", async () => {
    const queryClient = new QueryClient();
    const march = getGetMemberHoursQueryKey(BEATRIZ_ID, { from: FROM, to: TO });
    const whole = getGetMemberHoursQueryKey(BEATRIZ_ID);
    const other = getGetMemberHoursQueryKey(RAFAEL_ID, { from: FROM, to: TO });
    const overview = getGetHoursOverviewQueryKey({ from: FROM, to: TO });
    for (const key of [march, whole, other, overview]) queryClient.setQueryData(key, {});

    await invalidateAfterNoteChange(queryClient, BEATRIZ_ID);

    expect(queryClient.getQueryState(march)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(whole)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(other)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(overview)?.isInvalidated).toBe(false);
  });
});
