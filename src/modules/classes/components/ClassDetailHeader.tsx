import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { ClassDetailDto } from "@api/generated/model";
import { Badge, Card } from "@shared/ui";

import { CLASS_STATUS_LABEL_KEYS, classStatusTone } from "../lib/class-status";
import { InheritedLevelBadge } from "./InheritedLevelBadge";

export interface ClassDetailHeaderProps {
  classDetail: ClassDetailDto;
  /**
   * The actions of the class, drawn on the right of the name. They are the screen's to give: the
   * ones about the lessons belong to another module, so they arrive by slot (`ClassesRouteSlots`).
   * Without them the header is the name and the tags and nothing else.
   */
  actions?: ReactNode;
}

/**
 * The name of the class and its summary tags: status, "Arquivada" when it is archived, edition,
 * the level it inherits from the course and the seats taken. A class has a name only when someone
 * typed one (`name` is optional), so the code stands in for it. The level is the category the
 * course has now (RN-14, RF-029): the class does not keep a category of its own.
 *
 * The actions go on the right of this row, in the order of the Figma: Gerar aulas (`tertiary`,
 * GUS-157), Editar turma (`secondary`, GUS-101, with the form of GUS-133) and + Nova aula
 * (`primary`, GUS-152). Each one is shown only with `useCan`: `lessons.manage`, the permission of
 * the endpoint, for Gerar aulas and + Nova aula, and `classes.manage` for Editar turma. They go in
 * `actions`, one container, in that order. Gerar aulas and + Nova aula come from the slot of the
 * screen (they belong to the `lessons` module), and Editar turma is the screen's own, which it gives
 * the slot to put between them. The container of the actions has no size when what is in it draws
 * nothing (who cannot manage lessons nor classes).
 */
export function ClassDetailHeader({ classDetail, actions }: ClassDetailHeaderProps): ReactElement {
  const { t } = useTranslation("classes");
  const { status, archivedAt, edition, course, summary } = classDetail;

  return (
    <Card>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="text-2xl font-semibold break-words">
            {classDetail.name || classDetail.code}
          </h2>
          <ul className="flex flex-wrap gap-2">
            <li>
              <Badge tone={classStatusTone(status)}>{t(CLASS_STATUS_LABEL_KEYS[status])}</Badge>
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
              <InheritedLevelBadge category={course.category} />
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
        {actions ? <div className="flex flex-wrap gap-3 empty:hidden">{actions}</div> : null}
      </div>
    </Card>
  );
}
