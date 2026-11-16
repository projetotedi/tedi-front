import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { ClassDetailDto } from "@api/generated/model";
import { DetailsCard } from "@shared/components/DetailsCard";

import { formatCalendarDate, formatInstantDate } from "../lib/format";

export interface ClassDataCardProps {
  classDetail: ClassDetailDto;
}

/**
 * "Dados da turma": the eleven fields of the Figma in its order, four to a row. A field the API
 * answers as `null` (the location) goes to the `DetailsCard` as it came and shows as a dash. The
 * level is the one of the course, and "Matriculados" counts the active enrollments. The person
 * who created the class (`createdBy`) is not on the Figma, so it is not here.
 */
export function ClassDataCard({ classDetail }: ClassDataCardProps): ReactElement {
  const { t, i18n } = useTranslation("classes");
  const { course, edition, summary } = classDetail;

  return (
    <DetailsCard
      title={t("detail.data.title")}
      columns={4}
      fields={[
        { label: t("detail.data.fields.code"), value: classDetail.code },
        { label: t("detail.data.fields.course"), value: course.name },
        { label: t("detail.data.fields.level"), value: t(`detail.category.${course.category}`) },
        { label: t("detail.data.fields.edition"), value: edition.name },
        {
          label: t("detail.data.fields.startDate"),
          value: formatCalendarDate(classDetail.startDate, i18n.language),
        },
        {
          label: t("detail.data.fields.endDate"),
          value: formatCalendarDate(classDetail.endDate, i18n.language),
        },
        { label: t("detail.data.fields.location"), value: classDetail.location },
        { label: t("detail.data.fields.status"), value: t(`detail.status.${classDetail.status}`) },
        { label: t("detail.data.fields.capacity"), value: classDetail.capacity },
        {
          label: t("detail.data.fields.enrolled"),
          value: t("detail.data.activeCount", { count: summary.enrolledCount }),
        },
        {
          label: t("detail.data.fields.createdAt"),
          value: formatInstantDate(classDetail.createdAt, i18n.language),
        },
      ]}
    />
  );
}
