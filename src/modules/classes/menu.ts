import type { MenuItem } from "@shared/lib/menu";

export const classesMenuItems: MenuItem[] = [
  {
    label: "common:nav.classes",
    path: "/classes",
    permission: "classes.view",
    group: "classes",
  },
  {
    label: "common:nav.enrollments",
    path: "/enrollments",
    permission: "enrollments.manage",
    group: "classes",
  },
];
