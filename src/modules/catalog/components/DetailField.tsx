import type { ReactElement, ReactNode } from "react";

export interface DetailFieldProps {
  label: string;
  children: ReactNode;
  /** Layout classes of the field inside its `<dl>` (for instance, how many columns it spans). */
  className?: string;
}

/**
 * One label/value pair of a `<dl>`. The label is 12px and the value 16px: the Figma asks for 10px
 * and 14px, but the AGENTS.md accessibility rules (base font of 16px) win.
 */
export function DetailField({ label, children, className }: DetailFieldProps): ReactElement {
  return (
    <div className={className}>
      <dt className="text-xs font-semibold text-muted uppercase">{label}</dt>
      <dd className="mt-1 text-base break-words">{children}</dd>
    </div>
  );
}
