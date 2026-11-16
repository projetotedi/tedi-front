import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { ClassCourseResponseDto } from "@api/generated/model";
import { Card } from "@shared/ui";

import { formatPeriod } from "../lib/format-period";
import type { ClassRecord } from "../mocks/classes.mock";
import { DetailField } from "./DetailField";

export interface ClassDataCardProps {
  classRecord: ClassRecord;
  /** The course of the class: its name and its category are what the card shows of it. */
  course: ClassCourseResponseDto;
}

/**
 * "Dados da turma": code, edition, period, location, seats and the course. The level is always the
 * one of the course, so it is labelled "Nível (do curso)" and read from `course.category`, never
 * from the class: a class has no level of its own (RN-14).
 */
export function ClassDataCard({ classRecord, course }: ClassDataCardProps): ReactElement {
  const { t, i18n } = useTranslation("classes");

  return (
    <Card title={t("detail.data.title")}>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <DetailField label={t("detail.data.fields.code")}>{classRecord.code}</DetailField>
        <DetailField label={t("detail.data.fields.edition")}>{classRecord.edition}</DetailField>
        <DetailField label={t("detail.data.fields.period")}>
          {formatPeriod(classRecord.start, classRecord.end, i18n.language)}
        </DetailField>
        <DetailField label={t("detail.data.fields.location")}>
          {classRecord.location || t("detail.data.noLocation")}
        </DetailField>
        <DetailField label={t("detail.data.fields.seats")}>
          <span aria-hidden="true">{`${classRecord.enrolled}/${classRecord.capacity}`}</span>
          <span className="sr-only">
            {t("detail.data.seatsLabel", {
              enrolled: classRecord.enrolled,
              capacity: classRecord.capacity,
            })}
          </span>
        </DetailField>
        <DetailField label={t("detail.data.fields.course")}>{course.name}</DetailField>
        <DetailField label={t("detail.data.fields.level")}>
          {t(`levels.${course.category}`)}
        </DetailField>
      </dl>
    </Card>
  );
}
