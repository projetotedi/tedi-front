import bookOpenIcon from "../assets/icons/book-open.svg";
import bookmarkIcon from "../assets/icons/bookmark.svg";
import calendarIcon from "../assets/icons/calendar.svg";
import clockIcon from "../assets/icons/clock.svg";
import graduationCapIcon from "../assets/icons/graduation-cap.svg";
import personPlusIcon from "../assets/icons/person-plus.svg";
import personIcon from "../assets/icons/person.svg";
import personsIcon from "../assets/icons/persons.svg";

import { authMenuItems } from "@modules/auth";
import type { MenuItem } from "@shared/lib/menu";
import { Role } from "@shared/lib/role";

/**
 * Itens do protótipo do Figma cujos módulos ainda não existem; levam à página "Em breve"
 * (rotas em `prototypeRoutes`). Quando um módulo nascer, ele exporta o próprio
 * `<modulo>MenuItems` e substitui a linha correspondente aqui.
 * TODO: o perfil mínimo de cada área não está definido; `member` até o módulo decidir.
 */
export const prototypeMenuItems: MenuItem[] = [
  { label: "common:nav.courses", path: "/courses", minRole: Role.member, icon: bookOpenIcon },
  {
    label: "common:nav.lessonPlans",
    path: "/lesson-plans",
    minRole: Role.member,
    icon: bookmarkIcon,
  },
  { label: "common:nav.classes", path: "/classes", minRole: Role.member, icon: graduationCapIcon },
  { label: "common:nav.students", path: "/students", minRole: Role.member, icon: personIcon },
  { label: "common:nav.lessons", path: "/lessons", minRole: Role.member, icon: calendarIcon },
  {
    label: "common:nav.enrollments",
    path: "/enrollments",
    minRole: Role.member,
    icon: personPlusIcon,
  },
  { label: "common:nav.members", path: "/members", minRole: Role.member, icon: personsIcon },
  { label: "common:nav.hours", path: "/hours", minRole: Role.member, icon: clockIcon },
];

/** Menu lateral completo, na ordem de exibição. Um módulo novo entra com uma linha. */
export const appMenuItems: MenuItem[] = [...prototypeMenuItems, ...authMenuItems];
