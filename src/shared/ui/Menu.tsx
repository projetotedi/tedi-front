import { Dropdown } from "@heroui/react";
import type { ReactElement, ReactNode } from "react";

export interface MenuAction {
  id: string;
  label: string;
  onAction: () => void;
}

export interface MenuProps {
  triggerLabel: string;
  /** O React Aria nomeia o menu pelo gatilho (`aria-labelledby`); este rótulo é só reserva. */
  menuLabel: string;
  trigger: ReactNode;
  items: MenuAction[];
}

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
