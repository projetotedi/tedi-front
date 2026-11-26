import type { MenuItem } from "@shared/lib/menu";

export const peopleMenuItems: MenuItem[] = [
  { label: "common:nav.students", path: "/students", permission: "students.view", group: "people" },
];
