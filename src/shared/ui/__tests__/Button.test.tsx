import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "../Button";

describe("Button", () => {
  // Exceção consciente à regra "asserção por papel, não por classe": o jsdom não carrega CSS
  // (getBoundingClientRect devolve 0), então o alvo de 44px só é verificável pela classe
  // min-h-11 do Tailwind (2.75rem). A medida real é conferida no navegador.
  it("keeps the 44px touch target", () => {
    render(<Button>Salvar</Button>);

    expect(screen.getByRole("button", { name: "Salvar" })).toHaveClass("min-h-11");
  });

  it("keeps the 16px base font", () => {
    render(<Button>Salvar</Button>);

    expect(screen.getByRole("button", { name: "Salvar" })).toHaveClass("text-base");
  });

  it("keeps a 44px touch target on icon-only buttons", () => {
    render(
      <Button isIconOnly aria-label="Mostrar">
        <svg aria-hidden="true" />
      </Button>,
    );

    expect(screen.getByRole("button", { name: "Mostrar" })).toHaveClass("min-h-11", "min-w-11");
  });

  it("merges custom classes without losing the touch target", () => {
    render(<Button className="custom">Salvar</Button>);

    expect(screen.getByRole("button", { name: "Salvar" })).toHaveClass("min-h-11", "custom");
  });

  it("stretches to the full width when asked", () => {
    render(<Button fullWidth>Salvar</Button>);

    expect(screen.getByRole("button", { name: "Salvar" })).toHaveClass("button--full-width");
  });

  it("calls onPress when pressed", async () => {
    const onPress = vi.fn();
    render(<Button onPress={onPress}>Salvar</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("shows a hidden spinner and keeps the label as the accessible name while loading", () => {
    render(<Button isLoading>Entrando…</Button>);

    const button = screen.getByRole("button", { name: "Entrando…" });
    const spinner = button.querySelector("[data-slot='spinner']");
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute("aria-hidden", "true");
  });

  it("does not show a spinner when idle", () => {
    render(<Button>Salvar</Button>);

    expect(
      screen.getByRole("button", { name: "Salvar" }).querySelector("[data-slot='spinner']"),
    ).not.toBeInTheDocument();
  });

  it("ignores presses while loading but stays focusable", async () => {
    const onPress = vi.fn();
    render(
      <Button isLoading onPress={onPress}>
        Entrando…
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Entrando…" });
    expect(button).toHaveAttribute("aria-disabled", "true");

    await userEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();

    button.focus();
    expect(button).toHaveFocus();
  });

  it("submits the surrounding form when idle", async () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit">Enviar</Button>
      </form>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not submit the surrounding form while loading", async () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" isLoading>
          Enviando…
        </Button>
      </form>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Enviando…" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
