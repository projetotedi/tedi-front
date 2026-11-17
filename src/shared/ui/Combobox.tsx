import {
  ComboBox as HeroComboBox,
  Description,
  FieldError,
  Input,
  Label,
  ListBox,
} from "@heroui/react";
import type { ReactElement, ReactNode, Ref } from "react";

import chevronDownUrl from "../assets/icons/chevron-down.svg";

export interface ComboboxProps {
  label: ReactNode;
  /** The suggestions, as the text each one puts in the field. */
  options: string[];
  /** What is in the field: a suggestion or anything typed. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  placeholder?: string;
  description?: string;
  errorMessage?: string;
  isDisabled?: boolean;
  isRequired?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * A text field with suggestions: the list opens as the person types (or with the button at the
 * end) and shows the suggestions that contain the text; picking one puts it in the field, and a
 * text that is in none of them stays as it was typed. The value is always the text of the field,
 * so the form decides whether a new one is valid. It knows nothing of the domain.
 */
export function Combobox({
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
  inputRef,
}: ComboboxProps): ReactElement {
  const query = value.trim().toLocaleLowerCase();
  const isSuggestion = options.includes(value);
  const shown = isSuggestion
    ? options
    : options.filter((option) => option.toLocaleLowerCase().includes(query));

  return (
    <HeroComboBox
      fullWidth
      className="gap-2"
      name={name}
      allowsCustomValue
      allowsEmptyCollection
      menuTrigger="focus"
      defaultFilter={() => true}
      inputValue={value}
      onInputChange={onChange}
      onSelectionChange={(key) => {
        if (key !== null) onChange(String(key));
      }}
      onBlur={onBlur}
      isDisabled={isDisabled}
      isRequired={isRequired}
      isInvalid={Boolean(errorMessage)}
      validationBehavior="aria"
    >
      <Label className="text-base">{label}</Label>
      <HeroComboBox.InputGroup>
        <Input
          ref={inputRef}
          placeholder={placeholder}
          className="min-h-11 text-base sm:text-base"
        />
        <HeroComboBox.Trigger className="min-h-11 min-w-11">
          <img src={chevronDownUrl} alt="" aria-hidden="true" width={16} height={16} />
        </HeroComboBox.Trigger>
      </HeroComboBox.InputGroup>
      {description && !errorMessage ? (
        <Description className="text-sm">{description}</Description>
      ) : null}
      {errorMessage ? <FieldError className="text-sm">{errorMessage}</FieldError> : null}
      <HeroComboBox.Popover>
        <ListBox>
          {shown.map((option) => (
            <ListBox.Item
              key={option}
              id={option}
              textValue={option}
              className="min-h-11 text-base"
            >
              {option}
            </ListBox.Item>
          ))}
        </ListBox>
      </HeroComboBox.Popover>
    </HeroComboBox>
  );
}
