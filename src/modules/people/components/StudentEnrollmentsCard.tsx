import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@shared/ui";

/**
 * "Matrículas". The contract has no query of the enrollments of a student yet
 * (`listStudentEnrollments`, GUS-108), so the card says they are not available yet, with no table
 * and no request. It does not even receive the student.
 *
 * It is a card of its own for the day the query exists: GUS-108 gives it a `studentId` prop and
 * the generated `useListStudentEnrollments`, and everything the query brings stays in here:
 * loading, the error with "Tentar de novo", an empty list and the table (class, course, edition,
 * status and attendance). The page does not know about the query, which is what keeps a failure of
 * the enrollments from taking the rest of the screen down: only the cards that read them show the
 * error (CA1 of GUS-124). `StudentSummaryCard` and `CourseHistoryCard` read the same query the same
 * way, and the cache serves all three with one request.
 */
export function StudentEnrollmentsCard(): ReactElement {
  const { t } = useTranslation("people");

  return (
    <Card title={t("student.enrollments.title")}>
      <p className="text-base text-muted">{t("student.enrollments.unavailable")}</p>
    </Card>
  );
}
