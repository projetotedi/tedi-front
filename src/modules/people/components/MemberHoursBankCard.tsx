import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@shared/ui";

/**
 * "Banco de horas" (side column): the validated hours, the pending ones and the planning of the
 * month, each one only a label and a short value, as in the Figma. The totals come from the
 * `summary` of `getMemberHours` (`GET /members/:id/hours`), but showing them is GUS-165, so the
 * card says the hours bank is not available yet, with no "—" standing for numbers it does not
 * have and no request. It does not even receive the member.
 *
 * GUS-165 gives it a `memberId` prop and the generated `useGetMemberHours` (the same query the
 * entries of GUS-163 read, so the cache serves both with one request), and everything the query
 * brings stays in here: loading, the error with "Tentar de novo" and the values. The tag "42h30
 * aprovadas" of the header comes from the same place. It is a file of its own so that the PRs of
 * this card, of the allocations, of the entries and of the attendance do not touch each other.
 */
export function MemberHoursBankCard(): ReactElement {
  const { t } = useTranslation("people");

  return (
    <Card title={t("member.hoursBank.title")}>
      <p className="text-base text-muted">{t("member.hoursBank.unavailable")}</p>
    </Card>
  );
}
