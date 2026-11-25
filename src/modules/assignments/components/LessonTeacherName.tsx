import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useListLessonAssignments } from "@api/generated/assignments/assignments";
import { useCan } from "@modules/auth";
import { Skeleton } from "@shared/ui";

import { findConfirmedTeacher } from "../lib/lesson-staff";

export interface LessonTeacherNameProps {
  lessonId: string;
}

/**
 * The value of the field "Professor(a)" of the card "Dados da aula" (RF-047): the name of the
 * confirmed teacher of the lesson, which now comes from the allocation (before it, the field was
 * always empty). Without a confirmed teacher it is a dash that a screen reader reads as "Não
 * informado", the same as the `DetailsCard` does for a value that is missing, since the screen that
 * hosts it hands this component as the value and the card cannot see through it.
 *
 * It reads the assignments of the lesson, the same query (and key) of `LessonCoverageCard`, so the two
 * on one screen make one request and change together when an assignment is saved. While it loads it is
 * a skeleton, and when it fails it is the dash with the failure for the screen reader: the card of the
 * coverage is the one that shows the error and the retry. Without `lessons.view` nothing is asked and
 * the field is the dash.
 */
export function LessonTeacherName({ lessonId }: LessonTeacherNameProps): ReactElement {
  const { t } = useTranslation("assignments");
  const canView = useCan("lessons.view");
  const query = useListLessonAssignments(lessonId, { query: { enabled: canView } });

  if (canView && query.isPending) {
    return (
      <div role="status">
        <p className="sr-only">{t("lessonTeacher.loading")}</p>
        <Skeleton className="h-5 w-32 rounded-md" />
      </div>
    );
  }

  const teacher = query.data === undefined ? null : findConfirmedTeacher(query.data);
  if (teacher !== null) return <>{teacher.name}</>;

  return (
    <>
      <span aria-hidden="true">{t("details.empty", { ns: "common" })}</span>
      <span className="sr-only">
        {query.isError ? t("lessonTeacher.error") : t("details.notInformed", { ns: "common" })}
      </span>
    </>
  );
}
