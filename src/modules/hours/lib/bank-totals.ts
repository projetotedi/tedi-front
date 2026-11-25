import { HourEntryStatus, type HoursSummaryResponseDto } from "@api/generated/model";

/** The four cards of the totals, in minutes. */
export interface BankTotals {
  declared: number;
  validated: number;
  pending: number;
  adjustedOrRejected: number;
}

/**
 * The totals of a period, from the summary of the API. The Figma says "validadas + pendentes +
 * ajustadas/rejeitadas = lançadas": what an adjustment cut and what a rejection refused are the
 * hours that were logged and did not enter the bank.
 */
export function bankTotals(summary: HoursSummaryResponseDto): BankTotals {
  const totalOf = (status: HourEntryStatus) =>
    summary.byStatus.find((total) => total.status === status);
  // The contract always sends the four statuses; one that is missing has no entries, so 0 minutes.
  const declaredOf = (status: HourEntryStatus) => totalOf(status)?.declaredMinutes ?? 0;
  const adjusted = totalOf(HourEntryStatus.adjusted);
  const cutByAdjustments =
    adjusted === undefined ? 0 : adjusted.declaredMinutes - adjusted.validatedMinutes;

  return {
    declared: summary.byStatus.reduce((sum, total) => sum + total.declaredMinutes, 0),
    validated: summary.bankMinutes,
    pending: declaredOf(HourEntryStatus.pending),
    // An adjustment may go above the declared minutes (the contract allows it): the card shows 0,
    // never a negative number (decision of the user, 2026-11-17).
    adjustedOrRejected: Math.max(0, cutByAdjustments + declaredOf(HourEntryStatus.rejected)),
  };
}
