/**
 * Shapes of the hours cards of "My profile": the summary, "My entries" and "Hours by category".
 *
 * They are provisional. The hours bank does not exist in the API yet, so the page passes `null`
 * to those cards; GUS-163 replaces these types with the ones generated from the contract that
 * GUS-162 publishes.
 */

export type EntryStatus = "approved" | "adjusted" | "pending" | "rejected";
export type HoursCategory = "class" | "management" | "planning" | "event" | "other";

export interface HoursEntry {
  id: string;
  /** Local date, `YYYY-MM-DD`. */
  date: string;
  activity: string;
  category: HoursCategory;
  declaredMinutes: number;
  /** `null` while the entry is not validated. */
  validatedMinutes: number | null;
  status: EntryStatus;
}

export interface CategoryHours {
  category: HoursCategory;
  totalMinutes: number;
  /** 0 when there is nothing to validate. */
  pendingMinutes: number;
  note: string;
}

export interface HoursSummaryMinutes {
  total: number;
  validated: number;
  pending: number;
  adjustedOrRejected: number;
}

export interface CategoryHoursSummary {
  /** Reference month, `YYYY-MM`. */
  period: string;
  rows: CategoryHours[];
}
