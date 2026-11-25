import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { LessonResponseDto } from "@api/generated/model";
import { DetailsCard } from "@shared/components/DetailsCard";
import { formatCalendarDate, formatHours } from "@shared/lib/format";

import { LESSON_STATUS_LABEL_KEYS } from "../lib/lesson-status";
import { PermissionLink } from "./PermissionLink";

export interface LessonDataCardProps {
  lesson: LessonResponseDto;
}

/**
 * "Dados da aula": the thirteen fields of the card, in its order, four to a row (the subject and
 * the post-lesson notes take the whole row, because they are text). A field the API answers as
 * `null` goes to the `DetailsCard` as it came and shows as a dash, and a zero (a lesson that expects
 * no monitor) is a value.
 *
 * - The duration is the one the API calculated from the start and the end (RF-039), not summed here.
 * - "Ordem no plano do curso" is the position the plan had in the sequence when the lesson was
 *   created (`sequenceOrder`, a snapshot), and a lesson on its own has none.
 * - "Plano de aula (origem)" is a link to the plan for who can see the catalog, and says so when the
 *   plan was archived since (RN-27: it still shows on the lessons that came from it). A lesson on its
 *   own says it has no plan.
 * - "Material" is always a dash today: the reference to the plan (`LessonPlanRefDto`) has no link to
 *   the material, and asking for the plan would be a second request (the screen is one). The way to
 *   the material is the link of the plan.
 * - "Professor(a)" is a dash until the allocation of members shows on this screen (E5).
 */
export function LessonDataCard({ lesson }: LessonDataCardProps): ReactElement {
  const { t, i18n } = useTranslation("lessons");
  const { lessonPlan } = lesson;

  return (
    <DetailsCard
      title={t("detail.data.title")}
      columns={4}
      fields={[
        {
          label: t("detail.data.fields.date"),
          value: formatCalendarDate(lesson.date, i18n.language),
        },
        {
          label: t("detail.data.fields.time"),
          value: t("detail.data.timeRange", { start: lesson.startTime, end: lesson.endTime }),
        },
        { label: t("detail.data.fields.duration"), value: formatHours(lesson.durationMinutes) },
        { label: t("detail.data.fields.location"), value: lesson.location },
        {
          label: t("detail.data.fields.status"),
          value: t(LESSON_STATUS_LABEL_KEYS[lesson.status]),
        },
        {
          label: t("detail.data.fields.sequenceOrder"),
          value:
            lesson.sequenceOrder === null
              ? null
              : t("detail.data.sequenceOrder", { order: lesson.sequenceOrder }),
        },
        {
          label: t("detail.data.fields.lessonPlan"),
          value:
            lessonPlan === null ? (
              t("detail.data.standalone")
            ) : (
              <>
                <PermissionLink to={`/lesson-plans/${lessonPlan.id}`} permission="catalog.view">
                  {lessonPlan.title}
                </PermissionLink>
                {lessonPlan.archivedAt === null ? null : ` · ${t("detail.data.archivedPlan")}`}
              </>
            ),
        },
        { label: t("detail.data.fields.material"), value: null },
        { label: t("detail.data.fields.expectedStudents"), value: lesson.expectedStudents },
        { label: t("detail.data.fields.expectedMonitors"), value: lesson.expectedMonitors },
        { label: t("detail.data.fields.subject"), value: lesson.subject, fullWidth: true },
        { label: t("detail.data.fields.teacher"), value: null },
        { label: t("detail.data.fields.postNotes"), value: lesson.postNotes, fullWidth: true },
      ]}
    />
  );
}
