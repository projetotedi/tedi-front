import type { MenuItem } from "@shared/lib/menu";

/**
 * The two entries of the "Aulas" group: the list (`LessonsPage`) and the calendar
 * (`LessonsCalendarPage`), each route with the same permission as its item (menu and guard go
 * together, decision 18).
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
