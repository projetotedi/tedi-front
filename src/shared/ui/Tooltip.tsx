import { Tooltip as HeroTooltip } from "@heroui/react";
import type { ReactElement } from "react";

export interface TooltipProps {
  /** Texto curto do tooltip (já traduzido). */
  content: string;
  /**
   * O gatilho: um único `Button` de `@shared/ui`. O tooltip se liga a ele pelo contexto do React
   * Aria, então o filho precisa ser um componente do React Aria (o `Button` é).
   */
  children: ReactElement;
  /** Espera, em ms, antes de abrir com o mouse. Com o foco do teclado abre na hora. */
  delay?: number;
}

/**
 * Tooltip de um botão só-ícone: complementa o `aria-label`, não o substitui. Abre com o mouse e
 * com o foco do teclado, e fecha com Esc (WCAG 1.4.13).
 *
 * Não usa o `Tooltip.Trigger` do HeroUI de propósito: ele desenha uma `div role="button"` com
 * `tabIndex`, e embrulhar o `Button` nela criaria um segundo ponto de Tab no mesmo ícone.
 */
export function Tooltip({ content, children, delay = 300 }: TooltipProps): ReactElement {
  return (
    <HeroTooltip.Root delay={delay}>
      {children}
      {/* O HeroUI usa `text-xs` e quebra a palavra em qualquer letra (`break-all`): 16px e quebra normal. */}
      <HeroTooltip.Content className="text-base break-normal">{content}</HeroTooltip.Content>
    </HeroTooltip.Root>
  );
}
