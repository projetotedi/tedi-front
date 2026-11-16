import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { ClassLessonsPreviewResponseDto } from "@api/generated/model";
import { formatCalendarDate } from "@shared/lib/format";
import { Alert, Button } from "@shared/ui";

import { summarizeOutsidePeriod } from "../lib/outside-period";

export interface OutsidePeriodWarningProps {
  preview: ClassLessonsPreviewResponseDto;
  /**
   * The way to Editar turma, to extend the period of the class (RN-21). The warning only shows the
   * button when the screen can give it: without it the text still says to extend the period.
   */
  onEditClass?: () => void;
  /** Lets Gerar aulas point at the warning that turns it off with `aria-describedby`. */
  id?: string;
}

/**
 * What the person is told when the preview has lessons outside the period of the class (RN-21):
 * the system does not save a lesson outside it, so generating is turned off (the API answers 409
 * `LESSONS_OUTSIDE_CLASS_PERIOD`, decision of GUS-154). It says which side the lessons fall on, with
 * the end of the class and the first lesson that falls after it, as complete dates, and what to do:
 * extend the period or move the first date. It draws nothing when every lesson is inside.
 */
export function OutsidePeriodWarning({
  preview,
  onEditClass,
  id,
}: OutsidePeriodWarningProps): ReactElement | null {
  const { t, i18n } = useTranslation("lessons");
  const { afterEnd, beforeStart } = summarizeOutsidePeriod(preview);

  if (afterEnd === null && beforeStart === null) return null;

  return (
    <div id={id} className="flex flex-col items-start gap-3">
      {afterEnd === null ? null : (
        <div className="w-full">
          <Alert
            variant="warning"
            description={t("generate.outside.afterEndDescription", {
              count: afterEnd.count,
              position: afterEnd.position,
              date: formatCalendarDate(afterEnd.date, i18n.language),
              endDate: formatCalendarDate(preview.classEndDate, i18n.language),
            })}
          >
            {t("generate.outside.afterEndTitle")}
          </Alert>
        </div>
      )}
      {beforeStart === null ? null : (
        <div className="w-full">
          <Alert
            variant="warning"
            description={t("generate.outside.beforeStartDescription", {
              startDate: formatCalendarDate(preview.classStartDate, i18n.language),
            })}
          >
            {t("generate.outside.beforeStartTitle")}
          </Alert>
        </div>
      )}
      {onEditClass === undefined ? null : (
        <Button variant="secondary" onPress={onEditClass}>
          {t("generate.outside.editClass")}
        </Button>
      )}
    </div>
  );
}
