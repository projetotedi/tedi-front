import type { MenuItem } from "@shared/lib/menu";

/** The catalog in the order of the Figma: Cursos (GUS-131), then Planos de aula. */
export const catalogMenuItems: MenuItem[] = [
  {
    label: "common:nav.courses",
    path: "/courses",
    permission: "catalog.view",
    group: "catalog",
  },
  {
    label: "common:nav.lessonPlans",
    path: "/lesson-plans",
    permission: "catalog.view",
    group: "catalog",
  },
];
