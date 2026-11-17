import { Checkbox as HeroCheckbox, FieldError, Label } from "@heroui/react";
import type { ReactNode } from "react";

export interface CheckboxProps {
  label: ReactNode;
  isSelected: boolean;
  onChange: (isSelected: boolean) => void;
  /** Part of what it stands for is selected (the "select all" of a table): shows a dash. */
  isIndeterminate?: boolean;
  /** The label is read by assistive technology only (a checkbox in a table cell). */
  isLabelHidden?: boolean;
  isRequired?: boolean;
  isDisabled?: boolean;
  errorMessage?: string;
  name?: string;
}

// The fill is the checkbox of the Figma kit (`--tedi-action-primary`, #2563eb): its white mark gives
// 5,2:1. HeroUI paints the checked state on the `::before` of the control and the mixed state on the
// control itself (`data-indeterminate` of the root), so both get the token.
const CONTROL_CLASS =
  "size-5 before:bg-tedi-action-primary in-data-[indeterminate=true]:bg-tedi-action-primary";

export function Checkbox({
  label,
  isSelected,
  onChange,
  isIndeterminate,
  isLabelHidden = false,
  isRequired,
  isDisabled,
  errorMessage,
  name,
}: CheckboxProps) {
  return (
    <HeroCheckbox
      name={name}
      isSelected={isSelected}
      isIndeterminate={isIndeterminate}
      onChange={onChange}
      isRequired={isRequired}
      isDisabled={isDisabled}
      isInvalid={Boolean(errorMessage)}
      validationBehavior="aria"
      className="items-start gap-3"
    >
      <HeroCheckbox.Content
        className={isLabelHidden ? "min-h-11 min-w-11 items-center" : "min-h-11 items-start gap-3"}
      >
        <HeroCheckbox.Control
          className={[CONTROL_CLASS, isLabelHidden ? "" : "mt-0.5"].filter(Boolean).join(" ")}
        >
          <HeroCheckbox.Indicator />
        </HeroCheckbox.Control>
        <Label className={isLabelHidden ? "sr-only" : "text-base"}>{label}</Label>
      </HeroCheckbox.Content>
      {errorMessage ? <FieldError className="text-sm">{errorMessage}</FieldError> : null}
    </HeroCheckbox>
  );
}
