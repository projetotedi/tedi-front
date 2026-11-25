import { useId, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useCan } from "@modules/auth";
import { Button } from "@shared/ui";

import { ClassFormDialog } from "./ClassFormDialog";

export interface NewClassButtonProps {
  /** The course the new class starts with. */
  courseId: string;
  /** An archived course takes no new class (RN-27, RF-020): the button stays, turned off. */
  isCourseArchived: boolean;
}

/**
 * + Nova turma on the screen of a course (GUS-133): opens the form of a new class with the course
 * already chosen. Only for who manages classes (`classes.manage`); on an archived course it is
 * turned off, with the reason for the screen reader. The screen of the course stays where it was.
 */
export function NewClassButton({
  courseId,
  isCourseArchived,
}: NewClassButtonProps): ReactElement | null {
  const { t } = useTranslation("classes");
  const canManage = useCan("classes.manage");
  const hintId = useId();
  const [isOpen, setIsOpen] = useState(false);

  if (!canManage) return null;

  return (
    <>
      <Button
        variant="primary"
        isDisabled={isCourseArchived}
        aria-describedby={isCourseArchived ? hintId : undefined}
        onPress={() => setIsOpen(true)}
      >
        {t("create")}
      </Button>
      {isCourseArchived ? (
        <span id={hintId} className="sr-only">
          {t("form.archivedCourseHint")}
        </span>
      ) : null}
      {isOpen ? (
        <ClassFormDialog initialCourseId={courseId} onClose={() => setIsOpen(false)} />
      ) : null}
    </>
  );
}
