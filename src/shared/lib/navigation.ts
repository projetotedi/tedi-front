import { roleSatisfies, type Role } from "./role";

export interface NavItem {
  to: string;
  labelNs: string;
  labelKey: string;
  iconSrc: string;
  minRole?: Role;
}

export function visibleNavItems(items: NavItem[], role: Role | null): NavItem[] {
  return items.filter((item) => item.minRole === undefined || roleSatisfies(role, item.minRole));
}
