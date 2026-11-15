import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { formatHours } from "@shared/lib/format";
import { Card } from "@shared/ui";

import { DetailField } from "./DetailField";

export interface CourseWorkloadCardProps {
  plannedWorkloadMinutes: number;
  lessonPlanCount: number;
}

/**
 * "Carga horária prevista": the total in hours, as the API computed it (RF-018, RN-24), and how
 * many lessons a class of the course has. Each lesson plan of the sequence becomes one lesson of
 * the class, so that number is the number of plans. Only labels and values: the rule behind the
 * numbers is on the plan card.
 */
export function CourseWorkloadCard({
  plannedWorkloadMinutes,
  lessonPlanCount,
}: CourseWorkloadCardProps): ReactElement {
  const { t } = useTranslation("catalog");

  return (
    <Card title={t("course.workload.title")}>
      <dl className="flex flex-col gap-4">
        <DetailField label={t("course.workload.total")}>
          {formatHours(plannedWorkloadMinutes)}
        </DetailField>
        <DetailField label={t("course.workload.lessonsPerClass")}>{lessonPlanCount}</DetailField>
      </dl>
    </Card>
  );
}
