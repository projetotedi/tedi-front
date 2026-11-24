import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { LessonResponseDto } from "@api/generated/model";
import { formatCalendarDate } from "@shared/lib/format";
import { Button } from "@shared/ui";

import { useLessonAttendanceAccess } from "../hooks/useLessonAttendanceAccess";
import { scrollToAttendance } from "../lib/roll-call";

export interface PendingAttendanceAlertProps {
  lesson: LessonResponseDto;
}

/** The notice of a lesson that ended with its roll call unfinished, with the way to the card. */
export function PendingAttendanceAlert({
  lesson,
}: PendingAttendanceAlertProps): ReactElement | null {
  const { t, i18n } = useTranslation("attendance");
  const { canTakeStudents } = useLessonAttendanceAccess(lesson);

  if (!lesson.attendance.pending) return null;

  const { signed, total } = lesson.attendance.students;

  return (
    <section
      aria-label={t("pending.title")}
      className="flex flex-col gap-3 rounded-2xl bg-tedi-warning px-4 py-3.5 text-tedi-status-warning-foreground md:flex-row md:items-center md:justify-between"
    >
      <div>
        <p className="text-base font-semibold">{t("pending.title")}</p>
        <p className="text-base">
          {t("pending.description", {
            date: formatCalendarDate(lesson.date, i18n.language),
            time: lesson.endTime,
            count: total - signed,
          })}
        </p>
      </div>
      {canTakeStudents ? (
        <Button variant="primary" className="shrink-0" onPress={scrollToAttendance}>
          {t("pending.register")}
        </Button>
      ) : null}
    </section>
  );
}
