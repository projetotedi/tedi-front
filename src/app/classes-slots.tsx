import { NewAssignmentButton } from "@modules/assignments";
import type { ClassesRouteSlots } from "@modules/classes";
import { ClassLessonsCard, GenerateLessonsButton, NewLessonButton } from "@modules/lessons";

/**
 * O que as telas do `classes` pedem a outros módulos. `classes` não importa `lessons` (módulo é
 * caixa fechada, e pelo domínio a aula depende da turma), então o que uma tela dele mostra que é de
 * outro módulo chega por slot, e quem compõe é o `app/`, o único lugar que conhece os dois:
 *
 * - as ações do cabeçalho da turma, na ordem do Figma: "Gerar aulas" (GUS-157), "Editar turma"
 *   (do próprio `classes`, GUS-133, que chega pronto em `editClassAction`) e "+ Nova aula"
 *   (GUS-152, que leva a turma da tela, com o curso e o período, para o diálogo). As de aulas são
 *   do `lessons` e só aparecem com `lessons.manage`; o atalho do aviso de aulas fora do período do
 *   "Gerar aulas" abre o "Editar turma" (`onEditClass`);
 * - "+ Nova alocação" (GUS-159), do `assignments`, depois de "+ Nova aula": abre o diálogo com a
 *   turma da tela já fixada, e o membro e a aula a escolher. Só aparece com `assignments.create`
 *   (diretor e coordenação). É a única entrada que o diálogo tem hoje, porque as telas que a
 *   desenham (listagem de membros, ficha do membro, detalhe da aula) ainda não existem; o slot só é
 *   pedido para turma não arquivada (RN-27), que também cobre a A11 na tela, já que a API aceita
 *   alocação em aula de turma arquivada;
 * - o card "Aulas da turma" (GUS-157), do `lessons`, pela turma da rota. A coluna Professor dele já
 *   lê o professor confirmado (`teacher`), então mostra a alocação sem recarregar.
 */
export const classesRouteSlots: ClassesRouteSlots = {
  renderLessonActions: (classDetail, { editClassAction, onEditClass }) => (
    <>
      <GenerateLessonsButton
        classId={classDetail.id}
        courseName={classDetail.course.name}
        classStartDate={classDetail.startDate}
        isClassArchived={classDetail.archivedAt !== null}
        onEditClass={onEditClass}
      />
      {editClassAction}
      <NewLessonButton
        lessonClass={{
          id: classDetail.id,
          label: classDetail.name || classDetail.code,
          courseId: classDetail.course.id,
          startDate: classDetail.startDate,
          endDate: classDetail.endDate,
        }}
      />
      <NewAssignmentButton
        lessonClass={{ id: classDetail.id, label: classDetail.name || classDetail.code }}
      />
    </>
  ),
  renderClassLessons: (classId) => <ClassLessonsCard classId={classId} />,
};
