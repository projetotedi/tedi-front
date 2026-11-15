import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog, type ConfirmDialogProps } from "../ConfirmDialog";

function renderDialog(props: Partial<ConfirmDialogProps> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  render(
    <ConfirmDialog
      isOpen
      title="Revogar convite"
      confirmLabel="Revogar"
      confirmingLabel="Revogando…"
      cancelLabel="Voltar"
      closeLabel="Fechar"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    >
      <p>O link deixa de valer na hora.</p>
    </ConfirmDialog>,
  );

  return { onConfirm, onCancel };
}

describe("ConfirmDialog", () => {
  it("renders the title, the body and both buttons", () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: "Revogar convite" });
    expect(dialog).toHaveTextContent("O link deixa de valer na hora.");
    expect(screen.getByRole("button", { name: "Revogar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    renderDialog({ isOpen: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onConfirm only when confirming", async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderDialog();

    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Revogar" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Voltar calls onCancel", async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Voltar" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("the close button and Escape also call onCancel", async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("cannot be dismissed while confirming", async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderDialog({ isConfirming: true });

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    await user.click(screen.getByRole("button", { name: "Voltar" }));

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Revogando…" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revogar" })).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("does not call onConfirm again while confirming", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog({ isConfirming: true });

    await user.click(screen.getByRole("button", { name: "Revogando…" }));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("keeps the confirm label while confirming when there is no confirmingLabel", () => {
    renderDialog({ isConfirming: true, confirmingLabel: undefined });

    expect(screen.getByRole("button", { name: "Revogar" })).toBeInTheDocument();
  });

  it("renders errorMessage as an alert and moves the focus to it", async () => {
    renderDialog({ errorMessage: "Não foi possível conectar. Tente de novo." });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível conectar. Tente de novo.");
    await waitFor(() => expect(alert.parentElement).toHaveFocus());
  });

  it("renders no alert without an errorMessage", () => {
    renderDialog();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("uses the solid danger button for tone danger and the primary one by default", () => {
    const { unmount } = render(
      <ConfirmDialog
        isOpen
        title="Desativar acesso"
        confirmLabel="Desativar"
        cancelLabel="Voltar"
        closeLabel="Fechar"
        tone="danger"
        onConfirm={() => {}}
        onCancel={() => {}}
      >
        <p>Corpo</p>
      </ConfirmDialog>,
    );
    expect(screen.getByRole("button", { name: "Desativar" })).toHaveClass("button--danger");
    unmount();

    renderDialog();
    expect(screen.getByRole("button", { name: "Revogar" })).toHaveClass("button--primary");
  });

  it("keeps the 44px touch targets and the secondary style on Voltar", () => {
    renderDialog();

    expect(screen.getByRole("button", { name: "Voltar" })).toHaveClass(
      "button--secondary",
      "min-h-11",
    );
    expect(screen.getByRole("button", { name: "Revogar" })).toHaveClass("min-h-11");
  });
});
