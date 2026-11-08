import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { DepartmentResponseDto } from "@api/generated/model";

import { REGISTRATION_LIMITS } from "../schemas/accept-invite-form.schema";
import { InviteSelectField } from "./InviteSelectField";
import { InviteTextField } from "./InviteTextField";
import { STEP_HEADING_CLASS, type StepSectionProps } from "./step-section";

export interface AcademicStepProps extends StepSectionProps {
  /** Os departamentos que o convite oferece (`GET /auth/invites/:token`), já em ordem de nome. */
  departments: DepartmentResponseDto[];
}

export function AcademicStep({
  headingRef,
  isDisabled,
  departments,
}: AcademicStepProps): ReactElement {
  const { t } = useTranslation("auth");
  const departmentOptions = departments.map(({ id, name }) => ({ id, label: name }));

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
          isRequired
          isDisabled={isDisabled}
        />
        <InviteTextField
          name="institutionalEmail"
          label={t("invite.fields.institutionalEmail.label")}
          type="email"
          autoComplete="email"
          isRequired
          isDisabled={isDisabled}
        />
        <InviteTextField
          name="course"
          label={t("invite.fields.course.label")}
          autoComplete="off"
          isRequired
          isDisabled={isDisabled}
        />
        <InviteTextField
          name="semester"
          label={t("invite.fields.semester.label")}
          description={t("invite.fields.semester.hint", REGISTRATION_LIMITS)}
          inputMode="numeric"
          autoComplete="off"
          isRequired
          isDisabled={isDisabled}
        />
        <InviteTextField
          name="className"
          label={t("invite.fields.className.label")}
          autoComplete="off"
          isRequired
          isDisabled={isDisabled}
        />
        {/* Sem departamento na lista do convite não há o que escolher: o campo é opcional e a
            coordenação define o departamento na aprovação. */}
        {departments.length > 0 ? (
          <InviteSelectField
            name="departmentId"
            label={t("invite.fields.departmentId.label")}
            placeholder={t("invite.fields.departmentId.placeholder")}
            options={departmentOptions}
            isDisabled={isDisabled}
          />
        ) : null}
        <div className="sm:col-span-2">
          <InviteTextField
            name="volunteerTermUrl"
            label={t("invite.fields.volunteerTermUrl.label")}
            description={t("invite.fields.volunteerTermUrl.hint")}
            inputMode="url"
            autoComplete="off"
            isDisabled={isDisabled}
          />
        </div>
      </div>
    </div>
  );
}
