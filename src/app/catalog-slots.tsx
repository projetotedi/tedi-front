import type { CatalogRouteSlots } from "@modules/catalog";
import { CourseClassesCard } from "@modules/classes";

/**
 * O que as telas do `catalog` pedem a outros módulos. `catalog` não importa `classes` (módulo é
 * caixa fechada), então o que uma tela dele mostra que é de outro módulo chega por slot, e quem
 * compõe é o `app/`, o único lugar que conhece os dois: o card "Turmas deste curso" é do `classes`
 * (`CourseClassesCard`) e entra no detalhe do curso pelo id da rota.
 */
export const catalogRouteSlots: CatalogRouteSlots = {
  renderCourseClasses: (courseId) => <CourseClassesCard courseId={courseId} />,
};
