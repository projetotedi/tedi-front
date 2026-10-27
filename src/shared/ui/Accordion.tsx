import { Accordion as HeroAccordion } from "@heroui/react";
import type { Key, ReactNode } from "react";

import chevronRightUrl from "../assets/icons/chevron-right.svg";

export interface AccordionSection {
  id: string;
  /** Texto já traduzido. */
  title: string;
  /** URL de um SVG decorativo de 24px, à esquerda do título. */
  icon?: string;
  content: ReactNode;
}

export interface AccordionProps {
  items: AccordionSection[];
  /** Ids das seções abertas; quem usa guarda o estado (componente controlado). */
  expandedKeys: string[];
  onExpandedChange: (keys: string[]) => void;
  /** Várias seções abertas ao mesmo tempo (padrão); `false` mantém só uma. */
  allowsMultipleExpanded?: boolean;
  className?: string;
}

/**
 * Seção aberta: vira um cartão com borda de 2px (Figma "Sidebar TEDI"). `border-solid` é
 * necessário porque o item do HeroUI zera o estilo da borda, e o `border-2` sozinho não a mostra.
 */
const ITEM_CLASSES = [
  "group",
  "data-[expanded=true]:rounded-[14px] data-[expanded=true]:border-2 data-[expanded=true]:border-solid",
  "data-[expanded=true]:border-tedi-sidebar-accent data-[expanded=true]:bg-tedi-sidebar-group-open",
  "data-[expanded=true]:p-1 data-[expanded=true]:pb-1.5",
].join(" ");

/**
 * Linha da seção: 48px de altura, 16px de fonte. O HeroUI traz `px-4 py-4 text-sm`, por isso
 * o `py-0` e o padding à parte. O anel de foco não tem afastamento (o tema do HeroUI põe 2px)
 * e usa `outline-hidden`, que continua visível no modo de alto contraste.
 */
const TRIGGER_CLASSES = [
  "flex min-h-12 w-full items-center gap-3 rounded-xl py-0 pr-3 pl-3.5",
  "text-base font-medium text-foreground outline-hidden aria-expanded:font-semibold",
  "hover:bg-white/40",
  "focus-visible:ring-3 focus-visible:ring-tedi-focus-ring focus-visible:ring-offset-0",
].join(" ");

/**
 * Lista de seções que abrem e fecham (padrão disclosure: cada título é um botão com
 * `aria-expanded` e `aria-controls`, aberto por Enter ou Espaço), sobre o `Accordion` do
 * HeroUI. O `Indicator`, o `Body` e o `Heading` dele não são usados: o primeiro gira para
 * baixo e o chevron daqui aponta para a direita, o segundo injeta padding e cor de texto, e
 * o terceiro criaria títulos de nível 3 dentro do `<nav>` do menu.
 *
 * O painel do HeroUI corta o que passa da borda (`overflow: clip`): o conteúdo deve
 * desenhar o foco por dentro (`ring-inset`) e não pode ter padding no próprio painel.
 */
export function Accordion({
  items,
  expandedKeys,
  onExpandedChange,
  allowsMultipleExpanded = true,
  className = "",
}: AccordionProps) {
  return (
    <HeroAccordion
      hideSeparator
      allowsMultipleExpanded={allowsMultipleExpanded}
      expandedKeys={expandedKeys}
      onExpandedChange={(keys: Set<Key>) => onExpandedChange([...keys].map(String))}
      className={`flex flex-col gap-1.5 ${className}`}
    >
      {items.map((item) => (
        <HeroAccordion.Item key={item.id} id={item.id} className={ITEM_CLASSES}>
          <HeroAccordion.Trigger className={TRIGGER_CLASSES}>
            {item.icon && <img src={item.icon} alt="" aria-hidden="true" className="size-6" />}
            <span className="flex-1">{item.title}</span>
            <img
              src={chevronRightUrl}
              alt=""
              aria-hidden="true"
              className="h-3 w-1.75 shrink-0 transition-transform duration-200 group-data-[expanded=true]:rotate-90 motion-reduce:transition-none"
            />
          </HeroAccordion.Trigger>
          <HeroAccordion.Panel>{item.content}</HeroAccordion.Panel>
        </HeroAccordion.Item>
      ))}
    </HeroAccordion>
  );
}
