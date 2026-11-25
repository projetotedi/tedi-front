import type { ReactElement, Ref } from "react";
import { useTranslation } from "react-i18next";

import { LessonStatus, type LessonResponseDto } from "@api/generated/model";
import { DetailsCard, type DetailsField } from "@shared/components/DetailsCard";
import { formatCalendarDate } from "@shared/lib/format";

import { hasScheduleChange, lessonChangesTitleKey } from "../lib/lesson-detail";

export interface LessonChangesCardProps {
  lesson: LessonResponseDto;
  /**
   * The element that can take the focus (the card, which is not in the order of Tab). The screen
   * moves the focus here when the lesson is cancelled: the button that opened the dialog is turned
   * off by then, and this card is the news.
   */
  focusRef?: Ref<HTMLDivElement>;
}

/**
 * "Remarcação", "Cancelamento" or "Remarcação e cancelamento": what happened to the schedule of the
 * lesson, drawn only when something did (`hasScheduleChange`). A lesson that was never rescheduled
 * nor cancelled has no such card.
 *
 * - A rescheduled lesson (`originalDate` is set) shows the original date, which the API keeps through
 *   every later reschedule (RN-20), the reason and the note of the last reschedule.
 * - A cancelled lesson shows the reason of the cancelling, which the API requires (RF-044).
 * - One that was rescheduled and then cancelled shows both.
 *
 * The card is wrapped in a named region that the screen can focus (`tabIndex={-1}`: the focus can be
 * sent here by the code but the card is not a stop of the keyboard), so a screen reader says what
 * the card is when the focus arrives.
 */
export function LessonChangesCard({
  lesson,
  focusRef,
}: LessonChangesCardProps): ReactElement | null {
  const { t, i18n } = useTranslation("lessons");

  if (!hasScheduleChange(lesson)) return null;

  const fields: DetailsField[] = [];

  if (lesson.originalDate !== null) {
    fields.push(
      {
        label: t("detail.changes.fields.originalDate"),
        value: formatCalendarDate(lesson.originalDate, i18n.language),
      },
      { label: t("detail.changes.fields.rescheduleReason"), value: lesson.rescheduleReason },
      { label: t("detail.changes.fields.rescheduleNote"), value: lesson.rescheduleNote },
    );
  }

  if (lesson.status === LessonStatus.cancelled) {
    fields.push({ label: t("detail.changes.fields.cancelReason"), value: lesson.cancelReason });
  }

  const title = t(lessonChangesTitleKey(lesson));

  return (
    <div
      ref={focusRef}
      role="region"
      aria-label={title}
      tabIndex={-1}
      className="rounded-2xl outline-hidden focus-visible:ring-3 focus-visible:ring-focus"
    >
      <DetailsCard title={title} columns={1} fields={fields} />
    </div>
  );
}
