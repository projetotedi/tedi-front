import { useState } from "react";

import { Button } from "./Button";
import { TextField, type TextFieldProps } from "./TextField";

export interface PasswordFieldProps extends Omit<TextFieldProps, "type" | "endContent"> {
  showLabel: string;
  hideLabel: string;
}

export function PasswordField({ showLabel, hideLabel, ...fieldProps }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <TextField
      {...fieldProps}
      type={isVisible ? "text" : "password"}
      endContent={
        <Button
          type="button"
          isIconOnly
          variant="ghost"
          aria-label={isVisible ? hideLabel : showLabel}
          isDisabled={fieldProps.isDisabled}
          onPress={() => setIsVisible((visible) => !visible)}
        >
          {isVisible ? <EyeOffIcon /> : <EyeIcon />}
        </Button>
      }
    />
  );
}

const ICON_PROPS = {
  "aria-hidden": true,
  focusable: false,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  // 24px dentro do alvo de 44px (o HeroUI reduz svgs de botão para 16px).
  className: "size-6",
} as const;

function EyeIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M4 4l16 16" />
    </svg>
  );
}
