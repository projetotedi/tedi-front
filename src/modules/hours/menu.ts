import type { MenuItem } from "@shared/lib/menu";

/**
 * The entries of the group Horas that belong to this module, in the order of the Figma: "Banco de
 * horas" (`hours.viewOthers`: the director sees her department, the member does not see it) and
 * "Validação de horas" (`hours.review`: only the coordination). Each route asks for the same
 * permission as its item (menu and guard go together, decision 18).
 */
export const hoursMenuItems: MenuItem[] = [
  { label: "common:nav.hours", path: "/hours", permission: "hours.viewOthers", group: "hours" },
  {
    label: "common:nav.hoursReview",
    path: "/hours/review",
    permission: "hours.review",
    group: "hours",
  },
];
