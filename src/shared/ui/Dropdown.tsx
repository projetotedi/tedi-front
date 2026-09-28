import { Dropdown as HeroDropdown } from "@heroui/react";
import type { Key, ReactNode } from "react";

export interface DropdownItem {
  id: string;
  /** Texto já traduzido. */
  label: string;
}

export interface DropdownProps {
  /** Nome acessível do botão que abre o menu. */
  label: string;
  /** Conteúdo visível do botão; um chevron é acrescentado ao final. */
  trigger: ReactNode;
  /** Bloco não interativo no topo do menu (ex.: identificação do usuário). */
  header?: ReactNode;
  items: DropdownItem[];
  onAction: (id: string) => void;
}

/** Menu suspenso acionado por botão (React Aria: abre com Enter/Espaço/seta, navega por setas). */
export function Dropdown({ label, trigger, header, items, onAction }: DropdownProps) {
  return (
    <HeroDropdown>
      <HeroDropdown.Trigger
        aria-label={label}
        className="flex min-h-11 items-center gap-2 rounded-full px-1.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {trigger}
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </HeroDropdown.Trigger>
      <HeroDropdown.Popover placement="bottom end" className="min-w-60">
        {header && <div className="px-3 pt-3 pb-2">{header}</div>}
        {header && <hr className="mx-2 border-border" />}
        <HeroDropdown.Menu aria-label={label} onAction={(key: Key) => onAction(String(key))}>
          {items.map((item) => (
            <HeroDropdown.Item
              key={item.id}
              id={item.id}
              textValue={item.label}
              className="min-h-11 text-base"
            >
              {item.label}
            </HeroDropdown.Item>
          ))}
        </HeroDropdown.Menu>
      </HeroDropdown.Popover>
    </HeroDropdown>
  );
}
