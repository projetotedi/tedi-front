import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import type { ClassDetailCourseResponseDto } from "@api/generated/model";
import { useCan } from "@modules/auth";
import { DetailsCard } from "@shared/components/DetailsCard";

import { LINK_CLASSES } from "../lib/link-classes";

export interface ClassCourseCardProps {
  course: ClassDetailCourseResponseDto;
}

/**
 * "Curso de origem": the course the class offers and how many lesson plans its sequence has, only
 * a label and a value each. "Abrir curso ›" goes to the screen of the course (`/courses/:id`,
 * which asks for `catalog.view`), so the link only shows for who can see the catalog. The
 * prerequisites and the other classes of the course of the Figma are not here: `getClass` does not
 * bring them.
 */
export function ClassCourseCard({ course }: ClassCourseCardProps): ReactElement {
  const { t } = useTranslation("classes");
  const canViewCatalog = useCan("catalog.view");

  return (
    <DetailsCard
      title={t("detail.course.title")}
      aside={
        canViewCatalog ? (
          <Link to={`/courses/${course.id}`} className={LINK_CLASSES}>
            {t("detail.course.open")}
            <span aria-hidden="true">&nbsp;›</span>
          </Link>
        ) : undefined
      }
      fields={[
        { label: t("detail.course.name"), value: course.name },
        { label: t("detail.course.lessonPlanCount"), value: course.lessonPlanCount },
      ]}
    />
  );
}
