import { Drawer as HeroDrawer } from "@heroui/react";
import type { ReactNode } from "react";

export interface DrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Título do painel (lido ao abrir). */
  title: string;
  /** Nome acessível do botão de fechar. */
  closeLabel: string;
  id?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Painel lateral modal, controlado de fora (o botão que abre fica com quem usa, para
 * poder levar `aria-expanded`/`aria-controls`). Prende o foco e fecha com Esc ou clique fora.
 */
export function Drawer({
  isOpen,
  onOpenChange,
  title,
  closeLabel,
  id,
  children,
  className = "",
}: DrawerProps) {
  return (
    <HeroDrawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <HeroDrawer.Content placement="left" className={`max-w-80 ${className}`}>
        <HeroDrawer.Dialog id={id} className="h-full bg-inherit">
          <HeroDrawer.CloseTrigger aria-label={closeLabel} className="min-h-11 min-w-11" />
          <HeroDrawer.Header>
            <HeroDrawer.Heading className="sr-only">{title}</HeroDrawer.Heading>
          </HeroDrawer.Header>
          <HeroDrawer.Body>{children}</HeroDrawer.Body>
        </HeroDrawer.Dialog>
      </HeroDrawer.Content>
    </HeroDrawer.Backdrop>
  );
}
