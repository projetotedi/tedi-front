import type { ReactElement, ReactNode } from "react";

/**
 * The label of a required field: the text and a red asterisk that only sighted people see. The
 * field itself says it is required to the screen reader (`isRequired`), so the asterisk is hidden
 * from it and does not become part of the name of the field.
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
