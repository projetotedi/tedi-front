import bookOpenIcon from "../assets/icons/book-open.svg";
import calendarIcon from "../assets/icons/calendar.svg";
import clockIcon from "../assets/icons/clock.svg";
import graduationCapIcon from "../assets/icons/graduation-cap.svg";
import personIcon from "../assets/icons/person.svg";

import { assignmentsMenuItems } from "@modules/assignments";
import { authMenuItems } from "@modules/auth";
import { catalogMenuItems } from "@modules/catalog";
import { classesMenuItems } from "@modules/classes";
import { hoursMenuItems } from "@modules/hours";
import { lessonsMenuItems } from "@modules/lessons";
import { peopleMenuItems } from "@modules/people";
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
 * "Cursos" também (GUS-131): é a listagem do `catalog`, em `catalogMenuItems`.
 * Aulas e Calendário também saíram (GUS-152): são do módulo `lessons`, em `lessonsMenuItems`.
 * Minhas aulas (GUS-161) nasceu no módulo `assignments`, em `assignmentsMenuItems`.
 * Banco de horas e Validação de horas (GUS-165) são do módulo `hours`, em `hoursMenuItems`.
 * Alunos (GUS-137) é do módulo `people`, em `peopleMenuItems`.
 */
export const prototypeMenuItems: MenuItem[] = [
  {
    label: "common:nav.enrollments",
    path: "/enrollments",
    permission: "enrollments.manage",
    group: "classes",
  },
];

/**
 * Itens do menu lateral. A ordem dos grupos vem de `appMenuGroups`; dentro de cada grupo vale
 * a ordem deste array. Por isso Turmas (`classesMenuItems`) vem antes de Matrículas, Cursos e
 * Planos de aula (`catalogMenuItems`) na ordem do Figma, e Membros (`authMenuItems`) depois de Alunos,
 * como no Figma. Aulas e Calendário (`lessonsMenuItems`) já saem na ordem do Figma, e Minhas aulas
 * (`assignmentsMenuItems`) vem logo depois deles, no mesmo grupo. Banco de horas e Validação de
 * horas (`hoursMenuItems`) formam o grupo Horas, nessa ordem.
 */
export const appMenuItems: MenuItem[] = [
  ...classesMenuItems,
  ...lessonsMenuItems,
  ...assignmentsMenuItems,
  ...hoursMenuItems,
  ...prototypeMenuItems,
  ...peopleMenuItems,
  ...catalogMenuItems,
  ...authMenuItems,
];
