import type { MenuItem } from "@shared/lib/menu";

/**
 * The two entries of the "Aulas" group. The screens behind them (list and calendar) are the next
 * tasks of the module: until then both routes show the "Em breve" page, with the same permission
 * as the item (menu and guard go together, decision 18).
 */
export const lessonsMenuItems: MenuItem[] = [
  {
    label: "common:nav.lessons",
    path: "/lessons",
    permission: "lessons.view",
    group: "lessons",
  },
  {
    label: "common:nav.calendar",
    path: "/lessons/calendar",
    permission: "lessons.view",
    group: "lessons",
  },
];
