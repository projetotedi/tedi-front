import { Role } from "@api/generated/model";

export { Role } from "@api/generated/model";

/**
 * Hierarquia de perfis, espelhando o RolesGuard do back
 * (tedi-back/src/shared/enums/role.enum.ts): member < director < coordinator < superadmin.
 * superadmin satisfaz qualquer `minRole` e é invisível na interface.
 */
export const ROLE_RANK: Record<Role, number> = {
  [Role.member]: 0,
  [Role.director]: 1,
  [Role.coordinator]: 2,
  [Role.superadmin]: 3,
};

/** true quando `userRole` atende (ou supera) `minRole`. null/undefined nunca satisfaz. */
export function roleSatisfies(userRole: Role | null | undefined, minRole: Role): boolean {
  if (!userRole) return false;
  return ROLE_RANK[userRole] >= ROLE_RANK[minRole];
}
