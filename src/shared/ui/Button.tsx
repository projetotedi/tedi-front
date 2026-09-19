import { Button as HeroButton, type ButtonProps as HeroButtonProps } from "@heroui/react";

export type ButtonProps = Omit<HeroButtonProps, "className"> & { className?: string };

/** Botão do TEDI: alvo de toque de 44px (acessibilidade para público idoso) sobre o HeroUI. */
export function Button({ className = "", ...props }: ButtonProps) {
  return <HeroButton {...props} className={`min-h-11 ${className}`} />;
}
