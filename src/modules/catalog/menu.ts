import type { MenuItem } from "@shared/lib/menu";

export const catalogMenuItems: MenuItem[] = [
  {
    label: "common:nav.lessonPlans",
    path: "/lesson-plans",
    permission: "catalog.view",
    group: "catalog",
  },
];
