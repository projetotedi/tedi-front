import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useCan } from "@modules/auth";
import { Button } from "@shared/ui";

import { GenerateLessonsDialog } from "./GenerateLessonsDialog";

export interface GenerateLessonsButtonProps {
  classId: string;
  /** The name of the course of the class: the dialog says the lessons come from its plans. */
  courseName: string;
  /** The first day of the class: the dialog starts "Data da primeira aula" there, inside the period. */
  classStartDate: string;
  /** An archived class is read-only (RN-27): no lessons are generated for it, so there is no button. */
  isClassArchived: boolean;
  /** The way to Editar turma, for the shortcut of the warning of the lessons outside the period. */
  onEditClass?: () => void;
}

/**
 * "Gerar aulas" (`tertiary`), the action of the header of a class that opens the dialog which
 * creates all its lessons from the plan of the course (F4.2). It is there only for who has
 * `lessons.manage`, the permission of the endpoint (the director and the coordination), and not
 * for an archived class. The dialog is mounted only while it is open, so each time it starts
 * clean: no field, preview or error of the last time.
 *
 * The dialog gives the focus back to the button when it closes (Voltar, Escape or the close
 * button), as the other dialogs of the app do. After generating it closes too, and the button
 * stays: the class has lessons now and generating again is answered with a warning that says so.
 */
export function GenerateLessonsButton({
  classId,
  courseName,
  classStartDate,
  isClassArchived,
  onEditClass,
}: GenerateLessonsButtonProps): ReactElement | null {
  const { t } = useTranslation("lessons");
  const canManage = useCan("lessons.manage");
  const [isOpen, setIsOpen] = useState(false);

  if (!canManage || isClassArchived) return null;

  return (
    <>
      <Button variant="tertiary" onPress={() => setIsOpen(true)}>
        {t("generate.action")}
      </Button>
      {isOpen ? (
        <GenerateLessonsDialog
          classId={classId}
          courseName={courseName}
          defaultFirstDate={classStartDate}
          onClose={() => setIsOpen(false)}
          onEditClass={onEditClass}
        />
      ) : null}
    </>
  );
}
