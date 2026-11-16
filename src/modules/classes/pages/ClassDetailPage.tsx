import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { useGetClass } from "@api/generated/classes/classes";
import type { ClassDetailDto } from "@api/generated/model";
import { Alert, Button, Card, Skeleton } from "@shared/ui";

import { ClassDataCard } from "../components/ClassDataCard";
import { ClassDetailHeader } from "../components/ClassDetailHeader";
import { ClassSummaryCard } from "../components/ClassSummaryCard";
import { ComingSoonCard } from "../components/ComingSoonCard";
import { CourseOriginCard } from "../components/CourseOriginCard";
import { EnrolledStudentsCard } from "../components/EnrolledStudentsCard";
import { isClassId, isClassNotFound } from "../lib/class-detail";
import { LINK_CLASSES } from "../components/link-classes";

/**
 * The two columns start at 90rem (1440px, the width of the Figma), as in the screen of a course. The
 * data card has four fields to a row and the side column is 27.5rem wide, so below that width the
 * cards stack in one column and the fields have the whole width instead of breaking in the middle
 * of a word.
 */
const TWO_COLUMNS = "grid grid-cols-1 gap-5 min-[90rem]:grid-cols-[minmax(0,1fr)_27.5rem]";

function ClassDetailSkeleton({ label }: { label: string }): ReactElement {
  return (
    <div role="status" className="flex flex-col gap-5">
      <p className="sr-only">{label}</p>
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className={TWO_COLUMNS}>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

/** The class does not exist, or the id cannot be one: the page says it and takes the way back to the list. */
function ClassNotFound(): ReactElement {
  const { t } = useTranslation("classes");

  return (
    <Card title={t("detail.notFoundTitle")}>
      <div className="flex flex-col items-start gap-3">
        <p className="text-base text-muted">{t("detail.notFoundDescription")}</p>
        <Link to="/classes" className={LINK_CLASSES}>
          {t("detail.backToList")}
        </Link>
      </div>
    </Card>
  );
}

/** The class that was loaded: the header and the two columns of cards. */
function ClassDetailView({ classDetail }: { classDetail: ClassDetailDto }): ReactElement {
  const { t } = useTranslation("classes");

  return (
    <div className="flex flex-col gap-5">
      <ClassDetailHeader classDetail={classDetail} />
      <div className={TWO_COLUMNS}>
        <div className="flex min-w-0 flex-col gap-5">
          <ClassDataCard classDetail={classDetail} />
          <ComingSoonCard title={t("detail.lessons.title")} />
          <EnrolledStudentsCard
            classId={classDetail.id}
            preview={classDetail.enrollmentsPreview}
            total={classDetail.enrollmentsTotal}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <ClassSummaryCard
            plannedWorkloadMinutes={classDetail.course.plannedWorkloadMinutes}
            summary={classDetail.summary}
          />
          <ComingSoonCard title={t("detail.members.title")} />
          <CourseOriginCard
            isClassArchived={classDetail.archivedAt !== null}
            course={classDetail.course}
          />
        </div>
      </div>
    </div>
  );
}

function ClassDetail({ classId }: { classId: string }): ReactElement {
  const { t } = useTranslation("classes");
  const classQuery = useGetClass(classId);
  const classDetail = classQuery.data;

  if (classQuery.isPending) return <ClassDetailSkeleton label={t("detail.loading")} />;

  if (classDetail === undefined) {
    if (isClassNotFound(classQuery.error)) return <ClassNotFound />;

    return (
      <div className="flex flex-col items-start gap-3">
        <Alert variant="error">{t("detail.loadError")}</Alert>
        <Button
          variant="secondary"
          isLoading={classQuery.isFetching}
          onPress={() => void classQuery.refetch()}
        >
          {t("detail.retry")}
        </Button>
      </div>
    );
  }

  return <ClassDetailView classDetail={classDetail} />;
}

/**
 * The screen of a class (RF-029, RF-034, RF-035). The page asks the API for one thing, `getClass`,
 * and everything on it comes from that answer: the header (name and tags), the data, the summary
 * and the first students enrolled. "Curso de origem" (`CourseOriginCard`, GUS-134) starts from the
 * course of that answer and asks for the prerequisites and the other classes of the course by
 * itself, so a failure there shows only in that card. "Aulas da turma" and "Membros alocados"
 * have no data yet and only keep their place with "Em breve". The title of the page is on the
 * topbar (`handle.title` of the route), so there is no `<h1>`.
 *
 * An id that is not a UUID cannot be a class: it is "not found" at once, with no request. The id is
 * also the `key` of the detail, so the state of one class never stays on the next one when the
 * route stays the same and the id changes. The 404 `CLASS_NOT_FOUND` (read with its code, since a
 * 404 that did not come from the API says nothing about this class) shows the page of not found;
 * any other error shows the alert with "Tentar de novo".
 */
export function ClassDetailPage(): ReactElement {
  const { classId = "" } = useParams();

  if (!isClassId(classId)) return <ClassNotFound />;

  return <ClassDetail key={classId} classId={classId} />;
}
