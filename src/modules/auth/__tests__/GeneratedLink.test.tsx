import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GeneratedLink, type GeneratedLinkProps } from "../components/GeneratedLink";
import { renderWithProviders } from "./test-utils";

const LINK = "https://tedi.example/reset-password?token=plain-text-token";

function mockClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

function clearClipboard() {
  Object.defineProperty(navigator, "clipboard", {
    value: undefined,
    configurable: true,
  });
}

async function renderLink(props: Partial<GeneratedLinkProps> = {}) {
  const onDone = vi.fn();
  await renderWithProviders(
    <GeneratedLink
      url={LINK}
      linkLabel="Link gerado"
      validityTitle="Copie o link agora"
      validityDescription="Vale por 48 horas e só pode ser usado uma vez."
      onDone={onDone}
      {...props}
    >
      <p>Contexto da pessoa</p>
    </GeneratedLink>,
  );
  return { onDone };
}

describe("GeneratedLink", () => {
  it("shows the link read-only under the given label, after the context", async () => {
    await renderLink();

    const field = screen.getByLabelText("Link gerado");
    expect(field).toHaveValue(LINK);
    expect(field).toHaveAttribute("readonly");
    expect(screen.getByText("Contexto da pessoa")).toBeInTheDocument();
  });

  it("focuses Copiar link and describes it with the validity notice", async () => {
    await renderLink();

    const copyButton = screen.getByRole("button", { name: "Copiar link" });
    expect(copyButton).toHaveFocus();
    expect(copyButton).toHaveAccessibleDescription(/Copie o link agora/);
    expect(copyButton).toHaveAccessibleDescription(/48 horas/);
  });

  it("copies the url and confirms", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    await renderLink();

    await user.click(screen.getByRole("button", { name: "Copiar link" }));

    expect(writeText).toHaveBeenCalledWith(LINK);
    expect(await screen.findByText("Link copiado.")).toBeInTheDocument();
  });

  it("falls back to selecting the link when the clipboard is unavailable", async () => {
    const user = userEvent.setup();
    clearClipboard();
    await renderLink();

    await user.click(screen.getByRole("button", { name: "Copiar link" }));

    expect(await screen.findByText(/Não foi possível copiar automaticamente/)).toBeInTheDocument();
    expect(screen.getByLabelText("Link gerado")).toHaveFocus();
  });

  it("falls back to selecting the link when the clipboard write rejects", async () => {
    const user = userEvent.setup();
    mockClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    await renderLink();

    await user.click(screen.getByRole("button", { name: "Copiar link" }));

    expect(await screen.findByText(/Não foi possível copiar automaticamente/)).toBeInTheDocument();
  });

  it("Concluir calls onDone", async () => {
    const user = userEvent.setup();
    const { onDone } = await renderLink();

    await user.click(screen.getByRole("button", { name: "Concluir" }));

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("the stacked layout puts Copiar link under the field", async () => {
    await renderLink();

    const copyButton = screen.getByRole("button", { name: "Copiar link" });
    expect(copyButton.parentElement).toHaveClass("flex-col", "gap-5");
    expect(copyButton.parentElement).not.toHaveClass("sm:flex-row");
  });

  it("the inline layout puts Copiar link beside the field, aligned to its base", async () => {
    await renderLink({ layout: "inline" });

    const field = screen.getByLabelText("Link gerado");
    const copyButton = screen.getByRole("button", { name: "Copiar link" });
    expect(copyButton.parentElement).toHaveClass("sm:flex-row", "sm:items-end");
    expect(copyButton.parentElement).toContainElement(field);
  });
});
