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

export type StudentStatus = "active" | "archived";

/**
 * A student is "archived" once `archivedAt` holds a date; the API leaves it `null` while the
 * student is active. An archived student is not deleted: the registration stays readable.
 */
export function studentStatusOf(archivedAt: string | null): StudentStatus {
  return archivedAt === null ? "active" : "archived";
}

/** Archived is neutral, not a warning: it is a state the registration is in, not a problem. */
export const STUDENT_STATUS_COLOR: Record<StudentStatus, BadgeTone> = {
  active: "success",
  archived: "neutral",
};

export const ENTRY_STATUS_COLOR: Record<EntryStatus, BadgeTone> = {
  approved: "success",
  adjusted: "info",
  pending: "warning",
  rejected: "danger",
};
