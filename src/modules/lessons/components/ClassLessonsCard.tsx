import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useListLessons } from "@api/generated/lessons/lessons";
import type { LessonListItemResponseDto } from "@api/generated/model";
import { useCan } from "@modules/auth";
import { DataTable, type Column } from "@shared/components/DataTable";
import { formatCalendarDate } from "@shared/lib/format";
import { Alert, Badge, Button, Card, Skeleton } from "@shared/ui";

import { LESSON_STATUS_LABEL_KEYS, lessonStatusTone } from "../lib/lesson-status";
import { LINK_CLASSES } from "./link-classes";

/** How many lessons the card lists: a preview, "Ver todas" opens the whole list of the class. */
export const CLASS_LESSONS_PREVIEW_LIMIT = 5;

export interface ClassLessonsCardProps {
  classId: string;
}

/**
 * "Aulas da turma": the first lessons of the class as a table (day, time, lesson, teacher and
 * status), with "Ver todas as N ›" taking to the lessons already filtered by the class
 * (`/lessons?classId=`). The screen of the class, in the `classes` module, is the one that shows
 * the card, but the card belongs here: the lessons are the data of this module, and the
 * composition in `app/` puts it into that screen, so `classes` never imports `lessons`.
 *
 * It asks the API by itself, once, for the first page of `GET /lessons?classId=` (the lessons of
 * an archived class are listed too when the class is asked for by its id, RN-27). The query is the
 * card's own on purpose: it is the one that Gerar aulas invalidates, so after generating the card
 * lists the lessons with no reload, and when it fails only this card shows the error, with
 * "Tentar de novo". Without `lessons.view` the card is not drawn and nothing is asked.
 *
 * The title of each lesson is a link to the screen of that lesson (`/lessons/:id`, GUS-156). The
 * teacher is the one confirmed in the lesson (`teacher`, which the API fills from the allocation of
 * members): the name when there is one, and a dash that a screen reader reads as "Não informado"
 * when there is none.
 */
export function ClassLessonsCard({ classId }: ClassLessonsCardProps): ReactElement | null {
  const { t, i18n } = useTranslation("lessons");
  const canView = useCan("lessons.view");
  const query = useListLessons(
    { classId, limit: CLASS_LESSONS_PREVIEW_LIMIT },
    { query: { enabled: canView } },
  );

  if (!canView) return null;

  const page = query.data;

  const columns: Column<LessonListItemResponseDto>[] = [
    {
      header: t("classLessons.columns.date"),
      headerClassName: "uppercase",
      cellClassName: "whitespace-nowrap",
      render: (lesson) => formatCalendarDate(lesson.date, i18n.language),
    },
    {
      header: t("classLessons.columns.time"),
      headerClassName: "uppercase",
      cellClassName: "whitespace-nowrap",
      render: (lesson) =>
        t("classLessons.timeRange", { start: lesson.startTime, end: lesson.endTime }),
    },
    {
      header: t("classLessons.columns.title"),
      headerClassName: "uppercase",
      render: (lesson) => (
        <Link to={`/lessons/${lesson.id}`} className={LINK_CLASSES}>
          {lesson.title}
        </Link>
      ),
    },
    {
      header: t("classLessons.columns.teacher"),
      headerClassName: "uppercase",
      render: (lesson) =>
        lesson.teacher === null ? (
          <>
            <span aria-hidden="true">{t("details.empty", { ns: "common" })}</span>
            <span className="sr-only">{t("details.notInformed", { ns: "common" })}</span>
          </>
        ) : (
          lesson.teacher.name
        ),
    },
    {
      header: t("classLessons.columns.status"),
      headerClassName: "uppercase",
      render: (lesson) => (
        <Badge tone={lessonStatusTone(lesson.status)}>
          {t(LESSON_STATUS_LABEL_KEYS[lesson.status])}
        </Badge>
      ),
    },
  ];

  const viewAll =
    page !== undefined && page.total > 0 ? (
      <Link
        to={`/lessons?${new URLSearchParams({ classId }).toString()}`}
        aria-label={t("classLessons.viewAllLabel", { count: page.total })}
        className={LINK_CLASSES}
      >
        {t("classLessons.viewAll", { count: page.total })}
        <span aria-hidden="true" className="ms-1">
          ›
        </span>
      </Link>
    ) : null;

  function renderContent(): ReactElement {
    if (query.isPending) {
      return (
        <div role="status" className="flex flex-col gap-3">
          <p className="sr-only">{t("classLessons.loading")}</p>
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      );
    }

    // A failed refetch with the page in the cache keeps the page: the error is for when there is
    // nothing to show.
    if (page === undefined) {
      return (
        <div className="flex flex-col items-start gap-3">
          <Alert variant="error">{t("classLessons.error")}</Alert>
          <Button
            variant="secondary"
            isLoading={query.isFetching}
            onPress={() => void query.refetch()}
          >
            {t("retry")}
          </Button>
        </div>
      );
    }

    if (page.data.length === 0) {
      return <p className="text-base text-muted">{t("classLessons.empty")}</p>;
    }

    return (
      <DataTable
        columns={columns}
        rows={page.data}
        rowKey={(lesson) => lesson.id}
        caption={t("classLessons.caption")}
      />
    );
  }

  return (
    <Card title={t("classLessons.title")} aside={viewAll}>
      {renderContent()}
    </Card>
  );
}
