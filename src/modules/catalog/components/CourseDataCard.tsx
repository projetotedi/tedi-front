import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { CourseDetailDto } from "@api/generated/model";
import { Card } from "@shared/ui";

import { formatDate } from "../lib/format-date";
import { DetailField } from "./DetailField";
import { EmptyValue } from "./EmptyValue";

export interface CourseDataCardProps {
  course: CourseDetailDto;
  /** The course is archived (RN-27): the API says so, or a save was refused with 409 `COURSE_ARCHIVED`. */
  isArchived: boolean;
}

/**
 * "Dados do curso": name, category, status and date of creation side by side, then the description
 * and the objective, which can be long, one to a line. A description or an objective that is empty
 * or missing shows as an empty value, not as a blank.
 */
export function CourseDataCard({ course, isArchived }: CourseDataCardProps): ReactElement {
  const { t, i18n } = useTranslation("catalog");

  return (
    <Card title={t("course.data.title")}>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-4">
        <DetailField label={t("course.data.fields.name")}>{course.name}</DetailField>
        <DetailField label={t("course.data.fields.category")}>
          {t(`category.${course.category}`)}
        </DetailField>
        <DetailField label={t("course.data.fields.status")}>
          {t(isArchived ? "course.status.archived" : "course.status.active")}
        </DetailField>
        <DetailField label={t("course.data.fields.createdAt")}>
          {formatDate(course.createdAt, i18n.language)}
        </DetailField>
        <DetailField label={t("course.data.fields.description")} className="md:col-span-4">
          {course.description || <EmptyValue />}
        </DetailField>
        <DetailField label={t("course.data.fields.objective")} className="md:col-span-4">
          {course.objective || <EmptyValue />}
        </DetailField>
      </dl>
    </Card>
  );
}
