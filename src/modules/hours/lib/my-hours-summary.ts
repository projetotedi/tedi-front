import {
  HourEntryStatus,
  type HourEntryCategory,
  type HoursSummaryResponseDto,
} from "@api/generated/model";

import { CATEGORY_ORDER } from "./entry-labels";

export interface SummaryTotals {
  /** Every minute declared, of any status. */
  total: number;
  /** What is in the bank: the validated minutes of the approved and adjusted entries. */
  validated: number;
  /** The declared minutes of the pending entries. */
  pending: number;
  /** What was declared and did not go into the bank: cut by an adjustment, or rejected. */
  adjustedOrRejected: number;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * The four numbers on top of "Meu perfil", from a summary of the API. Ajustadas / rejeitadas is what
 * is left: total − validated − pending. An adjustment may give more minutes than were declared (the
 * API allows it), which would make that difference negative; the tile shows 0 then (decision of
 * 2026-11-17, GUS-163 × GUS-165).
 */
export function summaryTotals(summary: HoursSummaryResponseDto): SummaryTotals {
  const total = sum(summary.byStatus.map((item) => item.declaredMinutes));
  const validated = summary.bankMinutes;
  const pending = sum(
    summary.byStatus
      .filter((item) => item.status === HourEntryStatus.pending)
      .map((item) => item.declaredMinutes),
  );

  return {
    total,
    validated,
    pending,
    adjustedOrRejected: Math.max(0, total - validated - pending),
  };
}

export interface CategoryRow {
  category: HourEntryCategory;
  /** What counts for the person: validated plus waiting for validation (what was cut or rejected does not). */
  hoursMinutes: number;
  /** The declared minutes of the pending entries. */
  pendingMinutes: number;
}

/**
 * The rows of "Horas por categoria": only the categories that have entries in the summary (the API
 * always answers the seven), the most hours first, a tie in the order of the contract. A category
 * whose entries were all rejected stays, with 0h: there were entries, and they did not count.
 */
export function categoryRows(summary: HoursSummaryResponseDto): CategoryRow[] {
  return summary.byCategory
    .filter((item) => item.entries > 0)
    .map((item) => ({
      category: item.category,
      hoursMinutes: item.bankMinutes + item.pendingMinutes,
      pendingMinutes: item.pendingMinutes,
    }))
    .sort(
      (first, second) =>
        second.hoursMinutes - first.hoursMinutes ||
        CATEGORY_ORDER.indexOf(first.category) - CATEGORY_ORDER.indexOf(second.category),
    );
}
