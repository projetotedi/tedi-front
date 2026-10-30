import {
  Description,
  FieldError,
  Label,
  TextArea as HeroTextArea,
  TextField as HeroTextField,
} from "@heroui/react";
import type { ReactNode, Ref } from "react";

export interface TextAreaProps {
  label: ReactNode;
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
  autoFocus?: boolean;
  rows?: number;
  "aria-describedby"?: string;
  inputRef?: Ref<HTMLTextAreaElement>;
}

export function TextArea({
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
  isReadOnly,
  autoFocus,
  rows = 4,
  "aria-describedby": ariaDescribedBy,
  inputRef,
}: TextAreaProps) {
  return (
    <HeroTextField
      fullWidth
      className="gap-2"
      name={name}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      isDisabled={isDisabled}
      isRequired={isRequired}
      isReadOnly={isReadOnly}
      autoFocus={autoFocus}
      isInvalid={Boolean(errorMessage)}
      validationBehavior="aria"
      aria-describedby={ariaDescribedBy}
    >
      <Label className="text-base">{label}</Label>
      <HeroTextArea
        ref={inputRef}
        rows={rows}
        placeholder={placeholder}
        className="min-h-24 resize-y text-base sm:text-base"
      />
      {description && !errorMessage ? (
        <Description className="text-sm">{description}</Description>
      ) : null}
      {errorMessage ? <FieldError className="text-sm">{errorMessage}</FieldError> : null}
    </HeroTextField>
  );
}
