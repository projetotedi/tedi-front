import bookOpenIcon from "../assets/icons/book-open.svg";
import calendarIcon from "../assets/icons/calendar.svg";
import clockIcon from "../assets/icons/clock.svg";
import graduationCapIcon from "../assets/icons/graduation-cap.svg";
import personIcon from "../assets/icons/person.svg";

import { authMenuItems } from "@modules/auth";
import { classesMenuItems } from "@modules/classes";
import type { MenuGroup, MenuItem } from "@shared/lib/menu";

/**
 * Domínios do menu lateral, na ordem de exibição do Figma. Rótulo e ícone moram aqui: um
 * módulo só diz em qual `group` o seu item entra (`MenuItem.group`), sem mexer no layout.
 */
export const appMenuGroups: MenuGroup[] = [
  { id: "catalog", label: "common:nav.groups.catalog", icon: bookOpenIcon },
  { id: "classes", label: "common:nav.groups.classes", icon: graduationCapIcon },
  { id: "lessons", label: "common:nav.groups.lessons", icon: calendarIcon },
  { id: "people", label: "common:nav.groups.people", icon: personIcon },
  { id: "hours", label: "common:nav.groups.hours", icon: clockIcon },
];

/**
 * Itens do protótipo do Figma cujos módulos ainda não existem; levam à página "Em breve"
 * (rotas em `prototypeRoutes`, com o mesmo `RequirePermission` do item). Quando um módulo
 * nascer, ele exporta o próprio `<modulo>MenuItems` e substitui a linha correspondente aqui.
 * "Membros" já saiu daqui: é a tela de gestão de acessos do `auth` (GUS-87), em `authMenuItems`.
 * Calendário (`/lessons/calendar`) e Validação de horas (`/hours/review`) são caminhos
 * provisórios; o módulo dono confirma quando nascer.
 */
export const prototypeMenuItems: MenuItem[] = [
  { label: "common:nav.courses", path: "/courses", permission: "catalog.view", group: "catalog" },
  {
    label: "common:nav.lessonPlans",
    path: "/lesson-plans",
    permission: "catalog.view",
    group: "catalog",
  },
  {
    label: "common:nav.enrollments",
    path: "/enrollments",
    permission: "enrollments.manage",
    group: "classes",
  },
  { label: "common:nav.lessons", path: "/lessons", permission: "lessons.view", group: "lessons" },
  {
    label: "common:nav.calendar",
    path: "/lessons/calendar",
    permission: "lessons.view",
    group: "lessons",
  },
  { label: "common:nav.students", path: "/students", permission: "students.view", group: "people" },
  { label: "common:nav.hours", path: "/hours", permission: "hours.viewOthers", group: "hours" },
  {
    label: "common:nav.hoursReview",
    path: "/hours/review",
    permission: "hours.review",
    group: "hours",
  },
];

/**
 * Itens do menu lateral. A ordem dos grupos vem de `appMenuGroups`; dentro de cada grupo vale
 * a ordem deste array. Por isso Turmas (`classesMenuItems`) vem antes de Matrículas, e Membros
 * (`authMenuItems`) depois de Alunos, como no Figma.
 */
export const appMenuItems: MenuItem[] = [
  ...classesMenuItems,
  ...prototypeMenuItems,
  ...authMenuItems,
];
