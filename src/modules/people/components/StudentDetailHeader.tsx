import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { AccessibilityNeed, type StudentDetailDto } from "@api/generated/model";
import { Badge, Card } from "@shared/ui";

import { STUDENT_STATUS_COLOR, studentStatusOf } from "../lib/status-colors";

export interface StudentDetailHeaderProps {
  student: StudentDetailDto;
  /**
   * The buttons of the actions area, on the right of the name. The container exists only when
   * there is something in it, so a person with no permission for any action sees no empty box.
   */
  actions?: ReactNode;
}

/**
 * The name of the student and the summary tags: status, age and, only when the student has a
 * category of accessibility, that category. The category is health data (LGPD): it shows here and
 * in its table, never in the title of the page or of the tab, which the route fixes as "Aluno".
 *
 * The "N turmas ativas" tag of the Figma comes with the enrollments (`listStudentEnrollments`,
 * GUS-108), and not before.
 *
 * The actions go on the right of this row, in the order of the Figma: Editar dados (`secondary`,
 * `students.manage`, the form of GUS-123) and Matricular em turma (`primary`, `enrollments.manage`,
 * GUS-138), plus Arquivar or Reativar (`students.archive`, GUS-123). The page passes them, each
 * one shown only with `useCan`, never by comparing the profile.
 */
export function StudentDetailHeader({ student, actions }: StudentDetailHeaderProps): ReactElement {
  const { t, i18n } = useTranslation("people");
  const status = studentStatusOf(student.archivedAt);
  const hasAccessibilityNeed = student.accessibilityNeed !== AccessibilityNeed.none;

  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="text-2xl font-semibold break-words">{student.name}</h2>
          <ul className="flex flex-wrap gap-2">
            <li>
              <Badge tone={STUDENT_STATUS_COLOR[status]}>{t(`student.status.${status}`)}</Badge>
            </li>
            <li>
              <Badge tone="neutral">{t("student.ageValue", { count: student.age })}</Badge>
            </li>
            {hasAccessibilityNeed ? (
              <li>
                <Badge tone="highlight">
                  {t("student.header.accessibility", {
                    need: t(
                      `student.accessibilityNeed.${student.accessibilityNeed}`,
                    ).toLocaleLowerCase(i18n.language),
                  })}
                </Badge>
              </li>
            ) : null}
          </ul>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </Card>
  );
}
