import {
  MemberRegistrationStatus,
  MemberStatus,
  type MemberListItemResponseDto,
} from "@api/generated/model";
import type { BadgeProps } from "@shared/ui";

/**
 * What the Status column says about a row. It is the key of the label in the `auth` namespace
 * (`access.people.status.<status>`) and of the tone of the badge.
 */
export type MemberRowStatus = "active" | "inactive" | "pending" | "rejected";

/**
 * One entry per participation the API knows (`MemberStatus`), so the typecheck points here when a
 * new one is added (the Figma also has "Afastado", which the contract does not have yet).
 */
const PARTICIPATION_STATUS = {
  [MemberStatus.active]: "active",
  [MemberStatus.inactive]: "inactive",
} as const satisfies Record<MemberStatus, MemberRowStatus>;

/**
 * The status of a row of the list of members. The registration comes first, because the API keeps
 * `status` at `active` while a registration is pending or rejected; then the participation. Access
 * to the system (`accessEnabled`) is not part of it: it has its own card (GUS-88).
 */
export function memberRowStatus(
  row: Pick<MemberListItemResponseDto, "registrationStatus" | "status">,
): MemberRowStatus {
  if (row.registrationStatus === MemberRegistrationStatus.pending) return "pending";
  if (row.registrationStatus === MemberRegistrationStatus.rejected) return "rejected";
  return PARTICIPATION_STATUS[row.status];
}

/** The tone of the badge of each status. */
export const MEMBER_ROW_STATUS_TONE: Record<MemberRowStatus, BadgeProps["tone"]> = {
  active: "success",
  inactive: "neutral",
  pending: "warning",
  rejected: "danger",
};
