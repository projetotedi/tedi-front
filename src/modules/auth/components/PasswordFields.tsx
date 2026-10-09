import type { ReactElement } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { PasswordField } from "@shared/ui";

import type { NewPasswordFormValues } from "../schemas/password.schema";

/** `reset` troca só os rótulos ("Nova senha"); dicas e botões do olho são os mesmos do convite. */
export type PasswordFieldsVariant = "create" | "reset";

const LABEL_KEYS = {
  create: {
    password: "invite.fields.password.label",
    passwordConfirmation: "invite.fields.passwordConfirmation.label",
  },
  reset: {
    password: "resetPassword.fields.password.label",
    passwordConfirmation: "resetPassword.fields.passwordConfirmation.label",
  },
} as const;

export interface PasswordFieldsProps {
  isDisabled: boolean;
  describedBy?: string;
  variant?: PasswordFieldsVariant;
}

export function PasswordFields({
  isDisabled,
  describedBy,
  variant = "create",
}: PasswordFieldsProps): ReactElement {
  const { t } = useTranslation("auth");
  const labelKeys = LABEL_KEYS[variant];
  const { control } = useFormContext<NewPasswordFormValues>();

  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
      <Controller
        name="password"
        control={control}
        rules={{ deps: ["passwordConfirmation"] }}
        render={({ field, fieldState }) => (
          <PasswordField
            label={t(labelKeys.password)}
            description={t("invite.fields.password.hint")}
            showLabel={t("invite.fields.password.show")}
            hideLabel={t("invite.fields.password.hide")}
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            inputRef={field.ref}
            autoComplete="new-password"
            isRequired
            isDisabled={isDisabled}
            errorMessage={fieldState.error?.message ? t(fieldState.error.message) : undefined}
            aria-describedby={describedBy}
          />
        )}
      />
      <Controller
        name="passwordConfirmation"
        control={control}
        render={({ field, fieldState }) => (
          <PasswordField
            label={t(labelKeys.passwordConfirmation)}
            description={t("invite.fields.passwordConfirmation.hint")}
            showLabel={t("invite.fields.passwordConfirmation.show")}
            hideLabel={t("invite.fields.passwordConfirmation.hide")}
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            inputRef={field.ref}
            autoComplete="new-password"
            isRequired
            isDisabled={isDisabled}
            errorMessage={fieldState.error?.message ? t(fieldState.error.message) : undefined}
          />
        )}
      />
    </div>
  );
}
