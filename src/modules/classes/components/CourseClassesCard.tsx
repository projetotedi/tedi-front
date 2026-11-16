import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useListCourseClasses } from "@api/generated/classes/classes";
import type { CourseClassItemResponseDto } from "@api/generated/model";
import { useCan } from "@modules/auth";
import { DataTable, type Column } from "@shared/components/DataTable";
import { Alert, Badge, Button, Card, Skeleton } from "@shared/ui";

import { CLASS_STATUS_LABEL_KEYS, classStatusTone } from "../lib/class-status";
import { formatPeriod } from "../lib/format-period";
import { LINK_CLASSES } from "./link-classes";

/** How many classes the card lists: a preview, "Ver todas" opens the whole list of the course. */
export const COURSE_CLASSES_PREVIEW_LIMIT = 5;

export interface CourseClassesCardProps {
  courseId: string;
}

function LoadingPlaceholder({ label }: { label: string }): ReactElement {
  return (
    <div role="status" className="flex flex-col gap-3">
      <p className="sr-only">{label}</p>
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
  );
}

/**
 * "Turmas deste curso": the first classes of the course, as a table (class, edition, period,
 * students and status), with "Ver todas as N ›" taking to the list of classes already filtered by
 * the course (`/classes?courseId=`). It is the screen of the course that shows the card, in the
 * `catalog` module, but the card belongs here: the classes are the data of this module, and the
 * composition in `app/` is what puts it into that screen, so `catalog` never imports `classes`.
 *
 * It asks the API by itself, once, for the first page of `GET /courses/:id/classes` (the API
 * counts only the classes that are not archived). The query is the card's own on purpose: when it
 * fails, only this card shows the error, with "Tentar de novo", and the rest of the course screen
 * keeps its data. Without `classes.view` the card is not drawn and nothing is asked.
 */
export function CourseClassesCard({ courseId }: CourseClassesCardProps): ReactElement | null {
  const { t, i18n } = useTranslation("classes");
  const canView = useCan("classes.view");
  const query = useListCourseClasses(
    courseId,
    { limit: COURSE_CLASSES_PREVIEW_LIMIT },
    { query: { enabled: canView } },
  );

  if (!canView) return null;

  const page = query.data;

  const columns: Column<CourseClassItemResponseDto>[] = [
    {
      header: t("courseClasses.columns.class"),
      headerClassName: "uppercase",
      cellClassName: "py-0",
      render: (item) => (
        <Link to={`/classes/${item.id}`} className={LINK_CLASSES}>
          {item.name || item.code}
        </Link>
      ),
    },
    {
      header: t("courseClasses.columns.edition"),
      headerClassName: "uppercase",
      cellClassName: "whitespace-nowrap",
      render: (item) => item.edition.name,
    },
    {
      header: t("courseClasses.columns.period"),
      headerClassName: "uppercase",
      cellClassName: "whitespace-nowrap",
      render: (item) => formatPeriod(item.startDate, item.endDate, i18n.language),
    },
    {
      header: t("courseClasses.columns.students"),
      headerClassName: "uppercase",
      cellClassName: "whitespace-nowrap",
      render: (item) => (
        <>
          <span aria-hidden="true">{`${item.enrolledCount}/${item.capacity}`}</span>
          <span className="sr-only">
            {t("courseClasses.enrolledLabel", {
              enrolled: item.enrolledCount,
              capacity: item.capacity,
            })}
          </span>
        </>
      ),
    },
    {
      header: t("courseClasses.columns.status"),
      headerClassName: "uppercase",
      render: (item) => (
        <Badge tone={classStatusTone(item.status)}>{t(CLASS_STATUS_LABEL_KEYS[item.status])}</Badge>
      ),
    },
  ];

  const viewAll =
    page !== undefined && page.total > 0 ? (
      <Link
        to={`/classes?${new URLSearchParams({ courseId }).toString()}`}
        aria-label={t("courseClasses.viewAllLabel", { count: page.total })}
        className={LINK_CLASSES}
      >
        {t("courseClasses.viewAll", { count: page.total })}
        <span aria-hidden="true" className="ms-1">
          ›
        </span>
      </Link>
    ) : null;

  function renderContent(): ReactElement {
    if (query.isPending) return <LoadingPlaceholder label={t("courseClasses.loading")} />;

    // A failed refetch with the page in the cache keeps the page: the error is for when there is
    // nothing to show.
    if (page === undefined) {
      return (
        <div className="flex flex-col items-start gap-3">
          <Alert variant="error">{t("courseClasses.error")}</Alert>
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
      return <p className="text-base text-muted">{t("courseClasses.empty")}</p>;
    }

    return (
      <DataTable
        columns={columns}
        rows={page.data}
        rowKey={(item) => item.id}
        caption={t("courseClasses.title")}
      />
    );
  }

  return (
    <Card title={t("courseClasses.title")} aside={viewAll}>
      {renderContent()}
    </Card>
  );
}
