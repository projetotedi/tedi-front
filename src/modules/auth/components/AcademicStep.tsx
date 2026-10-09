import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { InviteTextField } from "./InviteTextField";
import { STEP_HEADING_CLASS, type StepSectionProps } from "./step-section";

export function AcademicStep({ headingRef, isDisabled }: StepSectionProps): ReactElement {
  const { t } = useTranslation("auth");

  return (
    <div className="flex flex-col gap-4">
      <h2 ref={headingRef} tabIndex={-1} className={STEP_HEADING_CLASS}>
        {t("invite.steps.academic")}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
        <InviteTextField
          name="ra"
          label={t("invite.fields.ra.label")}
          description={t("invite.fields.ra.hint")}
          autoComplete="username"
          isDisabled={isDisabled}
        />
        <InviteTextField
          name="email"
          label={t("invite.fields.email.label")}
          type="email"
          autoComplete="email"
          isDisabled={isDisabled}
        />
      </div>
    </div>
  );
}
