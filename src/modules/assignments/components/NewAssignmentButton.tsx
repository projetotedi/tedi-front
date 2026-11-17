import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { LessonAssignmentResponseDto } from "@api/generated/model";
import { useCan } from "@modules/auth";
import { Button } from "@shared/ui";

import { NewAssignmentDialog, type AssignmentScope } from "./NewAssignmentDialog";

/**
 * What the dialog takes, less `onClose`, which the button owns. It is written from the scope (and
 * not as an `Omit` of the props of the dialog) because `Omit` does not follow a union: it would let
 * a lesson and a class be passed together, which the scope forbids.
 */
export type NewAssignmentButtonProps = AssignmentScope & {
  onSaved?: (assignment: LessonAssignmentResponseDto) => void;
};

/**
 * "+ Nova alocação": the button that opens the dialog of a new assignment. It is drawn only for who
 * can assign (`assignments.create`: the director and the coordination), and for nobody else, not
 * even disabled. The plus sign is decoration: the button is named "Nova alocação". When the dialog
 * closes, the focus goes back to the button (the dialog is mounted only while it is open, and the
 * focus returns to what had it when it opened).
 *
 * What the screen that mounts it has already decided goes in the props: `member` (the sheet of a
 * member, so the member comes filled in and fixed), `lessonClass` (the screen of a class) or
 * `lesson` (the screen of a lesson). Without any of them the dialog asks for everything, which is
 * what the list of members needs. The first place it is mounted is the screen of the class (by a
 * slot of `app/`, which is the only one that knows both modules); the screens of the members and of
 * the lessons put it in their headers when they exist (see `docs/ARCHITECTURE.md`).
 */
export function NewAssignmentButton(props: NewAssignmentButtonProps): ReactElement | null {
  const { t } = useTranslation("assignments");
  const canCreate = useCan("assignments.create");
  const [isOpen, setIsOpen] = useState(false);

  if (!canCreate) return null;

  return (
    <>
      <Button variant="primary" onPress={() => setIsOpen(true)}>
        <span aria-hidden="true">+</span> {t("newAssignment.button")}
      </Button>
      {isOpen ? <NewAssignmentDialog {...props} onClose={() => setIsOpen(false)} /> : null}
    </>
  );
}
