import type { ReactElement } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { TextField } from "@shared/ui";

import type {
  AcceptInviteFormValues,
  STEP_ONE_FIELDS,
  STEP_TWO_FIELDS,
} from "../schemas/password.schema";

export interface InviteTextFieldProps {
  name: (typeof STEP_ONE_FIELDS)[number] | (typeof STEP_TWO_FIELDS)[number];
  label: string;
  description?: string;
  type?: "text" | "email";
  autoComplete: string;
  isDisabled: boolean;
}

export function InviteTextField({
  name,
  label,
  description,
  type,
  autoComplete,
  isDisabled,
}: InviteTextFieldProps): ReactElement {
  const { t } = useTranslation("auth");
  const { control, trigger } = useFormContext<AcceptInviteFormValues>();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <TextField
          label={label}
          description={description}
          name={field.name}
          value={field.value}
          onChange={(value) => {
            field.onChange(value);
            if (fieldState.error) void trigger(name);
          }}
          onBlur={field.onBlur}
          inputRef={field.ref}
          type={type}
          autoComplete={autoComplete}
          isRequired
          isDisabled={isDisabled}
          errorMessage={fieldState.error?.message ? t(fieldState.error.message) : undefined}
        />
      )}
    />
  );
}
