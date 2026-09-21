import { Description, FieldError, Input, Label, TextField as HeroTextField } from "@heroui/react";
import type { ReactNode, Ref } from "react";

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  placeholder?: string;
  description?: string;
  errorMessage?: string;
  isDisabled?: boolean;
  isRequired?: boolean;
  type?: "text" | "password";
  autoComplete?: string;
  "aria-describedby"?: string;
  inputRef?: Ref<HTMLInputElement>;
  endContent?: ReactNode;
}

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
