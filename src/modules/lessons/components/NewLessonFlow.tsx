import { useEffect, useState, type ReactElement } from "react";

import type { LessonResponseDto } from "@api/generated/model";

import { ChooseLessonClassDialog } from "./ChooseLessonClassDialog";
import { LessonFormDialog, type LessonClassContext } from "./LessonFormDialog";

export interface NewLessonFlowProps {
  /** The class the lesson is for, when the screen already knows it: the form opens at once. */
  lessonClass?: LessonClassContext;
  /** The class that comes chosen in the first step, when the screen is filtered by one. */
  initialClassId?: string;
  onClose: () => void;
  onSaved?: (lesson: LessonResponseDto) => void;
}

/**
 * Gives the focus back to what had it when the flow opened (the "+ Nova aula" that opened it) once
 * the flow is gone. Each dialog does that for itself, but the form opens in the place of the choice
 * of the class, so what it would give the focus back to is already gone by then.
 */
function useReturnFocusWhenGone(): void {
  const [opener] = useState(() => document.activeElement);

  useEffect(
    () => () => {
      requestAnimationFrame(() => {
        // Only if the focus was lost: it may have gone somewhere on purpose.
        if (
          opener instanceof HTMLElement &&
          opener.isConnected &&
          document.activeElement === document.body
        ) {
          opener.focus();
        }
      });
    },
    [opener],
  );
}

/**
 * "+ Nova aula" from a screen that may or may not know the class. With `lessonClass` it opens the
 * dialog of the new lesson with the class fixed (the screen of a class). Without it, it first asks
 * which class the lesson is for (`ChooseLessonClassDialog`, with `initialClassId` already chosen),
 * and Continuar opens the same dialog with that class. The two are never open together, and
 * closing either one ends the flow.
 */
export function NewLessonFlow({
  lessonClass,
  initialClassId,
  onClose,
  onSaved,
}: NewLessonFlowProps): ReactElement {
  const [chosenClass, setChosenClass] = useState<LessonClassContext | null>(lessonClass ?? null);
  useReturnFocusWhenGone();

  if (chosenClass === null) {
    return (
      <ChooseLessonClassDialog
        initialClassId={initialClassId}
        onContinue={setChosenClass}
        onClose={onClose}
      />
    );
  }

  return (
    <LessonFormDialog mode="create" lessonClass={chosenClass} onSaved={onSaved} onClose={onClose} />
  );
}
