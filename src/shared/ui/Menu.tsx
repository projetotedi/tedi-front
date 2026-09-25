import { Dropdown } from "@heroui/react";
import type { ReactElement, ReactNode } from "react";

export interface MenuAction {
  id: string;
  label: string;
  onAction: () => void;
}

export interface MenuProps {
  /** Nome acessível do gatilho (o conteúdo visual de `trigger` é decorativo para o leitor de tela). */
  triggerLabel: string;
  /**
   * `aria-label` da lista de ações. O React Aria também liga o menu ao gatilho por
   * `aria-labelledby`, que vence na leitura do nome: hoje o menu é anunciado com `triggerLabel`,
   * e este rótulo fica como reserva.
   */
  menuLabel: string;
  /** Conteúdo visual do gatilho (avatar, texto, ícone). */
  trigger: ReactNode;
  items: MenuAction[];
}

/**
 * Menu suspenso de ações sobre o `Dropdown` do HeroUI: abre por clique, Enter, Espaço ou seta
 * para baixo, navega por setas, fecha por Esc ou ao escolher, e devolve o foco ao gatilho.
 */
export function Menu({ triggerLabel, menuLabel, trigger, items }: MenuProps): ReactElement {
  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={triggerLabel}
        className="flex min-h-11 items-center gap-2.5 rounded-xl px-2 outline-offset-4 focus-visible:outline-2 focus-visible:outline-focus"
      >
        {trigger}
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu
          aria-label={menuLabel}
          onAction={(key) => items.find((item) => item.id === String(key))?.onAction()}
        >
          {items.map((item) => (
            <Dropdown.Item
              key={item.id}
              id={item.id}
              textValue={item.label}
              className="min-h-11 text-base"
            >
              {item.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
