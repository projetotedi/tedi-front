import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { LessonPlanUsageStatus, type LessonPlanDetailDto } from "@api/generated/model";
import { formatHours } from "@shared/lib/format";
import { Card } from "@shared/ui";

import { formatDate } from "../lib/format-date";
import { DetailField } from "./DetailField";

export interface LessonPlanDataCardProps {
  plan: LessonPlanDetailDto;
}

export function LessonPlanDataCard({ plan }: LessonPlanDataCardProps): ReactElement {
  const { t, i18n } = useTranslation("catalog");
  const empty = t("detail.data.empty");
  const creator = plan.createdBy?.name ?? t("detail.data.unknownPerson");

  return (
    <Card title={t("detail.data.title")}>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-6">
        <DetailField label={t("detail.data.fields.title")} className="md:col-span-6">
          {plan.title}
        </DetailField>
        <DetailField label={t("detail.data.fields.expectedDuration")} className="md:col-span-2">
          {formatHours(plan.expectedDurationMinutes)}
        </DetailField>
        <DetailField label={t("detail.data.fields.status")} className="md:col-span-2">
          {t(plan.status === LessonPlanUsageStatus.in_use ? "inUse" : "unused")}
        </DetailField>
        <DetailField label={t("detail.data.fields.contents")} className="md:col-span-6">
          <ol className="list-decimal ps-5">
            {plan.contents.map((content, index) => (
              <li key={`${index}-${content}`}>{content}</li>
            ))}
          </ol>
        </DetailField>
        <DetailField label={t("detail.data.fields.material")} className="md:col-span-6">
          {plan.materialUrl ? (
            <a
              href={plan.materialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm break-all text-sky-800 underline underline-offset-2 outline-hidden focus-visible:ring-3 focus-visible:ring-focus"
            >
              {plan.materialUrl}
              <span className="sr-only"> {t("detail.data.opensInNewTab")}</span>
            </a>
          ) : (
            empty
          )}
        </DetailField>
        <DetailField label={t("detail.data.fields.objective")} className="md:col-span-6">
          {plan.objective ?? empty}
        </DetailField>
        <DetailField label={t("detail.data.fields.createdBy")} className="md:col-span-3">
          {t("detail.data.createdByValue", {
            name: creator,
            date: formatDate(plan.createdAt, i18n.language),
          })}
        </DetailField>
        <DetailField label={t("detail.data.fields.updatedAt")} className="md:col-span-3">
          {formatDate(plan.updatedAt, i18n.language)}
        </DetailField>
      </dl>
    </Card>
  );
}
