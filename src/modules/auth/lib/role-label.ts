import { Role } from "@shared/lib/role";
import type { BadgeProps } from "@shared/ui";

export const INVITABLE_ROLES = [Role.member, Role.director, Role.coordinator] as const;

export function roleBadgeTone(role: Role | null): BadgeProps["tone"] {
  if (role === Role.director) return "info";
  if (role === Role.coordinator || role === Role.superadmin) return "highlight";
  return "neutral";
}
