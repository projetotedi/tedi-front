import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { LessonResponseDto } from "@api/generated/model";
import { Button } from "@shared/ui";

import { useLessonAttendanceAccess } from "../hooks/useLessonAttendanceAccess";
import { scrollToAttendance } from "../lib/roll-call";

export interface RegisterAttendanceButtonProps {
  lesson: LessonResponseDto;
}

/** "Registrar chamada", in the header of a lesson, for whoever takes its roll call. */
export function RegisterAttendanceButton({
  lesson,
}: RegisterAttendanceButtonProps): ReactElement | null {
  const { t } = useTranslation("attendance");
  const { canTakeStudents } = useLessonAttendanceAccess(lesson);

  if (!canTakeStudents) return null;

  return (
    <Button variant="primary" onPress={scrollToAttendance}>
      {t("register")}
    </Button>
  );
}
