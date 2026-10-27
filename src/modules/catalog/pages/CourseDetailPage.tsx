import { useState, type ReactElement } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useListCourseLessonPlans } from "@api/generated/catalog/catalog";
import { Alert, Button, Card, Skeleton } from "@shared/ui";

import { BuildSequenceDialog } from "../components/BuildSequenceDialog";
import { CoursePlanCard } from "../components/CoursePlanCard";
import { toSequenceErrorKind } from "../lib/course-sequence-errors";

function LoadingPlaceholder({ label }: { label: string }): ReactElement {
  return (
    <div role="status" className="flex flex-col gap-5">
      <p className="sr-only">{label}</p>
      <Skeleton className="h-80 w-full rounded-2xl" />
    </div>
  );
}

/**
 * The course, for now only its plan (RF-014, RF-016): the sequence of lesson plans and the planned
 * workload, with the dialog that builds the sequence. The API has no `getCourse` yet, so there is
 * no name, status or data of the course here; they come with the rest of the screen (the header,
 * "Dados do curso", "Turmas deste curso") when the contract does. The title of the page is on the
 * topbar (`handle.title` of the route), so there is no `<h1>`.
 *
 * Whether the course is archived is not in the sequence that the API answers either. Until
 * `getCourse` says it (`course.status`), the page learns it when the API refuses a save with 409
 * `COURSE_ARCHIVED`, and from then on Editar sequência stays turned off.
 */
export function CourseDetailPage(): ReactElement {
  const { t } = useTranslation("catalog");
  const { courseId = "" } = useParams();
  const [isEditing, setIsEditing] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const sequenceQuery = useListCourseLessonPlans(courseId);
  const sequence = sequenceQuery.data;

  if (sequenceQuery.isPending) return <LoadingPlaceholder label={t("course.loading")} />;

  if (sequence === undefined) {
    if (toSequenceErrorKind(sequenceQuery.error) === "courseNotFound") {
      return (
        <Card title={t("course.notFoundTitle")}>
          <p className="text-base text-muted">{t("course.notFoundDescription")}</p>
        </Card>
      );
    }

    return (
      <div className="flex flex-col items-start gap-3">
        <Alert variant="error">{t("course.loadError")}</Alert>
        <Button
          variant="secondary"
          isLoading={sequenceQuery.isFetching}
          onPress={() => void sequenceQuery.refetch()}
        >
          {t("retry")}
        </Button>
      </div>
    );
  }

  return (
    <>
      <CoursePlanCard
        sequence={sequence}
        isArchived={isArchived}
        onEditSequence={() => setIsEditing(true)}
      />

      {isEditing ? (
        <BuildSequenceDialog
          courseId={courseId}
          sequence={sequence}
          onClose={() => setIsEditing(false)}
          onCourseArchived={() => setIsArchived(true)}
        />
      ) : null}
    </>
  );
}
