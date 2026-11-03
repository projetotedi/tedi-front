import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { LessonPlanUsageStatus, type LessonPlanDetailDto } from "@api/generated/model";
import { useCan } from "@modules/auth";
import { formatHours } from "@shared/lib/format";
import { Badge, Button, Card } from "@shared/ui";

export interface LessonPlanDetailHeaderProps {
  plan: LessonPlanDetailDto;
  onEdit: () => void;
}

/**
 * Title, summary tags and the edit action. An archived plan cannot be edited (the API refuses it),
 * so it gets the "Arquivado" tag and no button. There is no "Duplicar plano" until GUS-118, and no
 * delete button at all: plans are archived, never deleted (RN-27).
 */
export function LessonPlanDetailHeader({
  plan,
  onEdit,
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
        {canManage && !isArchived ? (
          <Button variant="secondary" onPress={onEdit}>
            {t("detail.editPlan")}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
