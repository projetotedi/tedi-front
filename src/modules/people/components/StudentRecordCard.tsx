import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { PersonRefDto } from "@api/generated/model";

import { formatInstantDate } from "../lib/format";
import { DetailsCard } from "./DetailsCard";

export interface StudentRecordCardProps {
  /** `null` when the person who registered the student was deleted. */
  createdBy: PersonRefDto | null;
  /** The most recent change of the student (`date-time`). */
  updatedAt: string;
}

/**
 * "Registro" (side column): who registered the student and the date of the last change, only a
 * label and a short value, one under the other. When `createdBy` is `null` the name shows as an
 * empty value, a dash for who sees it and "Não informado" for who hears it.
 */
export function StudentRecordCard({ createdBy, updatedAt }: StudentRecordCardProps): ReactElement {
  const { t, i18n } = useTranslation("people");

  return (
    <DetailsCard
      title={t("student.record.title")}
      columns={1}
      fields={[
        { label: t("student.record.registeredBy"), value: createdBy?.name },
        {
          label: t("student.record.updatedAt"),
          value: formatInstantDate(updatedAt, i18n.language),
        },
      ]}
    />
  );
}
