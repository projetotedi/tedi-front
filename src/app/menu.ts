import { authMenuItems } from "@modules/auth";
import { classesMenuItems } from "@modules/classes";
import type { MenuItem } from "@shared/lib/menu";

/**
 * Itens do protótipo do Figma cujos módulos ainda não existem; levam à página "Em breve"
 * (rotas em `prototypeRoutes`, com o mesmo `RequirePermission` do item). Quando um módulo
 * nascer, ele exporta o próprio `<modulo>MenuItems` e substitui a linha correspondente aqui.
 * "Membros e Planejamento" já saiu daqui: é a tela de gestão de acessos do `auth` (GUS-87),
 * em `authMenuItems`.
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
    label: "common:nav.students",
    path: "/students",
    permission: "students.view",
    group: "people",
  },
  { label: "common:nav.lessons", path: "/lessons", permission: "lessons.view", group: "lessons" },
  {
    label: "common:nav.enrollments",
    path: "/enrollments",
    permission: "enrollments.manage",
    group: "classes",
  },
  // Último por ordem do Figma: "Membros e Planejamento" (authMenuItems) entra antes dele.
  { label: "common:nav.hours", path: "/hours", permission: "hours.viewOthers", group: "hours" },
];

/**
 * Menu lateral completo, na ordem de exibição do Figma. "Membros e Planejamento"
 * (`authMenuItems`) entra entre Matrículas e Banco de Horas, onde o desenho o posiciona —
 * por isso a inserção antes do último item de `prototypeMenuItems`, e não uma concatenação simples.
 */
export const appMenuItems: MenuItem[] = [
  ...prototypeMenuItems.slice(0, 2),
  ...classesMenuItems,
  ...prototypeMenuItems.slice(2, -1),
  ...authMenuItems,
  ...prototypeMenuItems.slice(-1),
];
