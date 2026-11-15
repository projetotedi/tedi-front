import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { CourseDetailDto } from "@api/generated/model";
import { formatHours } from "@shared/lib/format";
import { Badge, Card } from "@shared/ui";

export interface CourseDetailHeaderProps {
  course: CourseDetailDto;
  /** The course is archived (RN-27): the API says so, or a save was refused with 409 `COURSE_ARCHIVED`. */
  isArchived: boolean;
}

/**
 * The name of the course and its summary tags: category, status, how many lesson plans and the
 * planned workload (in hours, as the API computed it: RF-018, RN-24). The "N turmas" tag of the
 * Figma comes with the query of the classes of the course (GUS-102), and not before.
 *
 * The actions go on the right of this row, in the order of the Figma: Duplicar curso (`tertiary`,
 * GUS-117), Arquivar or Reativar curso (`danger-soft`, GUS-116), Editar curso (`secondary`, the
 * form of GUS-97) and + Nova turma (`primary`, the `classes` module). Each one is shown only with
 * `useCan`: `courses.duplicateArchive` for the first two, `courses.manage` for Editar curso and the
 * permission of the `classes` module for + Nova turma; and, for an archived course, the editing
 * ones stay turned off with the reason on the page (see `CoursePlanCard`). None of them exists
 * yet, so none is drawn, and the container of the actions is created with the first one.
 */
export function CourseDetailHeader({ course, isArchived }: CourseDetailHeaderProps): ReactElement {
  const { t } = useTranslation("catalog");

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
      </div>
    </Card>
  );
}
