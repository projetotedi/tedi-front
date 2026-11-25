import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useListCourseClasses } from "@api/generated/classes/classes";
import { useGetCourse } from "@api/generated/catalog/catalog";
import { CourseStatus, type ClassCourseResponseDto } from "@api/generated/model";
import { Alert, Badge, Button, Card } from "@shared/ui";

import { otherClassesCount } from "../lib/course-options";
import { isUuid } from "../lib/ids";
import { DetailField } from "./DetailField";
import { LINK_CLASSES } from "./link-classes";
import { LoadingPlaceholder } from "./LoadingPlaceholder";

export interface CourseOriginCardProps {
  /** The class is archived (RN-27): it is not in the total of the classes of its course. */
  isClassArchived: boolean;
  /** The course of the class, as the API gives it with the class: name, category and status. */
  course: ClassCourseResponseDto;
}

/**
 * "Curso de origem": the course the class offers (RN-13), as a summary and a way to open it.
 *
 * The name, the "Arquivado" tag and the level come with the class (`ClassCourseResponseDto`), so
 * they are always there, even while the rest loads or when it fails. The prerequisites, the
 * number of lesson plans and how many other classes the course has come from two queries of the
 * card itself, `getCourse` and the first page of `listCourseClasses` (only its total is read, so
 * one item is asked for): the course card has no N+1 and a failure shows only here, with "Tentar
 * de novo". "Outras turmas" is a count, not a list (`otherClassesCount`).
 *
 * A course whose id is not a UUID (the prototype data) cannot exist for the API, so nothing is
 * asked and the card says the data is not available.
 */
export function CourseOriginCard({ isClassArchived, course }: CourseOriginCardProps): ReactElement {
  const { t } = useTranslation("classes");
  const canQuery = isUuid(course.id);
  const courseQuery = useGetCourse(course.id, { query: { enabled: canQuery } });
  const classesQuery = useListCourseClasses(
    course.id,
    { limit: 1 },
    { query: { enabled: canQuery } },
  );

  const detail = courseQuery.data;
  const classes = classesQuery.data;

  function retry() {
    if (courseQuery.isError) void courseQuery.refetch();
    if (classesQuery.isError) void classesQuery.refetch();
  }

  function renderStatus(): ReactElement | null {
    if (!canQuery) return <p className="text-base text-muted">{t("courseOrigin.unavailable")}</p>;
    if (courseQuery.isPending || classesQuery.isPending) {
      return <LoadingPlaceholder label={t("courseOrigin.loading")} />;
    }
    if (detail !== undefined && classes !== undefined) return null;

    return (
      <div className="flex flex-col items-start gap-3">
        <Alert variant="error">{t("courseOrigin.error")}</Alert>
        <Button
          variant="secondary"
          isLoading={courseQuery.isFetching || classesQuery.isFetching}
          onPress={retry}
        >
          {t("retry")}
        </Button>
      </div>
    );
  }

  const openCourse = (
    <Link
      to={`/courses/${course.id}`}
      aria-label={t("courseOrigin.openCourseLabel", { name: course.name })}
      className={LINK_CLASSES}
    >
      {t("courseOrigin.openCourse")}
      <span aria-hidden="true" className="ms-1">
        ›
      </span>
    </Link>
  );

  return (
    <Card title={t("courseOrigin.title")} aside={openCourse}>
      <div className="flex flex-col gap-5">
        <dl className="flex flex-col gap-5">
          <DetailField label={t("courseOrigin.fields.course")}>
            <span className="flex flex-wrap items-center gap-2">
              <span>{course.name}</span>
              {course.status === CourseStatus.archived ? (
                <Badge tone="neutral">{t("courseOrigin.archivedCourse")}</Badge>
              ) : null}
              <Badge tone="info">{t(`levels.${course.category}`)}</Badge>
            </span>
          </DetailField>
          {detail !== undefined && classes !== undefined ? (
            <>
              <DetailField label={t("courseOrigin.fields.prerequisites")}>
                {detail.prerequisites.length === 0
                  ? t("courseOrigin.noPrerequisites")
                  : detail.prerequisites.map((prerequisite) => prerequisite.name).join(", ")}
              </DetailField>
              <DetailField label={t("courseOrigin.fields.lessonPlans")}>
                {t("courseOrigin.lessonPlanCount", { count: detail.lessonPlanCount })}
              </DetailField>
              <DetailField label={t("courseOrigin.fields.otherClasses")}>
                {t("courseOrigin.otherClasses", {
                  count: otherClassesCount(classes.total, isClassArchived),
                })}
              </DetailField>
            </>
          ) : null}
        </dl>
        {renderStatus()}
      </div>
    </Card>
  );
}
