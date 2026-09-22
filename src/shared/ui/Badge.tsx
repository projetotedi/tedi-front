import type { ReactNode } from "react";

export interface BadgeProps {
  tone: "neutral" | "info" | "success" | "warning" | "danger";
  children: ReactNode;
}

const TONES = {
  neutral: "bg-tedi-neutral text-tedi-neutral-foreground",
  info: "bg-tedi-badge text-tedi-badge-foreground",
  success: "bg-tedi-success text-tedi-success-foreground",
  warning: "bg-tedi-warning text-tedi-warning-foreground",
  danger: "bg-tedi-danger text-tedi-danger-foreground",
} as const;

/** Selo de situação (perfil, status) usado nas tabelas de Acessos e Convites. */
export function Badge({ tone, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full px-3 text-sm font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
