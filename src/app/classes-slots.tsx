import type { ClassesRouteSlots } from "@modules/classes";
import { ClassLessonsCard, GenerateLessonsButton } from "@modules/lessons";

/**
 * O que as telas do `classes` pedem a outros módulos. `classes` não importa `lessons` (módulo é
 * caixa fechada, e a dependência de domínio vai de `lessons` para a turma), então o que uma tela
 * dele mostra que é de outro módulo chega por slot, e quem compõe é o `app/`, o único lugar que
 * conhece os dois: as ações de aulas do cabeçalho da turma (Gerar aulas) e o card "Aulas da turma"
 * são do `lessons`, e entram no detalhe da turma pela turma da rota.
 *
 * `onEditClass` do `GenerateLessonsButton` ainda não é passado: o detalhe da turma não tem
 * "Editar turma" (GUS-101, com o formulário da GUS-133, que ainda é o de exemplo). Quando existir,
 * ele entra aqui, e o aviso das aulas fora do período passa a oferecer o atalho.
 */
export const classesRouteSlots: ClassesRouteSlots = {
  renderLessonActions: (classDetail) => (
    <GenerateLessonsButton
      classId={classDetail.id}
      courseName={classDetail.course.name}
      classStartDate={classDetail.startDate}
      isClassArchived={classDetail.archivedAt !== null}
    />
  ),
  renderClassLessons: (classId) => <ClassLessonsCard classId={classId} />,
};
