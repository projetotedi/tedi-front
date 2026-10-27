import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { CourseStatus, type LessonPlanUsedInItemResponseDto } from "@api/generated/model";
import { DataTable, type Column } from "@shared/components/DataTable";
import { Badge, Card } from "@shared/ui";

import { LINK_CLASSES } from "./link-classes";

export interface LessonPlanUsageCardProps {
  usedIn: LessonPlanUsedInItemResponseDto[];
}

/**
 * The courses that have the plan in their sequence. The name of each one opens its plan
 * (`/courses/:courseId`, GUS-130), the only part of the course screen that exists so far. There is
 * no "Ver curso" action: that is the whole screen of the course, with its header and its classes.
 */
export function LessonPlanUsageCard({ usedIn }: LessonPlanUsageCardProps): ReactElement {
  const { t } = useTranslation("catalog");

  const columns: Column<LessonPlanUsedInItemResponseDto>[] = [
    {
      header: t("detail.usage.columns.course"),
      headerClassName: "uppercase",
      cellClassName: "py-0",
      render: (item) => (
        <span className="flex flex-wrap items-center gap-x-2">
          <Link to={`/courses/${item.courseId}`} className={LINK_CLASSES}>
            {item.courseName}
          </Link>
          {item.courseStatus === CourseStatus.archived ? (
            <Badge tone="neutral">{t("detail.usage.archivedCourse")}</Badge>
          ) : null}
        </span>
      ),
    },
    {
      header: t("detail.usage.columns.position"),
      headerClassName: "uppercase md:whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
      render: (item) =>
        t("detail.usage.position", { position: item.position, total: item.lessonPlanCount }),
    },
    {
      header: t("detail.usage.columns.category"),
      headerClassName: "uppercase md:whitespace-nowrap",
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
