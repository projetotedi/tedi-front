import { Role } from "@shared/lib/role";
import type { BadgeProps } from "@shared/ui";

export const INVITABLE_ROLES = [Role.member, Role.director, Role.coordinator] as const;

/** `superadmin` aparece como Coordenadora: não deve ser distinto nas telas. */
export function roleLabelKey(role: Role | null): string | null {
  if (role === null) return null;
  if (role === Role.superadmin) return "roles.coordinator";
  return `roles.${role}`;
}

export function roleBadgeTone(role: Role | null): BadgeProps["tone"] {
  if (role === Role.director) return "info";
  if (role === Role.coordinator || role === Role.superadmin) return "highlight";
  return "neutral";
}
