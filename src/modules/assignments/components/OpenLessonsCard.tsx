import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useListOpenLessons } from "@api/generated/assignments/assignments";
import type { OpenLessonResponseDto } from "@api/generated/model";
import { DataTable, type Column } from "@shared/components/DataTable";
import { Alert, Button, Card, Skeleton } from "@shared/ui";

import { lessonLabel } from "../lib/assignment-labels";
import { formatCoverage } from "../lib/coverage";
import { formatLessonDay } from "../lib/format";

export interface OpenLessonsCardProps {
  /** Called with the lesson whose Candidatar-se was pressed. The page opens the dialog. */
  onApply: (openLesson: OpenLessonResponseDto) => void;
}

/**
 * "Aulas com vaga para candidatura (N)": the lessons that have a place the member can ask for, with
 * the day, the time, the class, the lesson, the vacancies ("Professor(a) 0 de 1 · Monitores 2 de 3")
 * and the Candidatar-se button. The lessons are the ones `GET /me/open-lessons` sends, with no
 * period: it already left out the ones where the member holds a place (pending or confirmed), so a
 * lesson they applied to leaves the list when it is read again. N is the number of lessons listed.
 *
 * Each button is named by the lesson and the day, with its visible text in the name. While the list
 * loads there are skeletons; a failed read with nothing in the cache says so and offers "Tentar de
 * novo"; a failed re-read keeps the list; with no lesson the card says there is none.
 */
export function OpenLessonsCard({ onApply }: OpenLessonsCardProps): ReactElement {
  const { t, i18n } = useTranslation("assignments");
  const query = useListOpenLessons();
  const openLessons = query.data;

  const columns: Column<OpenLessonResponseDto>[] = [
    {
      header: t("myLessons.open.columns.date"),
      headerClassName: "uppercase",
      cellClassName: "whitespace-nowrap",
      render: ({ lesson }) => formatLessonDay(lesson.date, i18n.language),
    },
    {
      header: t("myLessons.open.columns.time"),
      headerClassName: "uppercase",
      cellClassName: "whitespace-nowrap",
      render: ({ lesson }) => t("timeRange", { start: lesson.startTime, end: lesson.endTime }),
    },
    {
      header: t("myLessons.open.columns.class"),
      headerClassName: "uppercase",
      render: ({ lesson }) => lesson.class.name,
    },
    {
      header: t("myLessons.open.columns.lesson"),
      headerClassName: "uppercase",
      render: ({ lesson }) => lessonLabel(lesson, t),
    },
    {
      header: t("myLessons.open.columns.vacancies"),
      headerClassName: "uppercase",
      render: ({ coverage }) => formatCoverage(coverage, t),
    },
    {
      header: t("myLessons.open.columns.actions"),
      headerClassName: "uppercase",
      cellClassName: "whitespace-nowrap",
      render: (openLesson) => (
        <Button
          variant="primary"
          aria-label={t("myLessons.open.applyLabel", {
            lesson: lessonLabel(openLesson.lesson, t),
            day: formatLessonDay(openLesson.lesson.date, i18n.language),
          })}
          onPress={() => onApply(openLesson)}
        >
          {t("myLessons.open.apply")}
        </Button>
      ),
    },
  ];

  function renderContent(): ReactElement {
    if (query.isPending) {
      return (
        <div role="status" className="flex flex-col gap-3">
          <p className="sr-only">{t("myLessons.open.loading")}</p>
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      );
    }

    // A failed re-read with the list in the cache keeps the list: the error is for when there is
    // nothing to show.
    if (openLessons === undefined) {
      return (
        <div className="flex flex-col items-start gap-3">
          <Alert variant="error">{t("myLessons.open.error")}</Alert>
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

    if (openLessons.length === 0) {
      return <p className="text-base text-muted">{t("myLessons.open.empty")}</p>;
    }

    return (
      <DataTable
        columns={columns}
        rows={openLessons}
        rowKey={({ lesson }) => lesson.id}
        caption={t("myLessons.open.caption")}
      />
    );
  }

  return (
    <Card
      title={
        openLessons === undefined
          ? t("myLessons.open.titleWithoutCount")
          : t("myLessons.open.title", { count: openLessons.length })
      }
    >
      {renderContent()}
    </Card>
  );
}
