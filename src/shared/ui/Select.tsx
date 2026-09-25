import { Description, FieldError, Label, ListBox, Select as HeroSelect } from "@heroui/react";
import type { ReactElement } from "react";

import chevronDownUrl from "../assets/icons/chevron-down.svg";

export interface SelectOption {
  id: string;
  label: string;
}

export interface SelectProps {
  label: string;
  /**
   * Esconde o rótulo só visualmente (`sr-only`): o gatilho continua nomeado para leitores de
   * tela. Usar quando o desenho mostra o valor já contextualizado no próprio gatilho.
   */
  isLabelHidden?: boolean;
  options: SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  /**
   * Texto mostrado no gatilho (ex.: "Papel: todos"). Recebe a opção selecionada, ou `null`
   * quando `value` não corresponde a nenhuma opção. Sem ela, o gatilho mostra o rótulo da opção.
   */
  formatValue?: (selected: SelectOption | null) => string;
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
  autoFocus,
}: SelectProps): ReactElement {
  const selected = options.find((option) => option.id === value) ?? null;

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
      <Label className={isLabelHidden ? "sr-only" : "text-base"}>{label}</Label>
      <HeroSelect.Trigger className="min-h-11 rounded-xl text-base">
        <HeroSelect.Value>{formatValue ? () => formatValue(selected) : undefined}</HeroSelect.Value>
        <HeroSelect.Indicator>
          <img src={chevronDownUrl} alt="" aria-hidden="true" width={16} height={16} />
        </HeroSelect.Indicator>
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
