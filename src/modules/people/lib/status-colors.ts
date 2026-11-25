import type { MemberStatus } from "@api/generated/model";
import type { BadgeProps } from "@shared/ui";

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

/**
 * `inactive` is a member that left the project (`PATCH /members/:id/deactivate`), which is
 * independent from the access to the system. Like an archived student, it is neutral: a state the
 * registration is in, not a problem.
 */
export const MEMBER_STATUS_COLOR: Record<MemberStatus, BadgeTone> = {
  active: "success",
  inactive: "neutral",
};
