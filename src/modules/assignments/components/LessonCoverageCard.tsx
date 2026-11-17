import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useListLessonAssignments } from "@api/generated/assignments/assignments";
import { useGetClass } from "@api/generated/classes/classes";
import { useGetLesson } from "@api/generated/lessons/lessons";
import { useCan } from "@modules/auth";
import { DetailsCard } from "@shared/components/DetailsCard";
import { Alert, Badge, Button, Card, Skeleton } from "@shared/ui";

import { countPendingApplications, findConfirmedTeacher } from "../lib/lesson-staff";

export interface LessonCoverageCardProps {
  lessonId: string;
}

/**
 * "Cobertura da aula" (F5.4, RF-050): who is in the lesson, as the card of the right column of the
 * screen of the lesson in the Figma. Four pairs of label and value:
 *
 * - **Alunos**: the students enrolled in the class of the lesson (`getClass`, `summary.enrolledCount`,
 *   F8: "8 alunos matriculados" of the Figma). A class that cannot be read leaves a dash here, and the
 *   rest of the card stays;
 * - **Professor(a)**: the confirmed teacher, taken from the assignments of the lesson (a pending one
 *   is a candidate, not the teacher), or a dash;
 * - **Monitores**: the confirmed monitors against the expected ones ("2 de 3"), or only the confirmed
 *   count when the lesson does not say how many it expects. When the coverage is below what is
 *   expected, a tag says so in words ("Abaixo do esperado"): the color alone is not the information;
 * - **Candidaturas**: the applications that wait for an answer. The link "Ver candidaturas ›" of the
 *   Figma is not drawn: the screen of the applications is GUS-161 (F9).
 *
 * The numbers are the ones the API counts, over the confirmed assignments only: the coverage of
 * `getLesson` and the list of the assignments of the lesson. The card does not cache a copy: it
 * reads the two queries that the allocation tells the cache about (`invalidateAfterAssignmentChange`),
 * so after an assignment is saved it shows the new coverage with no reload. `getLesson` is the same
 * query (and key) of the screen that hosts the card, so there is no second request for it.
 *
 * Without `lessons.view` the card is not drawn and nothing is asked. It brings its own request and its
 * own failure: while it loads it is a skeleton, and when it fails the error is the card's, with
 * "Tentar de novo", and does not take the screen that hosts it down.
 */
export function LessonCoverageCard({ lessonId }: LessonCoverageCardProps): ReactElement | null {
  const { t } = useTranslation("assignments");
  const canView = useCan("lessons.view");
  const lessonQuery = useGetLesson(lessonId, { query: { enabled: canView } });
  const assignmentsQuery = useListLessonAssignments(lessonId, { query: { enabled: canView } });
  const lesson = lessonQuery.data;
  const assignments = assignmentsQuery.data;
  // The students come from the class of the lesson, which is only known once the lesson is.
  const classQuery = useGetClass(lesson?.class.id ?? "", {
    query: { enabled: canView && lesson !== undefined },
  });

  if (!canView) return null;

  const title = t("coverage.title");

  // A failed refetch with the data in the cache keeps the data: the error is for when there is
  // nothing to show.
  if (lesson === undefined || assignments === undefined) {
    if (!lessonQuery.isError && !assignmentsQuery.isError) return <CoverageLoading title={title} />;

    return (
      <Card title={title}>
        <div className="flex flex-col items-start gap-3">
          <Alert variant="error">{t("coverage.error")}</Alert>
          <Button
            variant="secondary"
            isLoading={lessonQuery.isFetching || assignmentsQuery.isFetching}
            onPress={() => {
              if (lesson === undefined) void lessonQuery.refetch();
              if (assignments === undefined) void assignmentsQuery.refetch();
            }}
          >
            {t("retry")}
          </Button>
        </div>
      </Card>
    );
  }

  if (classQuery.isPending) return <CoverageLoading title={title} />;

  const teacher = findConfirmedTeacher(assignments);
  const { confirmed, expected } = lesson.coverage.monitors;

  return (
    <DetailsCard
      title={title}
      columns={1}
      fields={[
        // The class that cannot be read is a dash, and a class with no student is a zero.
        { label: t("coverage.students"), value: classQuery.data?.summary.enrolledCount ?? null },
        { label: t("coverage.teacher"), value: teacher?.name ?? null },
        {
          label: t("coverage.monitors"),
          value: (
            <span className="inline-flex flex-wrap items-center gap-2">
              <span>
                {expected === null
                  ? String(confirmed)
                  : t("coverage.monitorsOf", { confirmed, expected })}
              </span>
              {lesson.belowExpectedMonitors ? (
                <Badge tone="warning">{t("coverage.belowExpected")}</Badge>
              ) : null}
            </span>
          ),
        },
        { label: t("coverage.applications"), value: countPendingApplications(assignments) },
      ]}
    />
  );
}

/** The card while it loads: rows of skeleton for who sees, and the label for who does not, as a status. */
function CoverageLoading({ title }: { title: string }): ReactElement {
  const { t } = useTranslation("assignments");

  return (
    <Card title={title}>
      <div role="status" className="flex flex-col gap-3">
        <p className="sr-only">{t("coverage.loading")}</p>
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </Card>
  );
}
