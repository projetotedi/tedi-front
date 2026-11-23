import { useId, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { LessonStatus, type LessonResponseDto } from "@api/generated/model";
import { useCan } from "@modules/auth";
import { Button } from "@shared/ui";

import { CancelLessonDialog } from "./CancelLessonDialog";
import { LessonFormDialog } from "./LessonFormDialog";
import { RescheduleLessonDialog } from "./RescheduleLessonDialog";

export interface LessonDetailActionsProps {
  lesson: LessonResponseDto;
  /**
   * Called with the lesson the API answered, when the dialog of Cancelar aula cancelled it: after the
   * toast and just before the dialog closes. The screen uses it to take the focus to what is news,
   * since the button that opened the dialog is turned off by then and cannot get the focus back.
   */
  onCancelled?: (lesson: LessonResponseDto) => void;
}

type OpenDialog = "reschedule" | "cancel" | "edit" | null;

/**
 * The actions of the screen of a lesson, in the order of the Figma: Remarcar aula (`tertiary`),
 * Cancelar aula (`danger-soft`) and Editar aula (`secondary`), each one opening its dialog. They are
 * drawn only for who can manage lessons (`lessons.manage`): a member sees none of them, not even
 * turned off. The screen of the lesson (GUS-156) puts this next to the title, and the button
 * "Registrar chamada" comes with the attendance module.
 *
 * For who can manage, the three stay on the screen when the lesson cannot be changed, turned off,
 * with the reason where a screen reader finds it (a turned-off button is not a stop of the
 * keyboard, so the reason is tied to it by `aria-describedby`, as "Editar turma" does): a cancelled
 * lesson is final (it cannot be edited, rescheduled or cancelled again), and the lessons of an
 * archived class are read-only (RN-27). A cancelled lesson in an archived class gives the first
 * reason, which is the lesson's own.
 *
 * A dialog that is open stays on the screen even if the lesson stops allowing actions meanwhile:
 * cancelling it turns the lesson cancelled in the cache, and the dialog still has to show its toast
 * and close by itself.
 */
export function LessonDetailActions({
  lesson,
  onCancelled,
}: LessonDetailActionsProps): ReactElement | null {
  const { t } = useTranslation("lessons");
  const canManage = useCan("lessons.manage");
  const hintId = useId();
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);

  if (!canManage && openDialog === null) return null;

  const disabledHintKey =
    lesson.status === LessonStatus.cancelled
      ? "actions.cancelledHint"
      : lesson.class.archivedAt !== null
        ? "actions.classArchivedHint"
        : null;
  const isDisabled = disabledHintKey !== null;
  const describedBy = isDisabled ? hintId : undefined;

  const close = () => setOpenDialog(null);

  return (
    <>
      {canManage ? (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="tertiary"
            isDisabled={isDisabled}
            aria-describedby={describedBy}
            onPress={() => setOpenDialog("reschedule")}
          >
            {t("actions.reschedule")}
          </Button>
          <Button
            variant="danger-soft"
            isDisabled={isDisabled}
            aria-describedby={describedBy}
            onPress={() => setOpenDialog("cancel")}
          >
            {t("actions.cancel")}
          </Button>
          <Button
            variant="secondary"
            isDisabled={isDisabled}
            aria-describedby={describedBy}
            onPress={() => setOpenDialog("edit")}
          >
            {t("actions.edit")}
          </Button>
          {disabledHintKey === null ? null : (
            <span id={hintId} className="sr-only">
              {t(disabledHintKey)}
            </span>
          )}
        </div>
      ) : null}
      {openDialog === "reschedule" ? (
        <RescheduleLessonDialog lessonId={lesson.id} onClose={close} />
      ) : null}
      {openDialog === "cancel" ? (
        <CancelLessonDialog lessonId={lesson.id} onClose={close} onCancelled={onCancelled} />
      ) : null}
      {openDialog === "edit" ? (
        <LessonFormDialog mode="edit" lessonId={lesson.id} onClose={close} />
      ) : null}
    </>
  );
}
