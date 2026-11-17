import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { CourseDetailDto } from "@api/generated/model";
import { useCan } from "@modules/auth";
import { formatHours } from "@shared/lib/format";
import { Badge, Button, Card } from "@shared/ui";

export interface CourseDetailHeaderProps {
  course: CourseDetailDto;
  /** The course is archived (RN-27): the API says so, or a save was refused with 409 `COURSE_ARCHIVED`. */
  isArchived: boolean;
  /** Duplicar curso was pressed: the screen opens the dialog that names the copy. */
  onDuplicate: () => void;
  /** Arquivar curso was pressed (the course is active): the screen opens `ArchiveCourseDialog`. */
  onArchive: () => void;
  /** Reativar curso was pressed (the course is archived): the screen asks for confirmation. */
  onUnarchive: () => void;
}

/**
 * The name of the course and its summary tags: category, status, how many lesson plans and the
 * planned workload (in hours, as the API computed it: RF-018, RN-24). The "N turmas" tag of the
 * Figma comes with the query of the classes of the course (GUS-102), and not before.
 *
 * The actions go on the right of this row, in the order of the Figma: Duplicar curso (`tertiary`,
 * GUS-140), Arquivar or Reativar curso (`danger-soft`, GUS-116), Editar curso (`secondary`, the
 * form of GUS-97) and + Nova turma (`primary`, the `classes` module). Each one is shown only with
 * `useCan`: `courses.duplicateArchive` for the first two, `courses.manage` for Editar curso and the
 * permission of the `classes` module for + Nova turma; and, for an archived course, the editing
 * ones stay turned off with the reason on the page (see `CoursePlanCard`).
 *
 * Duplicar curso stays on an archived course: the API accepts it and the copy is born active,
 * which is how the content of an archived course gets back into use (RN-27). Arquivar curso
 * (GUS-139) becomes Reativar curso when the course is archived. Editar curso (GUS-129) and + Nova
 * turma do not exist here yet: when they come, they are turned off with a hint while
 * `isArchived`, as Editar sequência already is. The container of the actions is there only when
 * the person has at least one of them, so a member sees the name and the tags and nothing else.
 */
export function CourseDetailHeader({
  course,
  isArchived,
  onDuplicate,
  onArchive,
  onUnarchive,
}: CourseDetailHeaderProps): ReactElement {
  const { t } = useTranslation("catalog");
  const canDuplicate = useCan("courses.duplicateArchive");

  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="text-2xl font-semibold break-words">{course.name}</h2>
          <ul className="flex flex-wrap gap-2">
            <li>
              <Badge tone="neutral">{t(`category.${course.category}`)}</Badge>
            </li>
            <li>
              <Badge tone={isArchived ? "neutral" : "success"}>
                {t(isArchived ? "course.status.archived" : "course.status.active")}
              </Badge>
            </li>
            <li>
              <Badge tone="info">
                {t("course.header.lessonPlanCount", { count: course.lessonPlanCount })}
              </Badge>
            </li>
            <li>
              <Badge tone="highlight">
                {t("course.header.workload", {
                  duration: formatHours(course.plannedWorkloadMinutes),
                })}
              </Badge>
            </li>
          </ul>
        </div>
        {canDuplicate ? (
          <div className="flex flex-wrap gap-3">
            <Button variant="tertiary" onPress={onDuplicate}>
              {t("course.duplicate.action")}
            </Button>
            {isArchived ? (
              <Button variant="secondary" onPress={onUnarchive}>
                {t("course.unarchive.action")}
              </Button>
            ) : (
              <Button variant="danger-soft" onPress={onArchive}>
                {t("course.archive.action")}
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
