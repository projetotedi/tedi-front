import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { ClassDetailSummaryResponseDto } from "@api/generated/model";
import { DetailsCard } from "@shared/components/DetailsCard";
import { formatHours } from "@shared/lib/format";

import { formatPercent } from "../lib/format";

export interface ClassSummaryCardProps {
  /** The workload of the course (RF-018, RN-24): the class has none of its own. */
  plannedWorkloadMinutes: number;
  summary: ClassDetailSummaryResponseDto;
}

/**
 * "Resumo": the workload in hours as the API computed it, the lessons held out of the lessons of the
 * class, the students out of the seats and the average attendance. Only labels and short values.
 * Until the lessons module and attendance exist, the API answers `null` for the lessons and the
 * attendance, and they show as a dash. The lessons need both numbers: one without the other says
 * nothing.
 */
export function ClassSummaryCard({
  plannedWorkloadMinutes,
  summary,
}: ClassSummaryCardProps): ReactElement {
  const { t, i18n } = useTranslation("classes");
  const { lessonsDone, lessonsTotal, averageAttendance } = summary;

  return (
    <DetailsCard
      title={t("detail.summary.title")}
      fields={[
        { label: t("detail.summary.workload"), value: formatHours(plannedWorkloadMinutes) },
        {
          label: t("detail.summary.lessonsDone"),
          value:
            lessonsDone === null || lessonsTotal === null
              ? null
              : t("detail.summary.outOf", { done: lessonsDone, total: lessonsTotal }),
        },
        {
          label: t("detail.summary.students"),
          value: t("detail.summary.outOf", {
            done: summary.enrolledCount,
            total: summary.capacity,
          }),
        },
        {
          label: t("detail.summary.averageAttendance"),
          value:
            averageAttendance === null ? null : formatPercent(averageAttendance, i18n.language),
        },
      ]}
    />
  );
}
