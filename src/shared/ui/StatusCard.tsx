import { useEffect, useRef, type ReactNode } from "react";

export interface StatusCardProps {
  variant: "success" | "warning";
  title: string;
  description: ReactNode;
  children?: ReactNode;
  isAlert?: boolean;
  headingLevel?: 1 | 2;
  autoFocus?: boolean;
}

const VARIANTS = {
  success: { glyph: "✓", className: "bg-tedi-success text-tedi-success-foreground" },
  warning: { glyph: "!", className: "bg-tedi-warning text-tedi-warning-foreground" },
} as const;

export function StatusCard({
  variant,
  title,
  description,
  children,
  isAlert = false,
  headingLevel = 2,
  autoFocus = false,
}: StatusCardProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { glyph, className } = VARIANTS[variant];
  const Heading = headingLevel === 1 ? "h1" : "h2";

  useEffect(() => {
    if (autoFocus) titleRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div role={isAlert ? "alert" : undefined} className="flex flex-col items-center gap-4">
        <div
          aria-hidden="true"
          className={`flex size-14 items-center justify-center rounded-full text-2xl font-bold ${className}`}
        >
          {glyph}
        </div>
        <Heading
          ref={titleRef}
          tabIndex={autoFocus ? -1 : undefined}
          className="rounded-md text-[22px] leading-7 font-semibold text-foreground outline-offset-4 focus-visible:outline-2 focus-visible:outline-focus"
        >
          {title}
        </Heading>
        <p className="text-base text-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}
