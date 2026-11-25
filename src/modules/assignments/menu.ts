import type { MenuItem } from "@shared/lib/menu";

/**
 * The entry of the "Aulas" group that belongs to this module: "Minhas aulas", the agenda of the
 * member. Every profile has the permission (`assignments.manageOwn`), so every profile sees it, and
 * the route behind it asks for the same permission as the item (menu and guard go together,
 * decision 18). It comes after Calendário, which `lessons` declares.
 */
export const assignmentsMenuItems: MenuItem[] = [
  {
    label: "common:nav.myLessons",
    path: "/my-lessons",
    permission: "assignments.manageOwn",
    group: "lessons",
  },
];
