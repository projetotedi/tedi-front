import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { StudentDetailDto } from "@api/generated/model";

import { formatDate, formatInstantDate, formatPhone } from "../lib/format";
import { DetailsCard } from "./DetailsCard";

export interface StudentPersonalCardProps {
  student: StudentDetailDto;
}

/**
 * "Dados pessoais": the twelve fields of the Figma, in its order, in three columns. A field the
 * registration left empty shows the `EmptyValue` (the API sends `null`, never an invented value),
 * and a yes/no field that is `null` is "not informed", not "Não". The age is the one the API
 * computed, in the time zone of the project, and not one worked out on the screen from the birth
 * date.
 *
 * "Cadastrada por" says who registered the student and when. The API sends `createdBy: null` when
 * that person was deleted, and then only the date is left ("Em 18/02/2026").
 */
export function StudentPersonalCard({ student }: StudentPersonalCardProps): ReactElement {
  const { t, i18n } = useTranslation("people");
  const locale = i18n.language;
  const { emergencyContact, createdBy } = student;

  const yesNo = (value: boolean | null) =>
    value === null ? null : t(value ? "student.yes" : "student.no");
  const createdOn = formatInstantDate(student.createdAt, locale);
  const registeredBy =
    createdBy === null
      ? t("student.personal.registeredOn", { date: createdOn })
      : t("student.personal.registeredByValue", { name: createdBy.name, date: createdOn });

  return (
    <DetailsCard
      title={t("student.personal.title")}
      columns={3}
      fields={[
        { label: t("student.personal.fullName"), value: student.name },
        {
          label: t("student.personal.birthDate"),
          value: formatDate(student.birthDate, locale),
        },
        { label: t("student.personal.age"), value: t("student.ageValue", { count: student.age }) },
        { label: t("student.personal.phone"), value: student.phone && formatPhone(student.phone) },
        { label: t("student.personal.email"), value: student.email },
        { label: t("student.personal.education"), value: student.education },
        { label: t("student.personal.hasSmartphone"), value: yesNo(student.hasSmartphone) },
        { label: t("student.personal.hasComputer"), value: yesNo(student.hasComputer) },
        { label: t("student.personal.howFoundUs"), value: student.howFoundUs },
        { label: t("student.personal.emergencyContactName"), value: emergencyContact.name },
        {
          label: t("student.personal.emergencyContactPhone"),
          value: emergencyContact.phone && formatPhone(emergencyContact.phone),
        },
        { label: t("student.personal.registeredBy"), value: registeredBy },
      ]}
    />
  );
}
