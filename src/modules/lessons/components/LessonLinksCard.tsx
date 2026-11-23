import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { LessonResponseDto } from "@api/generated/model";
import { DetailsCard } from "@shared/components/DetailsCard";

import { lessonClassLabel } from "../lib/lesson-detail";
import { PermissionLink } from "./PermissionLink";

export interface LessonLinksCardProps {
  lesson: LessonResponseDto;
}

/**
 * "Vínculos": what the lesson belongs to, one pair to a line (a card of the side column). The class,
 * the course and the lesson plan are links to their screens for who can open them (`classes.view`
 * and `catalog.view`, the permissions of those routes), and plain text for who cannot; the edition
 * is text, since there is no screen of an edition.
 *
 * The lesson plan says its place in the sequence of the course as "item N", with N the position the
 * plan had when the lesson was created. The "de M" of the Figma is missing on purpose: the lesson
 * does not carry the size of the sequence, and asking for it would be a second request. A lesson
 * on its own says it has no plan.
 */
export function LessonLinksCard({ lesson }: LessonLinksCardProps): ReactElement {
  const { t } = useTranslation("lessons");
  const { lessonPlan, sequenceOrder } = lesson;

  return (
    <DetailsCard
      title={t("detail.links.title")}
      columns={1}
      fields={[
        {
          label: t("detail.links.fields.class"),
          value: (
            <PermissionLink to={`/classes/${lesson.class.id}`} permission="classes.view">
              {lessonClassLabel(lesson.class)}
            </PermissionLink>
          ),
        },
        {
          label: t("detail.links.fields.course"),
          value: (
            <PermissionLink to={`/courses/${lesson.course.id}`} permission="catalog.view">
              {lesson.course.name}
            </PermissionLink>
          ),
        },
        { label: t("detail.links.fields.edition"), value: lesson.edition.name },
        {
          label: t("detail.links.fields.lessonPlan"),
          value:
            lessonPlan === null ? (
              t("detail.data.standalone")
            ) : (
              <>
                <PermissionLink to={`/lesson-plans/${lessonPlan.id}`} permission="catalog.view">
                  {lessonPlan.title}
                </PermissionLink>
                {sequenceOrder === null
                  ? null
                  : ` · ${t("detail.links.sequenceItem", { order: sequenceOrder })}`}
              </>
            ),
        },
      ]}
    />
  );
}
