import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@shared/ui";

/**
 * "Histórico de cursos" (side column): the courses of the student and the status of each one, and
 * nothing else. There is no level column, on purpose (CA2 of GUS-124). Like the other cards that
 * read the enrollments, it has nothing to show until `listStudentEnrollments` exists (GUS-108), so
 * it says the history is not available yet, with no table and no request.
 *
 * GUS-108 puts the query inside this card, with its own loading and error, and turns the status of
 * each course into a chip (Concluído, Cursando).
 */
export function CourseHistoryCard(): ReactElement {
  const { t } = useTranslation("people");

  return (
    <Card title={t("student.courseHistory.title")}>
      <p className="text-base text-muted">{t("student.courseHistory.unavailable")}</p>
    </Card>
  );
}
