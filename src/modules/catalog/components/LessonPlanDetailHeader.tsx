import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { LessonPlanUsageStatus, type LessonPlanDetailDto } from "@api/generated/model";
import { useCan } from "@modules/auth";
import { formatHours } from "@shared/lib/format";
import { Badge, Button, Card } from "@shared/ui";

export interface LessonPlanDetailHeaderProps {
  plan: LessonPlanDetailDto;
  onEdit: () => void;
  onDuplicate: () => void;
  /** The duplication is on its way: Duplicar plano shows the spinner and ignores presses. */
  isDuplicating: boolean;
  /** Id of the Editar plano button, so the page can give it the focus back. */
  editButtonId: string;
}

/**
 * Title, summary tags and, for who has `lessonPlans.manage`, the actions. Editar plano is left out
 * of an archived plan (the API refuses to edit it) and the plan gets the "Arquivado" tag. Duplicar
 * plano stays on it: the API accepts an archived plan and the copy is born active, which is how its
 * content gets back into use (RN-27). There is no delete button: plans are archived, never deleted
 * (RN-27).
 */
export function LessonPlanDetailHeader({
  plan,
  onEdit,
  onDuplicate,
  isDuplicating,
  editButtonId,
}: LessonPlanDetailHeaderProps): ReactElement {
  const { t } = useTranslation("catalog");
  const canManage = useCan("lessonPlans.manage");
  const isArchived = plan.archivedAt !== null;

  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="text-2xl font-semibold break-words">{plan.title}</h2>
          <ul className="flex flex-wrap gap-2">
            <li>
              <Badge tone="neutral">
                {t(plan.status === LessonPlanUsageStatus.in_use ? "inUse" : "unused")}
              </Badge>
            </li>
            {isArchived ? (
              <li>
                <Badge tone="neutral">{t("archived")}</Badge>
              </li>
            ) : null}
            <li>
              <Badge tone="neutral">
                {t("detail.tags.duration", {
                  duration: formatHours(plan.expectedDurationMinutes),
                })}
              </Badge>
            </li>
            {plan.usedIn.length > 0 ? (
              <li>
                <Badge tone="neutral">{t("courseCount", { count: plan.usedIn.length })}</Badge>
              </li>
            ) : null}
            {plan.materialUrl ? (
              <li>
                <Badge tone="neutral">{t("detail.tags.hasMaterial")}</Badge>
              </li>
            ) : null}
          </ul>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-3">
            {isArchived ? null : (
              <Button
                id={editButtonId}
                variant="secondary"
                isDisabled={isDuplicating}
                onPress={onEdit}
              >
                {t("detail.editPlan")}
              </Button>
            )}
            <Button variant="primary" isLoading={isDuplicating} onPress={onDuplicate}>
              {t("detail.duplicate.action")}
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
