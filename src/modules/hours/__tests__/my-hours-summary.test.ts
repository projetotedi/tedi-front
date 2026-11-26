import { describe, expect, it } from "vitest";

import { categoryRows, summaryTotals } from "../lib/my-hours-summary";
import { buildSummary, SUMMARY_ALL, SUMMARY_MONTH } from "./entries-handlers";

describe("summaryTotals", () => {
  it("adds the totals of the Figma: 58h, 48h, 8h and 2h", () => {
    expect(summaryTotals(SUMMARY_ALL)).toEqual({
      total: 3480,
      validated: 2880,
      pending: 480,
      adjustedOrRejected: 120,
    });
  });

  it("shows 0 adjusted or rejected when an adjustment raised the hours", () => {
    const summary = buildSummary({
      bankMinutes: 240,
      byStatus: [
        { status: "pending", entries: 0, declaredMinutes: 0, validatedMinutes: 0 },
        { status: "approved", entries: 0, declaredMinutes: 0, validatedMinutes: 0 },
        // 3h declared, 4h validated: 1h more than declared.
        { status: "adjusted", entries: 1, declaredMinutes: 180, validatedMinutes: 240 },
        { status: "rejected", entries: 0, declaredMinutes: 0, validatedMinutes: 0 },
      ],
    });

    expect(summaryTotals(summary)).toEqual({
      total: 180,
      validated: 240,
      pending: 0,
      adjustedOrRejected: 0,
    });
  });

  it("counts no pending minutes when the summary has no pending item", () => {
    const summary = buildSummary({
      bankMinutes: 120,
      byStatus: [{ status: "approved", entries: 1, declaredMinutes: 120, validatedMinutes: 120 }],
    });

    expect(summaryTotals(summary)).toEqual({
      total: 120,
      validated: 120,
      pending: 0,
      adjustedOrRejected: 0,
    });
  });
});

describe("categoryRows", () => {
  it("lists only the categories with entries, by hours, as the Figma: Aula 28h, Gestão 20h, Planejamento 8h, Evento 2h", () => {
    expect(categoryRows(SUMMARY_MONTH)).toEqual([
      { category: "lesson", hoursMinutes: 1680, pendingMinutes: 0 },
      { category: "management", hoursMinutes: 1200, pendingMinutes: 0 },
      { category: "planning", hoursMinutes: 480, pendingMinutes: 480 },
      { category: "event", hoursMinutes: 120, pendingMinutes: 0 },
    ]);
  });

  it("keeps a category whose entries were all rejected, with 0h", () => {
    const summary = buildSummary({
      byCategory: [
        {
          category: "other",
          entries: 1,
          declaredMinutes: 60,
          bankMinutes: 0,
          pendingMinutes: 0,
          note: null,
        },
        {
          category: "meeting",
          entries: 0,
          declaredMinutes: 0,
          bankMinutes: 0,
          pendingMinutes: 0,
          note: null,
        },
      ],
    });

    expect(categoryRows(summary)).toEqual([
      { category: "other", hoursMinutes: 0, pendingMinutes: 0 },
    ]);
  });

  it("breaks a tie by the order of the categories of the contract", () => {
    const summary = buildSummary({
      byCategory: [
        {
          category: "other",
          entries: 1,
          declaredMinutes: 60,
          bankMinutes: 60,
          pendingMinutes: 0,
          note: null,
        },
        {
          category: "support",
          entries: 1,
          declaredMinutes: 60,
          bankMinutes: 0,
          pendingMinutes: 60,
          note: null,
        },
        {
          category: "planning",
          entries: 2,
          declaredMinutes: 90,
          bankMinutes: 60,
          pendingMinutes: 0,
          note: null,
        },
        {
          category: "lesson",
          entries: 1,
          declaredMinutes: 120,
          bankMinutes: 120,
          pendingMinutes: 0,
          note: null,
        },
      ],
    });

    expect(categoryRows(summary).map((row) => row.category)).toEqual([
      "lesson",
      "planning",
      "support",
      "other",
    ]);
  });
});
