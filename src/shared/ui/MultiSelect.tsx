import { Description, FieldError, Label, ListBox, Select as HeroSelect } from "@heroui/react";
import type { Key, ReactElement, ReactNode, Ref } from "react";

import chevronDownUrl from "../assets/icons/chevron-down.svg";
import type { SelectOption } from "./Select";

export interface MultiSelectProps {
  label: ReactNode;
  isLabelHidden?: boolean;
  options: SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  /** What the trigger says for the chosen options; by default their labels, comma separated. */
  formatValue?: (selected: SelectOption[]) => string;
  onBlur?: () => void;
  name?: string;
  placeholder?: string;
  description?: string;
  errorMessage?: string;
  isDisabled?: boolean;
  isRequired?: boolean;
  /** The trigger, for `react-hook-form` to focus the field on an error. */
  triggerRef?: Ref<HTMLButtonElement>;
}

/**
 * The `Select` with more than one choice: the same trigger, popover and 44px options, with the
 * chosen ones checked in the list and named in the trigger. It knows nothing of the domain: the
 * options come ready, and an option that is chosen but no longer offered is still named if it is
 * in `options` (the caller decides whether to keep it there).
 */
export function MultiSelect({
  label,
  isLabelHidden = false,
  options,
  value,
  onChange,
  formatValue,
  onBlur,
  name,
  placeholder,
  description,
  errorMessage,
  isDisabled,
  isRequired,
  triggerRef,
}: MultiSelectProps): ReactElement {
  const selected = options.filter((option) => value.includes(option.id));
  const text = formatValue
    ? formatValue(selected)
    : selected.map((option) => option.label).join(", ");

  return (
    <HeroSelect<object, "multiple">
      fullWidth
      className="gap-2"
      selectionMode="multiple"
      name={name}
      value={value}
      onChange={(keys: Key[]) => onChange(keys.map(String))}
      onBlur={onBlur}
      placeholder={placeholder}
      isDisabled={isDisabled}
      isRequired={isRequired}
      isInvalid={Boolean(errorMessage)}
      validationBehavior="aria"
    >
      <Label className={isLabelHidden ? "sr-only" : "text-base"}>{label}</Label>
      <HeroSelect.Trigger ref={triggerRef} className="min-h-11 rounded-xl text-base">
        {/* `sm:text-base`: o CSS do HeroUI reduz o valor para 14px a partir de `sm`. */}
        <HeroSelect.Value className="text-base sm:text-base">
          {selected.length > 0 ? () => text : undefined}
        </HeroSelect.Value>
        <HeroSelect.Indicator>
          <img src={chevronDownUrl} alt="" aria-hidden="true" width={16} height={16} />
        </HeroSelect.Indicator>
      </HeroSelect.Trigger>
      <HeroSelect.Popover>
        <ListBox selectionMode="multiple">
          {options.map((option) => (
            <ListBox.Item
              key={option.id}
              id={option.id}
              textValue={option.label}
              className="min-h-11 text-base"
            >
              {option.label}
              <ListBox.ItemIndicator />
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
