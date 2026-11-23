import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { LessonStatus, type LessonListItemResponseDto } from "@api/generated/model";
import { useCan } from "@modules/auth";
import pencilIcon from "@shared/assets/icons/pencil.svg";
import trashBinIcon from "@shared/assets/icons/trash-bin.svg";
import { Button } from "@shared/ui";

import { CancelLessonDialog } from "./CancelLessonDialog";
import { LessonFormDialog } from "./LessonFormDialog";

export interface LessonRowActionsProps {
  lesson: Pick<LessonListItemResponseDto, "id" | "title" | "status">;
}

type OpenDialog = "edit" | "cancel" | null;

/**
 * The icons of a row of the list of lessons: the pencil opens "Editar aula" and the trash opens
 * "Cancelar aula" (cancelling keeps the lesson, with its reason, so the trash does not delete). They
 * are drawn only for who can manage lessons (`lessons.manage`: the director and the coordination),
 * and for nobody else, not even disabled. For a lesson that is already cancelled they are drawn
 * disabled, in place, so the column does not change from row to row: a cancelled lesson is final
 * and cannot be changed. Each icon is named after its lesson ("Editar a aula …"), because a list has
 * one pair for every row; they are 16px wide with 12px between the buttons, and the 44px of the
 * button is the target of the touch (so the space between the drawings is wider than the 12px of the
 * Figma). The two never wrap onto two lines: the list of lessons (GUS-155) puts this in its last
 * column, which is as wide as the pair.
 *
 * A dialog that is open stays on the screen even if the row stops allowing actions meanwhile:
 * cancelling the lesson makes the next read of the list say it is cancelled, and the dialog still
 * has to show its toast and close by itself.
 */
export function LessonRowActions({ lesson }: LessonRowActionsProps): ReactElement | null {
  const { t } = useTranslation("lessons");
  const canManage = useCan("lessons.manage");
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);

  if (!canManage && openDialog === null) return null;

  const isCancelled = lesson.status === LessonStatus.cancelled;
  const close = () => setOpenDialog(null);

  return (
    <>
      {canManage ? (
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            isIconOnly
            isDisabled={isCancelled}
            aria-label={t("actions.editFor", { title: lesson.title })}
            onPress={() => setOpenDialog("edit")}
          >
            <img src={pencilIcon} alt="" aria-hidden="true" width={16} height={16} />
          </Button>
          <Button
            variant="ghost"
            isIconOnly
            isDisabled={isCancelled}
            aria-label={t("actions.cancelFor", { title: lesson.title })}
            onPress={() => setOpenDialog("cancel")}
          >
            <img src={trashBinIcon} alt="" aria-hidden="true" width={16} height={16} />
          </Button>
        </div>
      ) : null}
      {openDialog === "edit" ? (
        <LessonFormDialog mode="edit" lessonId={lesson.id} onClose={close} />
      ) : null}
      {openDialog === "cancel" ? <CancelLessonDialog lessonId={lesson.id} onClose={close} /> : null}
    </>
  );
}
