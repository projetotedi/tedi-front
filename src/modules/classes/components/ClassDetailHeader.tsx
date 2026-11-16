import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { ClassDetailDto } from "@api/generated/model";
import { Badge, Card } from "@shared/ui";

import { CLASS_STATUS_LABEL_KEYS, classStatusTone } from "../lib/class-status";
import { InheritedLevelBadge } from "./InheritedLevelBadge";

export interface ClassDetailHeaderProps {
  classDetail: ClassDetailDto;
  /**
   * The actions of the class, on the right of the name and the tags. The screen decides which ones
   * exist and who sees them; the header only gives them a place. With none, nothing is drawn.
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
 * (`primary`, GUS-152). Each one is shown only with `useCan` (`classes.manage` for the first two,
 * `lessons.manage` for the last). Only + Nova aula exists so far, and it comes in `actions`, from
 * the slot of the screen (it belongs to the `lessons` module); Gerar aulas and Editar turma wait for
 * their own tasks (the form of the class is still the example one of the list). The container of
 * the actions has no size when what is in it draws nothing (who cannot manage lessons).
 */
export function ClassDetailHeader({ classDetail, actions }: ClassDetailHeaderProps): ReactElement {
  const { t } = useTranslation("classes");
  const { status, archivedAt, edition, course, summary } = classDetail;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
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
