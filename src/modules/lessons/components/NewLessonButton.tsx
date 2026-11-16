import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { LessonResponseDto } from "@api/generated/model";
import { useCan } from "@modules/auth";
import { Button } from "@shared/ui";

import { LessonFormDialog, type LessonClassContext } from "./LessonFormDialog";

export interface NewLessonButtonProps {
  /** The class the lesson is for: it is fixed in the dialog, since there is no list of classes to choose from. */
  lessonClass: LessonClassContext;
  onSaved?: (lesson: LessonResponseDto) => void;
}

/**
 * "+ Nova aula": the button that opens the dialog of a new lesson for one class. It is drawn only
 * for who can manage lessons (`lessons.manage`: the director and the coordination), and for nobody
 * else, not even disabled. The plus sign is decoration: the button is named "Nova aula". When the
 * dialog closes, the focus goes back to the button (the dialog is mounted only while it is open, and
 * the focus returns to what had it when it opened).
 *
 * The first place it is mounted is the screen of the class (by a slot of `app/`, which is the only
 * one that knows both modules). The list and the calendar of lessons are the next ones.
 */
export function NewLessonButton({
  lessonClass,
  onSaved,
}: NewLessonButtonProps): ReactElement | null {
  const { t } = useTranslation("lessons");
  const canManage = useCan("lessons.manage");
  const [isOpen, setIsOpen] = useState(false);

  if (!canManage) return null;

  return (
    <>
      <Button variant="primary" onPress={() => setIsOpen(true)}>
        <span aria-hidden="true">+</span> {t("actions.new")}
      </Button>
      {isOpen ? (
        <LessonFormDialog
          mode="create"
          lessonClass={lessonClass}
          onSaved={onSaved}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}
