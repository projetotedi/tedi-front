import { Role } from "@shared/lib/role";
import type { BadgeProps } from "@shared/ui";

/** Perfis que a coordenação pode convidar (o back rejeita `superadmin` em `POST /invites`). */
export const INVITABLE_ROLES = [Role.member, Role.director, Role.coordinator] as const;

/**
 * Chave de i18n para o rótulo do perfil. `superadmin` aparece como "Coordenadora": o
 * superadmin não deve aparecer distinto nas telas (decisão 3).
 */
export function roleLabelKey(role: Role | null): string | null {
  if (role === null) return null;
  if (role === Role.superadmin) return "roles.coordinator";
  return `roles.${role}`;
}

/**
 * Tom do selo do papel na lista de membros: Membro neutro, Diretor(a) azul, Coordenadora roxo.
 * `superadmin` segue `roleLabelKey` e aparece como Coordenadora.
 */
export function roleBadgeTone(role: Role | null): BadgeProps["tone"] {
  if (role === Role.director) return "info";
  if (role === Role.coordinator || role === Role.superadmin) return "highlight";
  return "neutral";
}
