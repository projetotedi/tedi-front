import type { ReactNode } from "react";

export interface BadgeProps {
  tone: "neutral" | "info" | "highlight" | "success";
  children: ReactNode;
}

const TONES = {
  neutral: "bg-tedi-neutral text-tedi-neutral-foreground",
  info: "bg-tedi-badge text-tedi-badge-foreground",
  highlight: "bg-tedi-highlight text-tedi-highlight-foreground",
  success: "bg-tedi-badge-success text-tedi-badge-success-foreground",
} as const;

/** Selo de situação (papel, status) usado na tabela de membros. */
export function Badge({ tone, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
