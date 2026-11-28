import type { ReactElement, ReactNode } from "react";

/**
 * The label of a required field, with the red asterisk of the Figma. The asterisk is only seen: the
 * field says it is required to the screen reader (`isRequired`).
 */
export function RequiredLabel({ children }: { children: ReactNode }): ReactElement {
  return (
    <>
      {children}
      <span className="ms-0.5 text-danger" aria-hidden="true">
        *
      </span>
    </>
  );
}
