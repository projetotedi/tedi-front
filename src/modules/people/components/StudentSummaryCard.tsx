import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@shared/ui";

/**
 * "Resumo" (side column): attendance, active classes, completed courses and the date of the first
 * enrollment, each one only a label and a short value, as in the Figma. All four come from the
 * enrollments, which the contract does not offer yet (`listStudentEnrollments`, GUS-108), so the
 * card says the summary is not available yet, with no "—" standing for numbers it does not have.
 *
 * GUS-108 puts the query inside this card, with its own loading and error, like the
 * `StudentEnrollmentsCard`: an attendance of `null` shows "—" there, and the first enrollment is
 * only a date.
 */
export function StudentSummaryCard(): ReactElement {
  const { t } = useTranslation("people");

  return (
    <Card title={t("student.summary.title")}>
      <p className="text-base text-muted">{t("student.summary.unavailable")}</p>
    </Card>
  );
}
