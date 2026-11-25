import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@shared/ui";

/**
 * "Presença" (side column): the presences, the justified absences and the schedule conflicts of
 * the member, each one only a label and a short value, as in the Figma. The contract has the
 * query (`getMemberAttendanceHistory`, `GET /members/:id/attendance`), but showing it is GUS-169,
 * so the card says the attendance is not available yet, with no "—" standing for numbers it does
 * not have and no request. It does not even receive the member.
 *
 * GUS-169 gives it a `memberId` prop and the generated `useGetMemberAttendanceHistory`, and
 * everything the query brings stays in here: loading, the error with "Tentar de novo" and the
 * values. It is a file of its own so that the PRs of this card, of the allocations, of the entries
 * and of the hours bank do not touch each other.
 */
export function MemberAttendanceCard(): ReactElement {
  const { t } = useTranslation("people");

  return (
    <Card title={t("member.attendance.title")}>
      <p className="text-base text-muted">{t("member.attendance.unavailable")}</p>
    </Card>
  );
}
