import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { BrazilianState } from "@api/generated/model";

import { formatCpf, formatPhone } from "../lib/input-masks";
import { InviteSelectField } from "./InviteSelectField";
import { InviteTextField } from "./InviteTextField";
import { STEP_HEADING_CLASS, type StepSectionProps } from "./step-section";

// Em ordem de sigla (AC, AL, AM, AP...): o contrato lista por nome do estado, e quem procura "AM" não espera achá-lo depois de "AP".
const STATE_OPTIONS = Object.values(BrazilianState)
  .sort()
  .map((state) => ({ id: state, label: state }));

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
            isRequired
            isDisabled={isDisabled}
          />
        </div>
        <InviteTextField
          name="birthDate"
          label={t("invite.fields.birthDate.label")}
          type="date"
          autoComplete="bday"
          isRequired
          isDisabled={isDisabled}
        />
        <InviteTextField
          name="cpf"
          label={t("invite.fields.cpf.label")}
          placeholder={t("invite.fields.cpf.placeholder")}
          inputMode="numeric"
          autoComplete="off"
          format={formatCpf}
          isRequired
          isDisabled={isDisabled}
        />
        <InviteTextField
          name="phone"
          label={t("invite.fields.phone.label")}
          placeholder={t("invite.fields.phone.placeholder")}
          inputMode="tel"
          autoComplete="tel"
          format={formatPhone}
          isRequired
          isDisabled={isDisabled}
        />
        <InviteTextField
          name="personalEmail"
          label={t("invite.fields.personalEmail.label")}
          type="email"
          autoComplete="email"
          isRequired
          isDisabled={isDisabled}
        />
        <div className="sm:col-span-2">
          <InviteTextField
            name="address"
            label={t("invite.fields.address.label")}
            autoComplete="street-address"
            isDisabled={isDisabled}
          />
        </div>
        <InviteTextField
          name="city"
          label={t("invite.fields.city.label")}
          autoComplete="address-level2"
          isDisabled={isDisabled}
        />
        <InviteSelectField
          name="state"
          label={t("invite.fields.state.label")}
          placeholder={t("invite.fields.state.placeholder")}
          options={STATE_OPTIONS}
          isDisabled={isDisabled}
        />
      </div>
    </div>
  );
}
