import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ListState } from "../ListState";

describe("ListState", () => {
  it("loading announces the label as a status, without heading nor button", () => {
    render(
      <ListState
        variant="loading"
        title="Carregando membros…"
        description="Ignorada"
        action={{ label: "Ignorada", onPress: vi.fn() }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Carregando membros…");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText("Ignorada")).not.toBeInTheDocument();
  });

  it("empty shows the title, the description and the action", async () => {
    const onPress = vi.fn();
    render(
      <ListState
        variant="empty"
        title="Nenhum membro ainda"
        description="Gere um link de cadastro."
        action={{ label: "Gerar link de cadastro", onPress }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Nenhum membro ainda" })).toBeInTheDocument();
    expect(screen.getByText("Gere um link de cadastro.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Gerar link de cadastro" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("noResults calls onPress from the action", async () => {
    const onPress = vi.fn();
    render(
      <ListState
        variant="noResults"
        title="Nada encontrado"
        action={{ label: "Limpar filtros", onPress }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("error is an alert that keeps the retry button outside of it", () => {
    render(
      <ListState
        variant="error"
        title="Não foi possível carregar os membros"
        description="Verifique a sua conexão."
        action={{ label: "Tentar de novo", onPress: vi.fn() }}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(
      within(alert).getByRole("heading", { name: "Não foi possível carregar os membros" }),
    ).toBeInTheDocument();
    expect(within(alert).getByText("Verifique a sua conexão.")).toBeInTheDocument();
    expect(within(alert).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });

  it("renders no button when there is no action", () => {
    render(<ListState variant="empty" title="Nenhum membro ainda" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("ignores presses while the action is loading", async () => {
    const onPress = vi.fn();
    render(
      <ListState
        variant="error"
        title="Falhou"
        action={{ label: "Tentar de novo", onPress, isLoading: true }}
      />,
    );

    const button = screen.getByRole("button", { name: "Tentar de novo" });
    expect(button).toHaveAttribute("aria-disabled", "true");

    await userEvent.click(button);

    expect(onPress).not.toHaveBeenCalled();
  });

  it("draws the icon through a mask, as a decoration outside of the accessibility tree", () => {
    const { container } = render(
      <ListState variant="empty" title="Nenhum membro ainda" icon="/persons.svg" />,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    const badge = container.querySelector("[aria-hidden='true']");
    expect(badge).toBeInTheDocument();
    expect(badge?.firstElementChild).toHaveAttribute(
      "style",
      expect.stringContaining("/persons.svg"),
    );
  });

  it("draws no badge when an empty state has no icon", () => {
    const { container } = render(<ListState variant="empty" title="Nenhum membro ainda" />);

    expect(container.querySelector("[aria-hidden='true']")).not.toBeInTheDocument();
  });
});
