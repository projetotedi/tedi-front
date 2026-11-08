import { Role } from "@shared/lib/role";
import type { BadgeProps } from "@shared/ui";

export const INVITABLE_ROLES = [Role.member, Role.director, Role.coordinator] as const;

/** Perfil que a coordenação pode atribuir pelo card "Acesso ao sistema" (o mesmo conjunto dos convites). */
export type AssignableRole = (typeof INVITABLE_ROLES)[number];

/**
 * O perfil da pessoa como opção do select de perfil de acesso, ou `null` se ele não é uma opção:
 * `superadmin` (que não se atribui) e quem não tem perfil. Só reconhece o valor; não decide nada.
 */
export function toAssignableRole(role: Role | null): AssignableRole | null {
  return INVITABLE_ROLES.find((candidate) => candidate === role) ?? null;
}

export function roleBadgeTone(role: Role | null): BadgeProps["tone"] {
  if (role === Role.director) return "info";
  if (role === Role.coordinator || role === Role.superadmin) return "highlight";
  return "neutral";
}
