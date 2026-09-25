import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Dialog } from "../Dialog";

function Harness({ onOpenChange }: { onOpenChange?: (isOpen: boolean) => void }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(next) => {
        setIsOpen(next);
        onOpenChange?.(next);
      }}
      title="Gerar convite"
      description="Escolha o perfil da pessoa convidada."
      closeLabel="Fechar"
    >
      <p>Conteúdo do diálogo</p>
    </Dialog>
  );
}

describe("Dialog", () => {
  it("renders a dialog named by its title and described by its description", () => {
    render(<Harness />);

    const dialog = screen.getByRole("dialog", { name: "Gerar convite" });
    expect(dialog).toHaveAccessibleDescription("Escolha o perfil da pessoa convidada.");
  });

  it("limits the dialog to 640px (the HeroUI md size would cap it at 448px)", () => {
    render(<Harness />);

    expect(screen.getByRole("dialog", { name: "Gerar convite" })).toHaveClass("max-w-160");
  });

  it("close button calls onOpenChange(false)", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: "Fechar" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Escape calls onOpenChange(false)", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);

    await user.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not render content when closed", () => {
    render(
      <Dialog isOpen={false} onOpenChange={() => {}} title="Gerar convite" closeLabel="Fechar">
        <p>Conteúdo do diálogo</p>
      </Dialog>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Conteúdo do diálogo")).not.toBeInTheDocument();
  });

  it("isDismissable={false} blocks both the close button and Escape", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Dialog
        isOpen
        onOpenChange={onOpenChange}
        title="Gerar convite"
        closeLabel="Fechar"
        isDismissable={false}
      >
        <p>Conteúdo do diálogo</p>
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: "Fechar" }));
    await user.keyboard("{Escape}");

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
