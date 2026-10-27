import type { BadgeProps } from "@shared/ui";

import type { AccountStatus, EntryStatus } from "../mocks/profile.mock";

type BadgeTone = BadgeProps["tone"];

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
