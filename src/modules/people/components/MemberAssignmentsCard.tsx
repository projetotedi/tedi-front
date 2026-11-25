import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@shared/ui";

/**
 * "Alocações em aulas" (main column): the classes the member teaches or helps in, with the class,
 * the lesson, the date, the role and the status. The contract has the query
 * (`listMemberAssignments`, `GET /members/:id/assignments`), but the table and the "Ver todas"
 * link are GUS-159, so the card says the allocations are not available yet, with no table, no
 * number and no request. It does not even receive the member.
 *
 * GUS-159 gives it a `memberId` prop and the generated `useListMemberAssignments`, and everything
 * the query brings stays in here: loading, the error with "Tentar de novo", an empty list and the
 * table. The page does not know about the query, which is what keeps a failure of the allocations
 * from taking the rest of the screen down. It is a file of its own so that the PRs of this card, of
 * the entries, of the hours bank and of the attendance do not touch each other.
 */
export function MemberAssignmentsCard(): ReactElement {
  const { t } = useTranslation("people");

  return (
    <Card title={t("member.assignments.title")}>
      <p className="text-base text-muted">{t("member.assignments.unavailable")}</p>
    </Card>
  );
}
