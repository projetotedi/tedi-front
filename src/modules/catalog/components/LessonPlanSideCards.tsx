import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { LessonPlanDetailDto } from "@api/generated/model";
import { Card } from "@shared/ui";

import { formatDate } from "../lib/format-date";
import { DetailField } from "./DetailField";

export interface LessonPlanSideCardsProps {
  plan: LessonPlanDetailDto;
}

/** The right column: how many courses a change affects, and who created and last changed the plan. */
export function LessonPlanSideCards({ plan }: LessonPlanSideCardsProps): ReactElement {
  const { t, i18n } = useTranslation("catalog");

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Card title={t("detail.beforeChange.title")}>
        <dl>
          <DetailField label={t("detail.beforeChange.affectedCourses")}>
            {plan.usedIn.length}
          </DetailField>
        </dl>
      </Card>
      <Card title={t("detail.history.title")}>
        <dl className="flex flex-col gap-4">
          <DetailField label={t("detail.data.fields.createdBy")}>
            {plan.createdBy?.name ?? t("detail.data.unknownPerson")}
          </DetailField>
          <DetailField label={t("detail.data.fields.updatedAt")}>
            {formatDate(plan.updatedAt, i18n.language)}
          </DetailField>
        </dl>
      </Card>
    </div>
  );
}
