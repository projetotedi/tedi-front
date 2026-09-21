import { Alert as HeroAlert } from "@heroui/react";
import type { ReactNode } from "react";

export interface AlertProps {
  /** `info` fica sempre montado e vazio: leitores de tela não anunciam uma região viva que nasce preenchida. */
  variant: "error" | "info";
  children?: ReactNode;
  id?: string;
}

const VARIANTS = {
  error: { status: "danger", className: "border border-danger bg-danger-soft" },
  info: { status: "accent", className: "border border-accent bg-accent-soft" },
} as const;

function isEmpty(children: ReactNode): boolean {
  return children === null || children === undefined || children === false || children === "";
}

export function Alert({ variant, children, id }: AlertProps) {
  const { status, className } = VARIANTS[variant];
  const isError = variant === "error";

  const box = isEmpty(children) ? null : (
    <HeroAlert
      id={isError ? id : undefined}
      status={status}
      role={isError ? "alert" : undefined}
      className={`rounded-xl ${className}`}
    >
      <HeroAlert.Indicator aria-hidden="true" />
      <HeroAlert.Content>
        <HeroAlert.Title className="text-base">{children}</HeroAlert.Title>
      </HeroAlert.Content>
    </HeroAlert>
  );

  if (isError) return box;

  // Vazia, sai do fluxo por `sr-only`. Nunca `display: none`: isso a tira da árvore de acessibilidade.
  return (
    <div id={id} role="status" aria-live="polite" className="empty:sr-only">
      {box}
    </div>
  );
}
