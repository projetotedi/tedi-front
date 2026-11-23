import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { LessonResponseDto } from "@api/generated/model";
import { useCan } from "@modules/auth";
import { Button } from "@shared/ui";

import type { LessonClassContext } from "./LessonFormDialog";
import { NewLessonFlow } from "./NewLessonFlow";

export interface NewLessonButtonProps {
  /**
   * The class the lesson is for: when the screen knows it (the screen of a class) it is fixed in the
   * dialog. Without it the person chooses the class first.
   */
  lessonClass?: LessonClassContext;
  /** The class that comes chosen when the person has to choose one. Ignored with `lessonClass`. */
  initialClassId?: string;
  onSaved?: (lesson: LessonResponseDto) => void;
}

/**
 * "+ Nova aula": the button that opens the dialog of a new lesson. It is drawn only for who can
 * manage lessons (`lessons.manage`: the director and the coordination), and for nobody else, not
 * even disabled. The plus sign is decoration: the button is named "Nova aula". With the class of the
 * screen (`lessonClass`) the dialog opens with it fixed; without it, `NewLessonFlow` asks for the
 * class first. When the dialog closes, the focus goes back to the button (the dialog is mounted only
 * while it is open, and the focus returns to what had it when it opened).
 *
 * It is mounted in the screen of the class (by a slot of `app/`, which is the only one that knows
 * both modules). The list of lessons has its own button, since the "Nova aula" of its empty state
 * opens the same flow.
 */
export function NewLessonButton({
  lessonClass,
  initialClassId,
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
        <NewLessonFlow
          lessonClass={lessonClass}
          initialClassId={initialClassId}
          onSaved={onSaved}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}
