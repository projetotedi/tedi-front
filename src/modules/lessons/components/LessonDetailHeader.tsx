import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { LessonResponseDto } from "@api/generated/model";
import { formatCalendarDate, formatHours } from "@shared/lib/format";
import { Badge, Card } from "@shared/ui";

import { lessonClassLabel } from "../lib/lesson-detail";
import { LESSON_STATUS_LABEL_KEYS, lessonStatusTone } from "../lib/lesson-status";

export interface LessonDetailHeaderProps {
  lesson: LessonResponseDto;
  /**
   * The actions of the lesson, drawn on the right of the title (`LessonDetailActions`). They are the
   * screen's to give. Without them the header is the title and the tags and nothing else.
   */
  actions?: ReactNode;
}

/**
 * The title of the lesson and its summary tags, in this order: status, class, course, day and time,
 * duration (calculated by the API from the start and the end, RF-039) and location, which is left
 * out when the lesson has none (a tag that only says "not informed" would be noise). The class is
 * named by its name, and by its code when it has no name.
 *
 * The actions go on the right of the title, in the order of the Figma: Remarcar aula (`tertiary`),
 * Cancelar aula (`danger-soft`) and Editar aula (`secondary`). "Registrar chamada" (`primary`) comes
 * last, with the attendance module (E6), and is not drawn today. The container of the actions has no
 * size when what is in it draws nothing (a member, who cannot manage lessons).
 */
export function LessonDetailHeader({ lesson, actions }: LessonDetailHeaderProps): ReactElement {
  const { t, i18n } = useTranslation("lessons");

  return (
    <Card>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="text-2xl font-semibold break-words">{lesson.title}</h2>
          <ul className="flex flex-wrap gap-2">
            <li>
              <Badge tone={lessonStatusTone(lesson.status)}>
                {t(LESSON_STATUS_LABEL_KEYS[lesson.status])}
              </Badge>
            </li>
            <li>
              <Badge tone="neutral">
                {t("detail.header.class", { name: lessonClassLabel(lesson.class) })}
              </Badge>
            </li>
            <li>
              <Badge tone="neutral">{lesson.course.name}</Badge>
            </li>
            <li>
              <Badge tone="neutral">
                {t("detail.header.schedule", {
                  date: formatCalendarDate(lesson.date, i18n.language),
                  start: lesson.startTime,
                  end: lesson.endTime,
                })}
              </Badge>
            </li>
            <li>
              <Badge tone="neutral">
                {t("detail.header.duration", { duration: formatHours(lesson.durationMinutes) })}
              </Badge>
            </li>
            {lesson.location ? (
              <li>
                <Badge tone="neutral">{lesson.location}</Badge>
              </li>
            ) : null}
          </ul>
        </div>
        {actions ? <div className="flex flex-wrap gap-3 empty:hidden">{actions}</div> : null}
      </div>
    </Card>
  );
}
