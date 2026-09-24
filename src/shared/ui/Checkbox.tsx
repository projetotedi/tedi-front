import { Checkbox as HeroCheckbox, FieldError, Label } from "@heroui/react";
import type { ReactNode } from "react";

export interface CheckboxProps {
  label: ReactNode;
  isSelected: boolean;
  onChange: (isSelected: boolean) => void;
  isRequired?: boolean;
  isDisabled?: boolean;
  errorMessage?: string;
  name?: string;
}

export function Checkbox({
  label,
  isSelected,
  onChange,
  isRequired,
  isDisabled,
  errorMessage,
  name,
}: CheckboxProps) {
  return (
    <HeroCheckbox
      name={name}
      isSelected={isSelected}
      onChange={onChange}
      isRequired={isRequired}
      isDisabled={isDisabled}
      isInvalid={Boolean(errorMessage)}
      validationBehavior="aria"
      className="items-start gap-3"
    >
      <HeroCheckbox.Content className="min-h-11 items-start gap-3">
        <HeroCheckbox.Control className="mt-0.5 size-5">
          <HeroCheckbox.Indicator />
        </HeroCheckbox.Control>
        <Label className="text-base">{label}</Label>
      </HeroCheckbox.Content>
      {errorMessage ? <FieldError className="text-sm">{errorMessage}</FieldError> : null}
    </HeroCheckbox>
  );
}
