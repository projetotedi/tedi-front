import { Tabs as HeroTabs } from "@heroui/react";
import type { ReactElement, ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

export interface TabsProps {
  label: string;
  items: TabItem[];
  selectedKey: string;
  onSelectionChange: (key: string) => void;
}

export function Tabs({ label, items, selectedKey, onSelectionChange }: TabsProps): ReactElement {
  return (
    <HeroTabs
      selectedKey={selectedKey}
      onSelectionChange={(key) => onSelectionChange(String(key))}
    >
      <HeroTabs.ListContainer>
        <HeroTabs.List aria-label={label}>
          {items.map((item) => (
            <HeroTabs.Tab
              key={item.id}
              id={item.id}
              className="min-h-11 text-base data-[selected]:font-semibold"
            >
              {item.label}
            </HeroTabs.Tab>
          ))}
        </HeroTabs.List>
      </HeroTabs.ListContainer>
      {items.map((item) => (
        <HeroTabs.Panel key={item.id} id={item.id} className="pt-4">
          {item.content}
        </HeroTabs.Panel>
      ))}
    </HeroTabs>
  );
}
