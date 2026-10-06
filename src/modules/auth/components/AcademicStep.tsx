import type { ReactElement, RefObject } from "react";
import { useTranslation } from "react-i18next";

import { InviteTextField } from "./InviteTextField";

export interface StepSectionProps {
  headingRef: RefObject<HTMLHeadingElement | null>;
  isDisabled: boolean;
}

export const STEP_HEADING_CLASS =
  "w-fit rounded-md text-base font-semibold text-foreground outline-offset-4 focus-visible:outline-2 focus-visible:outline-focus";

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
