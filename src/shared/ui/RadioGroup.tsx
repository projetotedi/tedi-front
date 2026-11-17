import {
  Description,
  FieldError,
  Label,
  Radio as HeroRadio,
  RadioGroup as HeroRadioGroup,
} from "@heroui/react";
import type { ReactElement, ReactNode, Ref } from "react";

export interface RadioOption {
  value: string;
  label: ReactNode;
  /** Text under the label, tied to the radio by `aria-describedby`. */
  description?: ReactNode;
  isDisabled?: boolean;
}

export interface RadioGroupProps {
  label: ReactNode;
  /** `null` when nothing is chosen. */
  value: string | null;
  onChange: (value: string) => void;
  options: RadioOption[];
  name?: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  orientation?: "horizontal" | "vertical";
  description?: string;
  errorMessage?: string;
  /** Goes to the first enabled option, the one `setFocus` of React Hook Form can reach. */
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * A group of radios: one visible label for the group, one label and an optional description for
 * each option. The options sit in a wrapper of their own, so the label, the options, the help text
 * and the error stay stacked whatever the orientation (the group of the HeroUI would put them all
 * in one row when it is horizontal). The required asterisk comes from the HeroUI style of the
 * label of a required group, the same way as in `TextArea`; the same style would draw one on the
 * label of every option too (each is marked required as well), which `after:hidden` takes away, and
 * would turn them red when the group is invalid, so they keep the text color (the group's own
 * label and the error say what is wrong).
 */
export function RadioGroup({
  label,
  value,
  onChange,
  options,
  name,
  isRequired,
  isDisabled,
  orientation = "vertical",
  description,
  errorMessage,
  inputRef,
}: RadioGroupProps): ReactElement {
  const firstEnabled = options.find((option) => !option.isDisabled);

  return (
    <HeroRadioGroup
      name={name}
      value={value}
      onChange={onChange}
      isRequired={isRequired}
      isDisabled={isDisabled}
      isInvalid={Boolean(errorMessage)}
      validationBehavior="aria"
      orientation={orientation}
      className="flex-col flex-nowrap gap-2"
    >
      <Label className="text-base">{label}</Label>
      <div
        className={
          orientation === "horizontal" ? "flex flex-wrap gap-x-8 gap-y-1" : "flex flex-col gap-1"
        }
      >
        {options.map((option) => (
          <HeroRadio
            key={option.value}
            value={option.value}
            isDisabled={option.isDisabled}
            inputRef={option === firstEnabled ? inputRef : undefined}
            className="gap-0"
          >
            <HeroRadio.Content className="min-h-11 gap-3">
              <HeroRadio.Control className="size-5">
                <HeroRadio.Indicator />
              </HeroRadio.Control>
              <Label className="text-base text-foreground after:hidden">{option.label}</Label>
            </HeroRadio.Content>
            {option.description ? (
              <Description className="-mt-2 pb-1 ps-8 text-sm">{option.description}</Description>
            ) : null}
          </HeroRadio>
        ))}
      </div>
      {description && !errorMessage ? (
        <Description className="text-sm">{description}</Description>
      ) : null}
      {errorMessage ? <FieldError className="text-sm">{errorMessage}</FieldError> : null}
    </HeroRadioGroup>
  );
}
