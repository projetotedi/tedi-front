import { Alert as HeroAlert } from "@heroui/react";
import type { ReactNode } from "react";

export interface AlertProps {
  /**
   * `error`: falha que a pessoa precisa saber já (`role="alert"`, anunciada na hora).
   * `info`: aviso sem urgência (`role="status"`, `aria-live="polite"`, anunciado sem interromper).
   */
  variant: "error" | "info";
  /** Sem conteúdo o Alert não renderiza nada: uma região `alert` vazia confundiria leitores de tela. */
  children?: ReactNode;
  id?: string;
}

const VARIANTS = {
  error: {
    status: "danger",
    role: "alert",
    className: "border border-danger bg-danger-soft",
  },
  info: {
    status: "accent",
    role: "status",
    className: "border border-accent bg-accent-soft",
  },
} as const;

function isEmpty(children: ReactNode): boolean {
  return children === null || children === undefined || children === false || children === "";
}

/** Aviso do TEDI sobre o Alert do HeroUI: texto de 16px, ícone decorativo e região ARIA por variante. */
export function Alert({ variant, children, id }: AlertProps) {
  if (isEmpty(children)) return null;

  const { status, role, className } = VARIANTS[variant];

  return (
    <HeroAlert
      id={id}
      status={status}
      role={role}
      aria-live={variant === "info" ? "polite" : undefined}
      className={`rounded-xl ${className}`}
    >
      <HeroAlert.Indicator aria-hidden="true" />
      <HeroAlert.Content>
        <HeroAlert.Title className="text-base">{children}</HeroAlert.Title>
      </HeroAlert.Content>
    </HeroAlert>
  );
}
