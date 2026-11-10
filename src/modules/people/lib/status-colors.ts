import type { BadgeProps } from "@shared/ui";

import type { EntryStatus } from "./hours";

type BadgeTone = BadgeProps["tone"];

export type AccountStatus = "active" | "inactive";

/** An account with access revoked is "inactive"; the API exposes it as `accessEnabled`. */
export function accountStatusOf(accessEnabled: boolean): AccountStatus {
  return accessEnabled ? "active" : "inactive";
}

export const ACCOUNT_STATUS_COLOR: Record<AccountStatus, BadgeTone> = {
  active: "success",
  inactive: "neutral",
};

export const ENTRY_STATUS_COLOR: Record<EntryStatus, BadgeTone> = {
  approved: "success",
  adjusted: "info",
  pending: "warning",
  rejected: "danger",
};
