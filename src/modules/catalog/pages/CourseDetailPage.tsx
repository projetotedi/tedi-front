import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { getGetCourseQueryKey, useGetCourse } from "@api/generated/catalog/catalog";
import { CourseStatus, type CourseDetailDto } from "@api/generated/model";
import { Alert, Button, Card, Skeleton } from "@shared/ui";

import { BuildSequenceDialog } from "../components/BuildSequenceDialog";
import { CourseClassesCard } from "../components/CourseClassesCard";
import { CourseDataCard } from "../components/CourseDataCard";
import { CourseDetailHeader } from "../components/CourseDetailHeader";
import { CourseHistoryCard } from "../components/CourseHistoryCard";
import { CoursePlanCard } from "../components/CoursePlanCard";
import { CoursePrerequisitesCard } from "../components/CoursePrerequisitesCard";
import { CourseWorkloadCard } from "../components/CourseWorkloadCard";
import { isCourseId, isCourseNotFound, toCourseSequence } from "../lib/course-detail";

/**
 * The two columns start at 90rem (1440px, the width of the Figma) and not at `xl` like the other
 * detail pages. The plan table needs about 35rem inside its card to show its six columns. With the
 * side column at 27.5rem, the cards of the main column would have 24.5rem for their content at
 * 1280px and 30rem at 1366px: the table would scroll sideways with "Abrir" out of sight, and the
 * four fields of "Dados do curso" would break in the middle of the word. Below 90rem the cards
 * stack in one column, and the table and the fields have the whole width.
 */
const TWO_COLUMNS = "grid grid-cols-1 gap-5 min-[90rem]:grid-cols-[minmax(0,1fr)_27.5rem]";

function LoadingPlaceholder({ label }: { label: string }): ReactElement {
  return (
    <div role="status" className="flex flex-col gap-5">
      <p className="sr-only">{label}</p>
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className={TWO_COLUMNS}>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-96 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    </div>
  );
}

/** There is no list of courses to go back to yet, so the page says it and stops. */
function CourseNotFound(): ReactElement {
  const { t } = useTranslation("catalog");

  return (
    <Card title={t("course.notFoundTitle")}>
      <p className="text-base text-muted">{t("course.notFoundDescription")}</p>
    </Card>
  );
}

interface CourseDetailViewProps {
  /** The id of the route, which is what the cache keys of the course are made from. */
  courseId: string;
  course: CourseDetailDto;
}

/** The course that was loaded: header, the two columns of cards and the dialog of the sequence. */
function CourseDetailView({ courseId, course }: CourseDetailViewProps): ReactElement {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [archivedBySave, setArchivedBySave] = useState(false);
  const archivedHintRef = useRef<HTMLParagraphElement>(null);
  const wasEditingRef = useRef(false);
  const sequence = useMemo(() => toCourseSequence(course), [course]);
  // The API says it (`status`), or a save was refused with 409 `COURSE_ARCHIVED` and the detail
  // that is on the screen has not been fetched again yet.
  const isArchived = course.status === CourseStatus.archived || archivedBySave;

  useEffect(() => {
    // The dialog gives the focus back to the button that opened it, but this one is off when the API
    // said the course is archived (409) while the dialog was open: the focus goes to the reason.
    if (wasEditingRef.current && !isEditing && isArchived) archivedHintRef.current?.focus();
    wasEditingRef.current = isEditing;
  }, [isEditing, isArchived]);

  function handleCourseArchived() {
    setArchivedBySave(true);
    // The header and the data say "Arquivado" with the answer of the API, not only with what the
    // refused save taught this screen.
    void queryClient.invalidateQueries({ queryKey: getGetCourseQueryKey(courseId), exact: true });
  }

  return (
    <div className="flex flex-col gap-5">
      <CourseDetailHeader course={course} isArchived={isArchived} />
      <div className={TWO_COLUMNS}>
        <div className="flex min-w-0 flex-col gap-5">
          <CourseDataCard course={course} isArchived={isArchived} />
          <CoursePlanCard
            sequence={sequence}
            isArchived={isArchived}
            onEditSequence={() => setIsEditing(true)}
            archivedHintRef={archivedHintRef}
          />
          <CourseClassesCard />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <CourseWorkloadCard
            plannedWorkloadMinutes={course.plannedWorkloadMinutes}
            lessonPlanCount={course.lessonPlanCount}
          />
          <CoursePrerequisitesCard
            prerequisites={course.prerequisites}
            requiredBy={course.requiredBy}
          />
          <CourseHistoryCard createdBy={course.createdBy} />
        </div>
      </div>

      {isEditing ? (
        <BuildSequenceDialog
          courseId={courseId}
          sequence={sequence}
          onClose={() => setIsEditing(false)}
          onCourseArchived={handleCourseArchived}
        />
      ) : null}
    </div>
  );
}

function CourseDetail({ courseId }: { courseId: string }): ReactElement {
  const { t } = useTranslation("catalog");
  const courseQuery = useGetCourse(courseId);
  const course = courseQuery.data;

  if (courseQuery.isPending) return <LoadingPlaceholder label={t("course.loading")} />;

  if (course === undefined) {
    if (isCourseNotFound(courseQuery.error)) return <CourseNotFound />;

    return (
      <div className="flex flex-col items-start gap-3">
        <Alert variant="error">{t("course.loadError")}</Alert>
        <Button
          variant="secondary"
          isLoading={courseQuery.isFetching}
          onPress={() => void courseQuery.refetch()}
        >
          {t("retry")}
        </Button>
      </div>
    );
  }

  return <CourseDetailView courseId={courseId} course={course} />;
}

/**
 * The screen of a course (RF-014, RF-016, RF-018, RF-020, RF-021). The page asks the API for one
 * thing, `getCourse`, and everything on it comes from that answer: the header (name and tags), the
 * data, the plan (the sequence of lesson plans, with the dialog that builds it), the workload, the
 * prerequisites and who created it. The sequence is not asked for apart: `toCourseSequence` gives
 * the plan card and the dialog the view of it that they read, and when a sequence is saved the
 * answer of the `PUT` is written into this same detail (`applyReplacedSequence`), so everything
 * changes together and nothing is fetched again.
 *
 * The one card that will have a query of its own is "Turmas deste curso" (`listCourseClasses`,
 * GUS-102), and it keeps the query to itself so that its failure shows only there. The title of the
 * page is on the topbar (`handle.title` of the route), so there is no `<h1>`.
 *
 * An id that is not a UUID is "not found" at once, with no request. The id is also the `key` of the
 * detail: a prerequisite opens another course on this same route, and the dialog and the notice
 * that the last save was refused as archived belong to the course that was open, not to the next.
 * When the next course is not loaded yet the loading state already throws the old view away; the
 * `key` is for when it is in the cache, and the page shows it with no loading step in between.
 */
export function CourseDetailPage(): ReactElement {
  const { courseId = "" } = useParams();

  if (!isCourseId(courseId)) return <CourseNotFound />;

  return <CourseDetail key={courseId} courseId={courseId} />;
}
