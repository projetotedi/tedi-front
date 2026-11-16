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
 * are drawn only for who can manage lessons (`lessons.manage`) and only for a lesson that is not
 * cancelled, since a cancelled lesson cannot be changed. Each icon is named after its lesson
 * ("Editar a aula …"), because a list has one pair for every row. The list itself (GUS-155) puts
 * this in its last column.
 *
 * A dialog that is open stays on the screen even if the row stops allowing actions meanwhile:
 * cancelling the lesson makes the next read of the list say it is cancelled, and the dialog still
 * has to show its toast and close by itself.
 */
export function LessonRowActions({ lesson }: LessonRowActionsProps): ReactElement | null {
  const { t } = useTranslation("lessons");
  const canManage = useCan("lessons.manage");
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);

  const canAct = canManage && lesson.status !== LessonStatus.cancelled;
  if (!canAct && openDialog === null) return null;

  const close = () => setOpenDialog(null);

  return (
    <>
      {canAct ? (
        <div className="flex flex-wrap items-center gap-1">
          <Button
            variant="ghost"
            isIconOnly
            aria-label={t("actions.editFor", { title: lesson.title })}
            onPress={() => setOpenDialog("edit")}
          >
            <img src={pencilIcon} alt="" aria-hidden="true" width={16} height={16} />
          </Button>
          <Button
            variant="ghost"
            isIconOnly
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
