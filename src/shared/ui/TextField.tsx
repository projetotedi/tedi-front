import { Description, FieldError, Input, Label, TextField as HeroTextField } from "@heroui/react";
import type { ReactNode, Ref } from "react";

export interface TextFieldProps {
  label: string;
  /**
   * Esconde o rótulo só visualmente (`sr-only`): o campo continua nomeado para leitores de tela.
   * Usar quando o desenho não mostra rótulo (ex.: busca com placeholder).
   */
  isLabelHidden?: boolean;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  placeholder?: string;
  description?: string;
  errorMessage?: string;
  isDisabled?: boolean;
  isRequired?: boolean;
  isReadOnly?: boolean;
  type?: "text" | "password" | "email";
  autoComplete?: string;
  "aria-describedby"?: string;
  inputRef?: Ref<HTMLInputElement>;
  endContent?: ReactNode;
}

export function TextField({
  label,
  isLabelHidden = false,
  value,
  onChange,
  onBlur,
  name,
  placeholder,
  description,
  errorMessage,
  isDisabled,
  isRequired,
  isReadOnly,
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
      isReadOnly={isReadOnly}
      isInvalid={Boolean(errorMessage)}
      validationBehavior="aria"
      aria-describedby={ariaDescribedBy}
    >
      <Label className={isLabelHidden ? "sr-only" : "text-base"}>{label}</Label>
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
