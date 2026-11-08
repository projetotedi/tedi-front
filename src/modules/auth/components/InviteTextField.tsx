import { useCallback, useLayoutEffect, useRef, type ReactElement } from "react";
import { useController, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { TextField, type TextFieldProps } from "@shared/ui";

import { onlyDigits } from "../lib/cpf";
import { caretAfterDigits } from "../lib/input-masks";
import {
  REGISTRATION_LIMITS,
  type AcceptInviteFieldName,
  type AcceptInviteFormInput,
} from "../schemas/accept-invite-form.schema";

/** Os campos de texto do cadastro: tudo menos a senha (que tem o próprio componente) e os dois seletores. */
export type InviteTextFieldName = Exclude<
  AcceptInviteFieldName,
  "password" | "passwordConfirmation" | "departmentId" | "state"
>;

export interface InviteTextFieldProps {
  name: InviteTextFieldName;
  label: string;
  description?: string;
  placeholder?: string;
  type?: "text" | "email" | "date";
  inputMode?: TextFieldProps["inputMode"];
  autoComplete: string;
  /** Máscara aplicada a cada digitação: o valor que o formulário guarda já sai formatado. */
  format?: (value: string) => string;
  isRequired?: boolean;
  isDisabled: boolean;
}

export function InviteTextField({
  name,
  label,
  description,
  placeholder,
  type,
  inputMode,
  autoComplete,
  format,
  isRequired = false,
  isDisabled,
}: InviteTextFieldProps): ReactElement {
  const { t } = useTranslation("auth");
  const { control, trigger } = useFormContext<AcceptInviteFormInput>();
  const { field, fieldState } = useController({ name, control });

  const inputRef = useRef<HTMLInputElement | null>(null);
  // Onde o cursor deve ficar depois que a máscara reescrever o texto no meio da digitação.
  const pendingCaretRef = useRef<number | null>(null);

  const { ref: registerInput } = field;
  const setInputRef = useCallback(
    (element: HTMLInputElement | null) => {
      inputRef.current = element;
      registerInput(element);
    },
    [registerInput],
  );

  // O React reescreve o `value` do input quando a máscara muda o texto, e o navegador joga o
  // cursor para o fim. Aqui o cursor volta para depois do mesmo dígito, já com o texto novo na tela.
  useLayoutEffect(() => {
    const caret = pendingCaretRef.current;
    pendingCaretRef.current = null;
    const input = inputRef.current;
    if (caret !== null && input !== null && document.activeElement === input) {
      input.setSelectionRange(caret, caret);
    }
  });

  function handleChange(typed: string) {
    const value = format ? format(typed) : typed;
    // Zera o pedido de antes: sem uma nova renderização o efeito não roda, e um cursor velho
    // seria aplicado na digitação seguinte.
    pendingCaretRef.current = null;
    const caret = inputRef.current?.selectionStart ?? null;
    // `value !== field.value`: só há nova renderização (e texto reescrito na tela) se o valor muda.
    const isRewritten = value !== typed && value !== field.value;
    if (isRewritten && caret !== null && caret < typed.length) {
      pendingCaretRef.current = caretAfterDigits(value, onlyDigits(typed.slice(0, caret)).length);
    }
    field.onChange(value);
    if (fieldState.error) void trigger(name);
  }

  return (
    <TextField
      label={label}
      description={description}
      placeholder={placeholder}
      name={field.name}
      value={field.value}
      onChange={handleChange}
      onBlur={field.onBlur}
      inputRef={setInputRef}
      type={type}
      inputMode={inputMode}
      autoComplete={autoComplete}
      isRequired={isRequired}
      isDisabled={isDisabled}
      errorMessage={
        fieldState.error?.message ? t(fieldState.error.message, REGISTRATION_LIMITS) : undefined
      }
    />
  );
}
