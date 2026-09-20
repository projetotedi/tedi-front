import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusCard } from "../StatusCard";

describe("StatusCard", () => {
  it("shows the title as a level 2 heading by default", () => {
    render(<StatusCard variant="success" title="Cadastro concluído!" description="Pode entrar." />);

    expect(screen.getByRole("heading", { level: 2, name: "Cadastro concluído!" })).toBeVisible();
  });

  it("shows the title as a level 1 heading when the card is the whole screen", () => {
    render(
      <StatusCard
        variant="warning"
        title="Este link não é mais válido"
        description="Peça um novo."
        headingLevel={1}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Este link não é mais válido",
    );
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("shows the description and the action", () => {
    render(
      <StatusCard variant="success" title="Cadastro concluído!" description="Pode entrar.">
        <button type="button">Ir para o login</button>
      </StatusCard>,
    );

    expect(screen.getByText("Pode entrar.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Ir para o login" })).toBeVisible();
  });

  it("does not announce itself as an alert unless asked", () => {
    render(<StatusCard variant="success" title="Cadastro concluído!" description="Pode entrar." />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("announces the title and the description as an alert when asked", () => {
    render(
      <StatusCard
        variant="warning"
        title="Este link não é mais válido"
        description="Ele pode ter expirado."
        isAlert
      />,
    );

    const alert = screen.getByRole("alert");
    expect(
      within(alert).getByRole("heading", { name: "Este link não é mais válido" }),
    ).toBeVisible();
    expect(alert).toHaveTextContent("Ele pode ter expirado.");
  });

  it("keeps the action out of the announced alert", () => {
    render(
      <StatusCard
        variant="warning"
        title="Este link não é mais válido"
        description="Ele pode ter expirado."
        isAlert
      >
        <button type="button">Ir para o login</button>
      </StatusCard>,
    );

    expect(within(screen.getByRole("alert")).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir para o login" })).toBeVisible();
  });

  it.each([
    ["success", "✓"],
    ["warning", "!"],
  ] as const)("draws a decorative %s icon that no screen reader reads", (variant, glyph) => {
    render(<StatusCard variant={variant} title="Título" description="Descrição" />);

    const icon = screen.getByText(glyph);
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("heading", { name: "Título" })).not.toHaveTextContent(glyph);
  });

  it("does not take the focus on its own", () => {
    render(<StatusCard variant="success" title="Cadastro concluído!" description="Pode entrar." />);

    expect(screen.getByRole("heading", { name: "Cadastro concluído!" })).not.toHaveFocus();
    expect(screen.getByRole("heading", { name: "Cadastro concluído!" })).not.toHaveAttribute(
      "tabindex",
    );
  });

  it("moves the focus to the title when mounted with autoFocus", () => {
    render(
      <StatusCard
        variant="success"
        title="Cadastro concluído!"
        description="Pode entrar."
        autoFocus
      />,
    );

    expect(screen.getByRole("heading", { name: "Cadastro concluído!" })).toHaveFocus();
  });

  // Exceção consciente à regra "asserção por papel, não por classe": o jsdom não carrega CSS, então
  // a fonte de 16px da descrição só é verificável pela classe do Tailwind.
  it("keeps the 16px base font on the description", () => {
    render(<StatusCard variant="success" title="Cadastro concluído!" description="Pode entrar." />);

    expect(screen.getByText("Pode entrar.")).toHaveClass("text-base");
  });
});
