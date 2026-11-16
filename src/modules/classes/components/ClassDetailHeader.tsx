import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { ClassCourseResponseDto, ClassStatus } from "@api/generated/model";
import { Badge, Card } from "@shared/ui";

import { CLASS_STATUS_LABEL_KEYS, classStatusTone } from "../lib/class-status";
import { InheritedLevelBadge } from "./InheritedLevelBadge";

export interface ClassDetailHeaderProps {
  title: string;
  status: ClassStatus;
  /** The class is archived (RN-27). The status stays what it was: archiving does not change it. */
  isArchived: boolean;
  course: ClassCourseResponseDto;
}

/**
 * The name of the class and its tags: the status, "Arquivada" when it is, and the level inherited
 * from the course. The actions (edit, archive) go to the right of this row when the real detail
 * exists (GUS-104), each one under `useCan`.
 */
export function ClassDetailHeader({
  title,
  status,
  isArchived,
  course,
}: ClassDetailHeaderProps): ReactElement {
  const { t } = useTranslation("classes");

  return (
    <Card>
      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="text-2xl font-semibold break-words">{title}</h2>
        <ul className="flex flex-wrap gap-2">
          <li>
            <Badge tone={classStatusTone(status)}>{t(CLASS_STATUS_LABEL_KEYS[status])}</Badge>
          </li>
          {isArchived ? (
            <li>
              <Badge tone="neutral">{t("detail.archived")}</Badge>
            </li>
          ) : null}
          <li>
            <InheritedLevelBadge category={course.category} />
          </li>
        </ul>
      </div>
    </Card>
  );
}
