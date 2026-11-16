import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { ClassDetailDto } from "@api/generated/model";
import { Badge, Card } from "@shared/ui";

import { CLASS_STATUS_TONE } from "../lib/class-status";

export interface ClassDetailHeaderProps {
  classDetail: ClassDetailDto;
}

/**
 * The name of the class and its summary tags: status, "Arquivada" when it is archived, edition,
 * the level it inherits from the course and the seats taken. A class has a name only when someone
 * typed one (`name` is optional), so the code stands in for it. The level is the category the
 * course has now (RN-14, RF-029): the class does not keep a category of its own.
 *
 * The actions go on the right of this row, in the order of the Figma: Gerar aulas (`tertiary`,
 * GUS-157), Editar turma (`secondary`, GUS-101, with the form of GUS-133) and + Nova aula
 * (`primary`, GUS-152). Each one is shown only with `useCan` (`classes.manage` for the first two,
 * `lessons.manage` for the last). None of them exists yet: the form of the class is still the
 * example one of the list, and the lessons module has no screen. So none is drawn, and the
 * container of the actions is created with the first one.
 */
export function ClassDetailHeader({ classDetail }: ClassDetailHeaderProps): ReactElement {
  const { t } = useTranslation("classes");
  const { status, archivedAt, edition, course, summary } = classDetail;

  return (
    <Card>
      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="text-2xl font-semibold break-words">
          {classDetail.name || classDetail.code}
        </h2>
        <ul className="flex flex-wrap gap-2">
          <li>
            <Badge tone={CLASS_STATUS_TONE[status]}>{t(`detail.status.${status}`)}</Badge>
          </li>
          {archivedAt === null ? null : (
            <li>
              <Badge tone="neutral">{t("detail.archived")}</Badge>
            </li>
          )}
          <li>
            <Badge tone="neutral">{t("detail.header.edition", { name: edition.name })}</Badge>
          </li>
          <li>
            <Badge tone="highlight">{t(`detail.header.inheritedLevel.${course.category}`)}</Badge>
          </li>
          <li>
            <Badge tone="warning">
              {t("detail.header.seats", {
                enrolled: summary.enrolledCount,
                count: summary.capacity,
              })}
            </Badge>
          </li>
        </ul>
      </div>
    </Card>
  );
}
