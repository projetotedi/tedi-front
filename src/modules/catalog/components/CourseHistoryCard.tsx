import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { PersonRefDto } from "@api/generated/model";
import { Card } from "@shared/ui";

import { DetailField } from "./DetailField";
import { EmptyValue } from "./EmptyValue";

export interface CourseHistoryCardProps {
  /** `null` when the person who created the course was removed. */
  createdBy: PersonRefDto | null;
}

/** "Catálogo e histórico": who created the course. Only a label and a value. */
export function CourseHistoryCard({ createdBy }: CourseHistoryCardProps): ReactElement {
  const { t } = useTranslation("catalog");

  return (
    <Card title={t("course.history.title")}>
      <dl>
        <DetailField label={t("course.history.createdBy")}>
          {createdBy === null ? <EmptyValue /> : createdBy.name}
        </DetailField>
      </dl>
    </Card>
  );
}
