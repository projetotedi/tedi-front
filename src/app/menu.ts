import bookOpenIcon from "../assets/icons/book-open.svg";
import bookmarkIcon from "../assets/icons/bookmark.svg";
import calendarIcon from "../assets/icons/calendar.svg";
import clockIcon from "../assets/icons/clock.svg";
import graduationCapIcon from "../assets/icons/graduation-cap.svg";
import personPlusIcon from "../assets/icons/person-plus.svg";
import personIcon from "../assets/icons/person.svg";

import { authMenuItems } from "@modules/auth";
import type { MenuItem } from "@shared/lib/menu";

/**
 * Itens do protótipo do Figma cujos módulos ainda não existem; levam à página "Em breve"
 * (rotas em `prototypeRoutes`, com o mesmo `RequirePermission` do item). Quando um módulo
 * nascer, ele exporta o próprio `<modulo>MenuItems` e substitui a linha correspondente aqui.
 * "Membros e Planejamento" já saiu daqui: é a tela de gestão de acessos do `auth` (GUS-87),
 * em `authMenuItems`.
 */
export const prototypeMenuItems: MenuItem[] = [
  { label: "common:nav.courses", path: "/courses", permission: "catalog.view", icon: bookOpenIcon },
  {
    label: "common:nav.lessonPlans",
    path: "/lesson-plans",
    permission: "catalog.view",
    icon: bookmarkIcon,
  },
  {
    label: "common:nav.classes",
    path: "/classes",
    permission: "classes.view",
    icon: graduationCapIcon,
  },
  {
    label: "common:nav.students",
    path: "/students",
    permission: "students.view",
    icon: personIcon,
  },
  { label: "common:nav.lessons", path: "/lessons", permission: "lessons.view", icon: calendarIcon },
  {
    label: "common:nav.enrollments",
    path: "/enrollments",
    permission: "enrollments.manage",
    icon: personPlusIcon,
  },
  // Último por ordem do Figma: "Membros e Planejamento" (authMenuItems) entra antes dele.
  { label: "common:nav.hours", path: "/hours", permission: "hours.viewOthers", icon: clockIcon },
];

/**
 * Menu lateral completo, na ordem de exibição do Figma. "Membros e Planejamento"
 * (`authMenuItems`) entra entre Matrículas e Banco de Horas, onde o desenho o posiciona —
 * por isso a inserção antes do último item de `prototypeMenuItems`, e não uma concatenação simples.
 */
export const appMenuItems: MenuItem[] = [
  ...prototypeMenuItems.slice(0, -1),
  ...authMenuItems,
  ...prototypeMenuItems.slice(-1),
];
