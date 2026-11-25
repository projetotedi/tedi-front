import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { MemberDetailResponseDto } from "@api/generated/model";

import { formatDate, formatPhone } from "../lib/format";
import { DetailsCard } from "./DetailsCard";
import { VolunteerTermValue } from "./VolunteerTermValue";

export interface MemberDataCardProps {
  member: MemberDetailResponseDto;
}

/**
 * "Dados do membro": the registration of the member, in three columns (the Figma has four; the
 * `DetailsCard` keeps three, as in the student, so that the fields have room in the main column).
 * The fields are the ones of the Figma, in its order, and the "Função principal" that the card of
 * the task asks for and the Figma does not draw, after the department.
 *
 * A field the registration left empty shows the `EmptyValue` (the API sends `null`, never an
 * invented value): that is what the seeded coordinator, a person with no member profile, looks
 * like. The CPF is shown as the API sent it, masked (RNF-14): this route never has the whole
 * number, and the screen neither masks nor unmasks it. Dates without a time zone go through
 * `formatDate`.
 *
 * What the contract has and the card does not show: whether the access to the system is enabled
 * (`accessEnabled`), the status of the registration (`registrationStatus`) and the reason of the
 * exit (`exitReason`); the Figma does not draw them.
 */
export function MemberDataCard({ member }: MemberDataCardProps): ReactElement {
  const { t, i18n } = useTranslation(["people", "common"]);
  const locale = i18n.language;
  const { birthDate, phone, semester, role, joinedAt, exitDate, volunteerTermUrl } = member;

  return (
    <DetailsCard
      title={t("member.data.title")}
      columns={3}
      fields={[
        { label: t("member.data.fullName"), value: member.name },
        { label: t("member.data.birthDate"), value: birthDate && formatDate(birthDate, locale) },
        { label: t("member.data.phone"), value: phone && formatPhone(phone) },
        { label: t("member.data.personalEmail"), value: member.email },
        { label: t("member.data.address"), value: member.address },
        { label: t("member.data.city"), value: member.city },
        { label: t("member.data.state"), value: member.state },
        { label: t("member.data.ra"), value: member.ra },
        { label: t("member.data.department"), value: member.department?.name },
        { label: t("member.data.mainFunction"), value: member.mainFunction },
        { label: t("member.data.course"), value: member.course },
        { label: t("member.data.className"), value: member.className },
        {
          label: t("member.data.semester"),
          value: semester === null ? null : t("member.data.semesterValue", { count: semester }),
        },
        { label: t("member.data.institutionalEmail"), value: member.institutionalEmail },
        { label: t("member.data.cpf"), value: member.cpfMasked },
        {
          label: t("member.data.volunteerTerm"),
          // `null` (and an empty text) is "no value": the card shows the dash, not an empty box.
          value: volunteerTermUrl && <VolunteerTermValue url={volunteerTermUrl} />,
        },
        { label: t("member.data.role"), value: role === null ? null : t(`common:roles.${role}`) },
        { label: t("member.data.status"), value: t(`member.status.${member.status}`) },
        { label: t("member.data.joinedAt"), value: joinedAt && formatDate(joinedAt, locale) },
        { label: t("member.data.exitDate"), value: exitDate && formatDate(exitDate, locale) },
      ]}
    />
  );
}
