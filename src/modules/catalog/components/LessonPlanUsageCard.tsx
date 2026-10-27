import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { CourseStatus, type LessonPlanUsedInItemResponseDto } from "@api/generated/model";
import { DataTable, type Column } from "@shared/components/DataTable";
import { Badge, Card } from "@shared/ui";

export interface LessonPlanUsageCardProps {
  usedIn: LessonPlanUsedInItemResponseDto[];
}

/**
 * The courses that have the plan in their sequence. There is no "Ver curso" action yet: the course
 * screen does not exist, and a link that goes nowhere would only confuse.
 */
export function LessonPlanUsageCard({ usedIn }: LessonPlanUsageCardProps): ReactElement {
  const { t } = useTranslation("catalog");

  const columns: Column<LessonPlanUsedInItemResponseDto>[] = [
    {
      header: t("detail.usage.columns.course"),
      headerClassName: "uppercase",
      render: (item) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{item.courseName}</span>
          {item.courseStatus === CourseStatus.archived ? (
            <Badge tone="neutral">{t("detail.usage.archivedCourse")}</Badge>
          ) : null}
        </span>
      ),
    },
    {
      header: t("detail.usage.columns.position"),
      headerClassName: "uppercase",
      cellClassName: "whitespace-nowrap",
      render: (item) =>
        t("detail.usage.position", { position: item.position, total: item.lessonPlanCount }),
    },
    {
      header: t("detail.usage.columns.category"),
      headerClassName: "uppercase",
      cellClassName: "whitespace-nowrap",
      render: (item) => t(`category.${item.category}`),
    },
  ];

  return (
    <Card title={t("detail.usage.title")}>
      {usedIn.length === 0 ? (
        <p className="text-base text-muted">{t("detail.usage.empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <DataTable
            columns={columns}
            rows={usedIn}
            rowKey={(item) => item.courseId}
            caption={t("detail.usage.title")}
          />
          <p className="text-sm text-muted">{t("detail.usage.note")}</p>
        </div>
      )}
    </Card>
  );
}
