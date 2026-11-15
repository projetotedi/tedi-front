import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@shared/ui";

/**
 * "Turmas deste curso". The contract has no query of the classes of a course yet
 * (`listCourseClasses`, GUS-102), so the card says they are not available yet, with no table, no
 * "Ver todas" and no request. It does not even receive the course.
 *
 * It is a card of its own for the day the query exists: GUS-102 gives it a `courseId` prop and
 * the generated hook, and everything the query brings stays in here: loading, the error with
 * "Tentar de novo" (so that, if only this query fails, only this card shows the error and the
 * rest of the screen keeps its data), an empty list, the table and "Ver todas as N ›". The page
 * does not know about the query, which is what keeps one failure from taking the screen down.
 */
export function CourseClassesCard(): ReactElement {
  const { t } = useTranslation("catalog");

  return (
    <Card title={t("course.classes.title")}>
      <p className="text-base text-muted">{t("course.classes.unavailable")}</p>
    </Card>
  );
}
