import type { CatalogRouteSlots } from "@modules/catalog";
import { CourseClassesCard, NewClassButton } from "@modules/classes";

/**
 * O que as telas do `catalog` pedem a outros módulos. `catalog` não importa `classes` (módulo é
 * caixa fechada), então o que uma tela dele mostra que é de outro módulo chega por slot, e quem
 * compõe é o `app/`, o único lugar que conhece os dois: o card "Turmas deste curso" é do `classes`
 * (`CourseClassesCard`) e entra no detalhe do curso pelo id da rota, e o "+ Nova turma" do
 * cabeçalho (`NewClassButton`, GUS-133) abre o formulário de turma com o curso já escolhido.
 */
export const catalogRouteSlots: CatalogRouteSlots = {
  renderCourseClasses: (courseId) => <CourseClassesCard courseId={courseId} />,
  renderNewClassAction: (course) => (
    <NewClassButton courseId={course.id} isCourseArchived={course.isArchived} />
  ),
};
