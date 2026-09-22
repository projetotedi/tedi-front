import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Tabs, type TabsProps } from "../Tabs";

const ITEMS: TabsProps["items"] = [
  { id: "people", label: "Pessoas", content: <p>Conteúdo de pessoas</p> },
  { id: "invites", label: "Convites", content: <p>Conteúdo de convites</p> },
];

function Harness({ onSelectionChange }: { onSelectionChange?: (key: string) => void }) {
  const [selectedKey, setSelectedKey] = useState("people");

  return (
    <Tabs
      label="Acessos"
      items={ITEMS}
      selectedKey={selectedKey}
      onSelectionChange={(key) => {
        setSelectedKey(key);
        onSelectionChange?.(key);
      }}
    />
  );
}

describe("Tabs", () => {
  it("renders a tablist with named tabs", () => {
    render(<Harness />);

    expect(screen.getByRole("tablist", { name: "Acessos" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Pessoas" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Convites" })).toBeInTheDocument();
  });

  it("only the selected panel is rendered", () => {
    render(<Harness />);

    expect(screen.getByText("Conteúdo de pessoas")).toBeInTheDocument();
    expect(screen.queryByText("Conteúdo de convites")).not.toBeInTheDocument();
  });

  it("switching tab calls onSelectionChange by click", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(<Harness onSelectionChange={onSelectionChange} />);

    await user.click(screen.getByRole("tab", { name: "Convites" }));

    expect(onSelectionChange).toHaveBeenCalledWith("invites");
    expect(screen.getByText("Conteúdo de convites")).toBeInTheDocument();
    expect(screen.queryByText("Conteúdo de pessoas")).not.toBeInTheDocument();
  });

  it("switching tab calls onSelectionChange by keyboard", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(<Harness onSelectionChange={onSelectionChange} />);

    await user.click(screen.getByRole("tab", { name: "Pessoas" }));
    await user.keyboard("{ArrowRight}");

    expect(onSelectionChange).toHaveBeenCalledWith("invites");
    expect(screen.getByRole("tab", { name: "Convites" })).toHaveFocus();
  });
});
