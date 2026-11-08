import type { ReactElement } from "react";
import { useController, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Select, type SelectOption } from "@shared/ui";

import {
  REGISTRATION_LIMITS,
  type AcceptInviteFieldName,
  type AcceptInviteFormInput,
} from "../schemas/accept-invite-form.schema";

/**
 * Id da opção "Não informar". Fica fora dos ids reais (UUID de departamento, sigla de UF) e não
 * é o texto vazio: uma chave vazia não é segura numa lista do React Aria. O formulário guarda "".
 */
const NONE_OPTION_ID = "none";

export interface InviteSelectFieldProps {
  name: Extract<AcceptInviteFieldName, "departmentId" | "state">;
  label: string;
  placeholder: string;
  options: SelectOption[];
  isDisabled: boolean;
}

/**
 * Seletor opcional do cadastro: a primeira opção, "Não informar", devolve o campo a vazio (que o
 * corpo do aceite omite). Vazio mostra o texto de apoio, não a opção "Não informar".
 */
export function InviteSelectField({
  name,
  label,
  placeholder,
  options,
  isDisabled,
}: InviteSelectFieldProps): ReactElement {
  const { t } = useTranslation("auth");
  const { control, trigger } = useFormContext<AcceptInviteFormInput>();
  const { field, fieldState } = useController({ name, control });

  function handleChange(id: string) {
    field.onChange(id === NONE_OPTION_ID ? "" : id);
    if (fieldState.error) void trigger(name);
  }

  return (
    <Select
      label={label}
      placeholder={placeholder}
      options={[{ id: NONE_OPTION_ID, label: t("invite.fields.noneOption") }, ...options]}
      value={field.value === "" ? null : field.value}
      onChange={handleChange}
      onBlur={field.onBlur}
      name={field.name}
      triggerRef={field.ref}
      isDisabled={isDisabled}
      errorMessage={
        fieldState.error?.message ? t(fieldState.error.message, REGISTRATION_LIMITS) : undefined
      }
    />
  );
}
