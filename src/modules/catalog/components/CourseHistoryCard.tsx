import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { PersonRefDto } from "@api/generated/model";
import { Card } from "@shared/ui";

import { formatDate } from "../lib/format-date";
import { DetailField } from "./DetailField";
import { EmptyValue } from "./EmptyValue";

export interface CourseHistoryCardProps {
  /** `null` when the person who created the course was removed. */
  createdBy: PersonRefDto | null;
  /** When the course was archived; `null` while it is active (RN-27). */
  archivedAt: string | null;
  /** The reason given when it was archived; `null` when none was given. */
  archiveReason: string | null;
}

/**
 * "Catálogo e histórico": who created the course and, for an archived course, when it was
 * archived and why (GUS-139). A reason that was not given shows "Não informado".
 */
export function CourseHistoryCard({
  createdBy,
  archivedAt,
  archiveReason,
}: CourseHistoryCardProps): ReactElement {
  const { t, i18n } = useTranslation("catalog");

  return (
    <Card title={t("course.history.title")}>
      <dl className="flex flex-col gap-4">
        <DetailField label={t("course.history.createdBy")}>
          {createdBy === null ? <EmptyValue /> : createdBy.name}
        </DetailField>
        {archivedAt !== null ? (
          <>
            <DetailField label={t("course.history.archivedAt")}>
              {formatDate(archivedAt, i18n.language)}
            </DetailField>
            <DetailField label={t("course.history.archiveReason")}>
              {archiveReason ?? t("course.notInformed")}
            </DetailField>
          </>
        ) : null}
      </dl>
    </Card>
  );
}
