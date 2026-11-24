import { describe, expect, it } from "vitest";

import { HourEntryStatus, type HoursSummaryResponseDto } from "@api/generated/model";
import { formatHours } from "@shared/lib/format";

import { bankTotals } from "../lib/bank-totals";

type StatusMinutes = [entries: number, declared: number, validated: number];

function summaryOf(
  bankMinutes: number,
  byStatus: Record<HourEntryStatus, StatusMinutes>,
): HoursSummaryResponseDto {
  return {
    from: "2026-03-01",
    to: "2026-03-31",
    bankMinutes,
    byCategory: [],
    byStatus: Object.values(HourEntryStatus).map((status) => {
      const [entries, declaredMinutes, validatedMinutes] = byStatus[status];
      return { status, entries, declaredMinutes, validatedMinutes };
    }),
  };
}

function inHours(summary: HoursSummaryResponseDto): string[] {
  const totals = bankTotals(summary);
  return [totals.declared, totals.validated, totals.pending, totals.adjustedOrRejected].map(
    formatHours,
  );
}

describe("bankTotals", () => {
  it.each([
    [
      "the start",
      summaryOf(16560, {
        pending: [3, 720, 0],
        approved: [61, 15720, 15720],
        adjusted: [4, 1200, 840],
        rejected: [3, 1080, 0],
      }),
      ["312h", "276h", "12h", "24h"],
    ],
    [
      "validated in batch",
      summaryOf(17040, {
        pending: [1, 240, 0],
        approved: [63, 16200, 16200],
        adjusted: [4, 1200, 840],
        rejected: [3, 1080, 0],
      }),
      ["312h", "284h", "4h", "24h"],
    ],
    [
      "adjusted",
      summaryOf(16680, {
        pending: [2, 480, 0],
        approved: [61, 15720, 15720],
        adjusted: [5, 1440, 960],
        rejected: [3, 1080, 0],
      }),
      ["312h", "278h", "8h", "26h"],
    ],
    [
      "rejected",
      summaryOf(16560, {
        pending: [2, 480, 0],
        approved: [61, 15720, 15720],
        adjusted: [4, 1200, 840],
        rejected: [4, 1320, 0],
      }),
      ["312h", "276h", "8h", "28h"],
    ],
  ])("gives the four cards of the Figma in the state %s", (_state, summary, expected) => {
    expect(inHours(summary)).toEqual(expected);
  });

  it("shows 0 for Ajustadas / rejeitadas when an adjustment went above the declared minutes", () => {
    const summary = summaryOf(600, {
      pending: [0, 0, 0],
      approved: [1, 240, 240],
      adjusted: [1, 240, 360],
      rejected: [0, 0, 0],
    });

    expect(bankTotals(summary).adjustedOrRejected).toBe(0);
  });

  it("counts a status missing from the answer as 0", () => {
    const summary: HoursSummaryResponseDto = {
      from: null,
      to: null,
      bankMinutes: 240,
      byCategory: [],
      byStatus: [
        {
          status: HourEntryStatus.approved,
          entries: 1,
          declaredMinutes: 240,
          validatedMinutes: 240,
        },
      ],
    };

    expect(bankTotals(summary)).toEqual({
      declared: 240,
      validated: 240,
      pending: 0,
      adjustedOrRejected: 0,
    });
  });
});
