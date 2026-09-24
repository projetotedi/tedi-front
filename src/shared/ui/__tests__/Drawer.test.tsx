import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Drawer } from "../Drawer";

describe("Drawer", () => {
  it("renders nothing while closed", () => {
    render(
      <Drawer isOpen={false} onOpenChange={vi.fn()} title="Menu" closeLabel="Fechar menu">
        <p>Conteúdo</p>
      </Drawer>,
    );

    expect(screen.queryByText("Conteúdo")).not.toBeInTheDocument();
  });

  it("renders a titled dialog and closes from its close button", async () => {
    const onOpenChange = vi.fn();
    render(
      <Drawer
        isOpen
        onOpenChange={onOpenChange}
        title="Menu"
        closeLabel="Fechar menu"
        id="app-menu"
      >
        <p>Conteúdo</p>
      </Drawer>,
    );

    const dialog = await screen.findByRole("dialog", { name: "Menu" });
    expect(dialog).toHaveAttribute("id", "app-menu");
    expect(screen.getByText("Conteúdo")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Fechar menu" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
