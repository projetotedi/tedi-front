import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { MemberDetailResponseDto } from "@api/generated/model";

import { formatInstantDate } from "../lib/format";
import { DetailsCard } from "./DetailsCard";

export type MemberRecordCardProps = Pick<MemberDetailResponseDto, "reviewedBy" | "reviewedAt">;

/**
 * "Registro e permissões" (side column): who approved the registration and when, a label and a
 * short value. The contract has no author for the registration (the person fills it in by
 * herself) and no record of who changed the access profile, so the Figma's "Cadastrada por" is
 * here "Cadastro aprovado por", the reviewer (`reviewedBy`), and "Perfil de acesso alterado por"
 * is not shown: a dash there would say, with nothing to back it, that nobody changed the profile.
 *
 * `reviewedBy` is `null` when that person was deleted, and `reviewedAt` is `null` while the
 * registration is pending and for the profiles approved before the validation existed (the
 * backfill). With both, the value is "Ana Paula Torres em 01/03/2024"; with the date only, "Em
 * 01/03/2024"; with neither, the `EmptyValue`: a dash for who sees it and "Não informado" for who
 * hears it. The date is the day of the instant in the time zone of the browser, as everywhere in
 * the module (`formatInstantDate`).
 */
export function MemberRecordCard({ reviewedBy, reviewedAt }: MemberRecordCardProps): ReactElement {
  const { t, i18n } = useTranslation("people");

  let approval: string | null = reviewedBy?.name ?? null;
  if (reviewedAt !== null) {
    const date = formatInstantDate(reviewedAt, i18n.language);
    approval =
      reviewedBy === null
        ? t("member.record.approvedOn", { date })
        : t("member.record.approvedByValue", { name: reviewedBy.name, date });
  }

  return (
    <DetailsCard
      title={t("member.record.title")}
      columns={1}
      fields={[{ label: t("member.record.approvedBy"), value: approval }]}
    />
  );
}
