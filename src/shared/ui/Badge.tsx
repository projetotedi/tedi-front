import type { ReactNode } from "react";

export interface BadgeProps {
  tone: "neutral" | "info" | "highlight" | "success" | "warning" | "danger";
  children: ReactNode;
}

const TONES = {
  neutral: "bg-tedi-neutral text-tedi-neutral-foreground",
  info: "bg-tedi-badge text-tedi-badge-foreground",
  highlight: "bg-tedi-highlight text-tedi-highlight-foreground",
  success: "bg-tedi-badge-success text-tedi-badge-success-foreground",
  warning: "bg-tedi-warning text-tedi-warning-foreground",
  danger: "bg-tedi-danger text-tedi-danger-foreground",
} as const;

/** Selo de situação (perfil, status) usado nas tabelas de Acessos e Convites. */
export function Badge({ tone, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
