import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@shared/ui";

/**
 * "Lançamentos de horas" (main column): the hour entries of the member, with the date, the
 * category, the origin, the declared and the validated time and the status. The contract has them
 * in the answer of `getMemberHours` (`GET /members/:id/hours`, the `entries` of the page), but the
 * table, the "Ver extrato" link and the "+ Lançar horas" button are GUS-163, so the card says the
 * entries are not available yet, with no table, no number and no request. It does not even
 * receive the member.
 *
 * GUS-163 gives it a `memberId` prop and the generated `useGetMemberHours`, and everything the
 * query brings stays in here: loading, the error with "Tentar de novo", an empty list and the
 * table. The "+ Lançar horas" button (`logHoursForMember`, `hours.logForOthers`) goes to the
 * actions area of the header. The page does not know about the query, which is what keeps a failure
 * of the hours from taking the rest of the screen down. It is a file of its own so that the PRs of
 * this card, of the allocations, of the hours bank and of the attendance do not touch each other.
 */
export function MemberEntriesCard(): ReactElement {
  const { t } = useTranslation("people");

  return (
    <Card title={t("member.entries.title")}>
      <p className="text-base text-muted">{t("member.entries.unavailable")}</p>
    </Card>
  );
}
