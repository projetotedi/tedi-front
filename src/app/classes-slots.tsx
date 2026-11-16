import type { ClassesRouteSlots } from "@modules/classes";
import { NewLessonButton } from "@modules/lessons";

/**
 * O que as telas do `classes` pedem a outros módulos. `classes` não importa `lessons` (módulo é
 * caixa fechada, e pelo domínio a aula depende da turma), então o que uma tela dele mostra que é de
 * outro módulo chega por slot, e quem compõe é o `app/`, o único lugar que conhece os dois: o "+ Nova
 * aula" do cabeçalho da turma é do `lessons` (`NewLessonButton`, que só aparece com `lessons.manage`)
 * e leva a turma da tela, com o curso e o período, para o diálogo.
 */
export const classesRouteSlots: ClassesRouteSlots = {
  renderNewLessonAction: (classDetail) => (
    <NewLessonButton
      lessonClass={{
        id: classDetail.id,
        label: classDetail.name || classDetail.code,
        courseId: classDetail.course.id,
        startDate: classDetail.startDate,
        endDate: classDetail.endDate,
      }}
    />
  ),
};
