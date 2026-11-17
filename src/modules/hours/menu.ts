import type { MenuItem } from "@shared/lib/menu";

/**
 * The entries of the group Horas that belong to this module: "Banco de horas" (`hours.viewOthers`:
 * the director sees her department, the member does not see it). The route behind it asks for the
 * same permission as the item (menu and guard go together, decision 18).
 */
export const hoursMenuItems: MenuItem[] = [
  { label: "common:nav.hours", path: "/hours", permission: "hours.viewOthers", group: "hours" },
];
