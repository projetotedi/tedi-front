import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { CourseStatus, type RelatedCourseResponseDto } from "@api/generated/model";
import { Badge, Card } from "@shared/ui";

import { DetailField } from "./DetailField";
import { EmptyValue } from "./EmptyValue";
import { LINK_CLASSES } from "./link-classes";

export interface CoursePrerequisitesCardProps {
  /** Courses required before this one, archived ones included. */
  prerequisites: RelatedCourseResponseDto[];
  /** Courses that require this one, archived ones included. */
  requiredBy: RelatedCourseResponseDto[];
}

function CourseLinks({ courses }: { courses: RelatedCourseResponseDto[] }): ReactElement {
  const { t } = useTranslation("catalog");

  if (courses.length === 0) return <EmptyValue />;

  return (
    <ul>
      {courses.map((course) => (
        <li key={course.id} className="flex flex-wrap items-center gap-x-2">
          <Link to={`/courses/${course.id}`} className={LINK_CLASSES}>
            {course.name}
          </Link>
          {course.status === CourseStatus.archived ? (
            <Badge tone="neutral">{t("archived")}</Badge>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * "Pré-requisitos": the courses required before this one and the courses that require it. Each
 * name opens that course (`/courses/:id`), with the "Arquivado" tag when it is archived, since a
 * course keeps its prerequisites after it is archived (RN-27). When there is none, the empty
 * value. Only labels and values: the rule of the prerequisite at enrollment (RF-032) is not
 * explained here.
 */
export function CoursePrerequisitesCard({
  prerequisites,
  requiredBy,
}: CoursePrerequisitesCardProps): ReactElement {
  const { t } = useTranslation("catalog");

  return (
    <Card title={t("course.prerequisites.title")}>
      <dl className="flex flex-col gap-4">
        <DetailField label={t("course.prerequisites.required")}>
          <CourseLinks courses={prerequisites} />
        </DetailField>
        <DetailField label={t("course.prerequisites.requiredBy")}>
          <CourseLinks courses={requiredBy} />
        </DetailField>
      </dl>
    </Card>
  );
}
