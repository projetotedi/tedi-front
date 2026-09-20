import { Description, FieldError, Input, Label, TextField as HeroTextField } from "@heroui/react";
import type { ReactNode, Ref } from "react";

export interface TextFieldProps {
  /** Rótulo sempre visível: o placeholder nunca substitui o rótulo (público idoso). */
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  placeholder?: string;
  /** Texto de apoio sob o campo. Some enquanto houver `errorMessage`. */
  description?: string;
  /** Marca o campo como inválido (`aria-invalid`) e mostra a mensagem, ligada ao input. */
  errorMessage?: string;
  isDisabled?: boolean;
  isRequired?: boolean;
  /** `email` abre o teclado com "@" no celular; a validação continua sendo do formulário. */
  type?: "text" | "password" | "email";
  autoComplete?: string;
  /** Liga ao input um texto externo ao campo (ex.: o aviso de erro geral do formulário). */
  "aria-describedby"?: string;
  inputRef?: Ref<HTMLInputElement>;
  /** Conteúdo dentro do campo, à direita (ex.: botão de mostrar/ocultar senha). */
  endContent?: ReactNode;
}

/**
 * Campo de texto do TEDI sobre o TextField do HeroUI (React Aria): `<label>` real ligado ao
 * input, `aria-describedby` para o texto de apoio e a mensagem de erro, `aria-invalid` quando
 * há erro. Fonte de 16px e alvo de 44px (`text-base`, `min-h-11`); o foco visível (anel de
 * 2px) e o estado inválido vêm do HeroUI.
 *
 * `validationBehavior="aria"`: a validação é do formulário (react-hook-form + zod); o campo só
 * reflete o resultado, sem `required`/`setCustomValidity` nativos.
 */
export function TextField({
  label,
  value,
  onChange,
  onBlur,
  name,
  placeholder,
  description,
  errorMessage,
  isDisabled,
  isRequired,
  type = "text",
  autoComplete,
  "aria-describedby": ariaDescribedBy,
  inputRef,
  endContent,
}: TextFieldProps) {
  return (
    <HeroTextField
      fullWidth
      className="gap-2"
      name={name}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      type={type}
      autoComplete={autoComplete}
      isDisabled={isDisabled}
      isRequired={isRequired}
      isInvalid={Boolean(errorMessage)}
      validationBehavior="aria"
      aria-describedby={ariaDescribedBy}
    >
      <Label className="text-base">{label}</Label>
      <div className="relative">
        <Input
          ref={inputRef}
          placeholder={placeholder}
          className={`min-h-11 text-base sm:text-base ${endContent ? "pe-12" : ""}`.trim()}
        />
        {endContent ? (
          <div className="absolute inset-y-0 end-0 flex items-center">{endContent}</div>
        ) : null}
      </div>
      {description && !errorMessage ? (
        <Description className="text-sm">{description}</Description>
      ) : null}
      {errorMessage ? <FieldError className="text-sm">{errorMessage}</FieldError> : null}
    </HeroTextField>
  );
}
