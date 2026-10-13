import type { RefObject } from "react";

export interface StepSectionProps {
  headingRef: RefObject<HTMLHeadingElement | null>;
  isDisabled: boolean;
}

export const STEP_HEADING_CLASS =
  "w-fit rounded-md text-base font-semibold text-foreground outline-offset-4 focus-visible:outline-2 focus-visible:outline-focus";
