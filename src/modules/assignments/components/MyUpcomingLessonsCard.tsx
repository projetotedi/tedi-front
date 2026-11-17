import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useListMyAssignments } from "@api/generated/assignments/assignments";
import type { MyAssignmentResponseDto } from "@api/generated/model";
import { DataTable, type Column } from "@shared/components/DataTable";
import { Alert, Badge, Button, Card, Skeleton } from "@shared/ui";

import {
  ASSIGNMENT_STATUS_LABEL_KEYS,
  assignmentStatusTone,
  lessonLabel,
  ROLE_LABEL_KEYS,
} from "../lib/assignment-labels";
import { formatLessonDay } from "../lib/format";
import { LINK_CLASSES } from "./link-classes";

/**
 * "Minhas próximas aulas": the lessons of the member in the next four weeks, soonest first as the
 * API sends them, with the day, the time, the class, the lesson, the role and the status (Confirmada,
 * Aguardando confirmação). A declined or cancelled assignment is listed too, with its own tag, so the
 * member sees what happened to what they asked for (the Figma says they follow it here). Under the
 * table, the note that says what the list is and "Ver calendário ›", which takes to the calendar of
 * lessons.
 *
 * The read is `GET /me/assignments` with no period, the same query as the numbers on top of the page,
 * so it is one request. It asks nothing of the permission: the route is for who has
 * `assignments.manageOwn`. While it loads there are skeletons; a failed read with nothing in the
 * cache says so and offers "Tentar de novo"; a failed re-read keeps the table.
 */
export function MyUpcomingLessonsCard(): ReactElement {
  const { t, i18n } = useTranslation("assignments");
  const query = useListMyAssignments();
  const items = query.data?.items;

  const columns: Column<MyAssignmentResponseDto>[] = [
    {
      header: t("myLessons.upcoming.columns.date"),
      headerClassName: "uppercase",
      cellClassName: "whitespace-nowrap",
      render: ({ lesson }) => formatLessonDay(lesson.date, i18n.language),
    },
    {
      header: t("myLessons.upcoming.columns.time"),
      headerClassName: "uppercase",
      cellClassName: "whitespace-nowrap",
      render: ({ lesson }) => t("timeRange", { start: lesson.startTime, end: lesson.endTime }),
    },
    {
      header: t("myLessons.upcoming.columns.class"),
      headerClassName: "uppercase",
      render: ({ lesson }) => lesson.class.name,
    },
    {
      header: t("myLessons.upcoming.columns.lesson"),
      headerClassName: "uppercase",
      render: ({ lesson }) => lessonLabel(lesson, t),
    },
    {
      header: t("myLessons.upcoming.columns.role"),
      headerClassName: "uppercase",
      render: ({ role }) => t(ROLE_LABEL_KEYS[role]),
    },
    {
      header: t("myLessons.upcoming.columns.status"),
      headerClassName: "uppercase",
      render: ({ status }) => (
        <Badge tone={assignmentStatusTone(status)}>{t(ASSIGNMENT_STATUS_LABEL_KEYS[status])}</Badge>
      ),
    },
  ];

  function renderContent(): ReactElement {
    if (query.isPending) {
      return (
        <div role="status" className="flex flex-col gap-3">
          <p className="sr-only">{t("myLessons.upcoming.loading")}</p>
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      );
    }

    // A failed re-read with the agenda in the cache keeps the agenda: the error is for when there
    // is nothing to show.
    if (items === undefined) {
      return (
        <div className="flex flex-col items-start gap-3">
          <Alert variant="error">{t("myLessons.upcoming.error")}</Alert>
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

    return (
      <>
        {items.length === 0 ? (
          <p className="text-base text-muted">{t("myLessons.upcoming.empty")}</p>
        ) : (
          <DataTable
            columns={columns}
            rows={items}
            rowKey={(item) => item.id}
            caption={t("myLessons.upcoming.caption")}
          />
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-3">
          <p className="text-base text-muted">{t("myLessons.upcoming.footer")}</p>
          <Link to="/lessons/calendar" className={LINK_CLASSES}>
            {t("myLessons.upcoming.viewCalendar")}
            <span aria-hidden="true" className="ms-1">
              ›
            </span>
          </Link>
        </div>
      </>
    );
  }

  return <Card title={t("myLessons.upcoming.title")}>{renderContent()}</Card>;
}
