import { Description, FieldError, Label, ListBox, Select as HeroSelect } from "@heroui/react";
import type { ReactElement } from "react";

export interface SelectOption {
  id: string;
  label: string;
}

export interface SelectProps {
  label: string;
  options: SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  placeholder?: string;
  description?: string;
  errorMessage?: string;
  isDisabled?: boolean;
  isRequired?: boolean;
  autoFocus?: boolean;
}

export function Select({
  label,
  options,
  value,
  onChange,
  onBlur,
  name,
  placeholder,
  description,
  errorMessage,
  isDisabled,
  isRequired,
  autoFocus,
}: SelectProps): ReactElement {
  return (
    <HeroSelect
      fullWidth
      className="gap-2"
      name={name}
      value={value}
      onChange={(key) => key !== null && onChange(String(key))}
      onBlur={onBlur}
      placeholder={placeholder}
      isDisabled={isDisabled}
      isRequired={isRequired}
      isInvalid={Boolean(errorMessage)}
      validationBehavior="aria"
      autoFocus={autoFocus}
    >
      <Label className="text-base">{label}</Label>
      <HeroSelect.Trigger className="min-h-11 text-base">
        <HeroSelect.Value />
        <HeroSelect.Indicator />
      </HeroSelect.Trigger>
      <HeroSelect.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item
              key={option.id}
              id={option.id}
              textValue={option.label}
              className="min-h-11 text-base"
            >
              {option.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </HeroSelect.Popover>
      {description && !errorMessage ? (
        <Description className="text-sm">{description}</Description>
      ) : null}
      {errorMessage ? <FieldError className="text-sm">{errorMessage}</FieldError> : null}
    </HeroSelect>
  );
}
