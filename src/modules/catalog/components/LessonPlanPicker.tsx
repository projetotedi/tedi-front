import { useMemo, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { replaceCourseLessonPlansBodyLessonPlanIdsMax } from "@api/generated/zod/catalog/catalog";
import { formatHours } from "@shared/lib/format";
import { Button, Select } from "@shared/ui";

import { useLessonPlanOptions } from "../hooks/useLessonPlanOptions";
import { availableLessonPlans, type SequenceItem } from "../lib/course-sequence";

export interface LessonPlanPickerProps {
  courseId: string;
  /** The saved sequence: a plan that was taken out of the draft is offered again from here. */
  saved: readonly SequenceItem[];
  draft: readonly SequenceItem[];
  /** The draft already has the most plans the API accepts. */
  isAtLimit: boolean;
  onAdd: (item: SequenceItem) => void;
  /** The draft cannot change now (the dialog is saving it): the select and Adicionar are off. */
  isDisabled?: boolean;
}

/**
 * "Adicionar plano de aula": a select with the lesson plans that are not in the draft yet and the
 * Adicionar button. The button is never disabled for lack of a choice: pressing it with nothing
 * chosen shows the error of the field, so the focus stays on the button after each add. It is
 * disabled at the limit of the sequence, and then the text says why, and while the dialog saves.
 */
export function LessonPlanPicker({
  courseId,
  saved,
  draft,
  isAtLimit,
  onAdd,
  isDisabled = false,
}: LessonPlanPickerProps): ReactElement {
  const { t } = useTranslation("catalog");
  const { options, isPending, isError } = useLessonPlanOptions(courseId);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [isChoiceMissing, setIsChoiceMissing] = useState(false);

  const available = useMemo(
    () => availableLessonPlans(options, saved, draft),
    [options, saved, draft],
  );
  const chosen = available.find((item) => item.lessonPlanId === chosenId) ?? null;
  const isEmpty = !isPending && !isError && available.length === 0;
  const allAdded = t("course.sequence.allAdded");

  function add() {
    if (isAtLimit || isDisabled) return;
    if (chosen === null) {
      setIsChoiceMissing(true);
      return;
    }

    onAdd(chosen);
    setChosenId(null);
    setIsChoiceMissing(false);
  }

  function errorMessage(): string | undefined {
    if (isError) return t("course.sequence.optionsError");
    if (!isChoiceMissing) return undefined;
    return isEmpty ? allAdded : t("course.sequence.pickRequired");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <Select
            label={t("course.sequence.addLabel")}
            placeholder={t("course.sequence.addPlaceholder")}
            options={available.map((item) => ({
              id: item.lessonPlanId,
              label: t("course.sequence.optionLabel", {
                title: item.title,
                duration: formatHours(item.expectedDurationMinutes),
              }),
            }))}
            value={chosen?.lessonPlanId ?? null}
            onChange={(lessonPlanId) => {
              setChosenId(lessonPlanId);
              setIsChoiceMissing(false);
            }}
            isDisabled={isDisabled || isPending || isError || isEmpty}
            description={isEmpty ? allAdded : undefined}
            errorMessage={errorMessage()}
          />
        </div>
        {/* `sm:mt-8`: the height of the label (24px) and its gap (8px), so the button lines up with the select, not with its message. */}
        <Button
          variant="secondary"
          isDisabled={isAtLimit || isDisabled}
          onPress={add}
          className="self-start sm:mt-8"
        >
          {t("course.sequence.add")}
        </Button>
      </div>
      {isAtLimit ? (
        <p className="text-sm text-muted">
          {t("course.sequence.limit", { max: replaceCourseLessonPlansBodyLessonPlanIdsMax })}
        </p>
      ) : null}
    </div>
  );
}
