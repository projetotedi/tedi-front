import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { STEP_HEADING_CLASS, type StepSectionProps } from "./AcademicStep";
import { InviteTextField } from "./InviteTextField";

export function PersonalStep({ headingRef, isDisabled }: StepSectionProps): ReactElement {
  const { t } = useTranslation("auth");

  return (
    <div className="flex flex-col gap-4">
      <h2 ref={headingRef} tabIndex={-1} className={STEP_HEADING_CLASS}>
        {t("invite.steps.personal")}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
        <div className="sm:col-span-2">
          <InviteTextField
            name="name"
            label={t("invite.fields.name.label")}
            autoComplete="name"
            isDisabled={isDisabled}
          />
        </div>
      </div>
    </div>
  );
}
