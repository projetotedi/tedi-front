import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { LessonStatus, type LessonResponseDto } from "@api/generated/model";
import { useCan } from "@modules/auth";
import { Button } from "@shared/ui";

import { CancelLessonDialog } from "./CancelLessonDialog";
import { LessonFormDialog } from "./LessonFormDialog";
import { RescheduleLessonDialog } from "./RescheduleLessonDialog";

export interface LessonDetailActionsProps {
  lesson: LessonResponseDto;
}

type OpenDialog = "reschedule" | "cancel" | "edit" | null;

/**
 * The actions of the screen of a lesson, in the order of the Figma: Remarcar aula (`tertiary`),
 * Cancelar aula (`danger-soft`) and Editar aula (`secondary`), each one opening its dialog. They are
 * drawn only for who can manage lessons (`lessons.manage`), only for a lesson that is not cancelled
 * (it is final: it cannot be edited or rescheduled) and only while its class is not archived (an
 * archived class is read-only, RN-27). The screen of the lesson (GUS-156) puts this next to the
 * title, and the button "Registrar chamada" comes with the attendance module.
 *
 * A dialog that is open stays on the screen even if the lesson stops allowing actions meanwhile:
 * cancelling it turns the lesson cancelled in the cache, and the dialog still has to show its toast
 * and close by itself.
 */
export function LessonDetailActions({ lesson }: LessonDetailActionsProps): ReactElement | null {
  const { t } = useTranslation("lessons");
  const canManage = useCan("lessons.manage");
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);

  const canAct =
    canManage && lesson.status !== LessonStatus.cancelled && lesson.class.archivedAt === null;
  if (!canAct && openDialog === null) return null;

  const close = () => setOpenDialog(null);

  return (
    <>
      {canAct ? (
        <div className="flex flex-wrap gap-3">
          <Button variant="tertiary" onPress={() => setOpenDialog("reschedule")}>
            {t("actions.reschedule")}
          </Button>
          <Button variant="danger-soft" onPress={() => setOpenDialog("cancel")}>
            {t("actions.cancel")}
          </Button>
          <Button variant="secondary" onPress={() => setOpenDialog("edit")}>
            {t("actions.edit")}
          </Button>
        </div>
      ) : null}
      {openDialog === "reschedule" ? (
        <RescheduleLessonDialog lessonId={lesson.id} onClose={close} />
      ) : null}
      {openDialog === "cancel" ? <CancelLessonDialog lessonId={lesson.id} onClose={close} /> : null}
      {openDialog === "edit" ? (
        <LessonFormDialog mode="edit" lessonId={lesson.id} onClose={close} />
      ) : null}
    </>
  );
}
