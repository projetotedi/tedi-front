import { Chip as HeroChip } from "@heroui/react";
import type { ReactNode } from "react";

export interface ChipProps {
  children: ReactNode;
  color?: "default" | "accent" | "success" | "warning" | "danger";
}

/** Etiqueta de status. A cor só reforça: o texto sempre diz o estado. */
export function Chip({ children, color = "default" }: ChipProps) {
  return (
    <HeroChip color={color} variant="soft" className="text-sm">
      {children}
    </HeroChip>
  );
}
