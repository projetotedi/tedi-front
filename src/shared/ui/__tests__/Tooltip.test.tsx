import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Button } from "../Button";
import { Tooltip } from "../Tooltip";

function renderTooltip() {
  return render(
    <>
      <Tooltip content="Editar">
        <Button isIconOnly variant="ghost" aria-label="Editar Ana Torres">
          <span aria-hidden="true">✎</span>
        </Button>
      </Tooltip>
      <button type="button">Fora do tooltip</button>
    </>,
  );
}

describe("Tooltip", () => {
  it("shows the tooltip on keyboard focus", async () => {
    const user = userEvent.setup();
    renderTooltip();

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    await user.tab();

    expect(screen.getByRole("button", { name: "Editar Ana Torres" })).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Editar");
  });

  it("describes the focused button with the tooltip text without replacing its accessible name", async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.tab();

    const button = screen.getByRole("button", { name: "Editar Ana Torres" });
    await screen.findByRole("tooltip");
    expect(button).toHaveAccessibleName("Editar Ana Torres");
    expect(button).toHaveAccessibleDescription("Editar");
  });

  it("shows the tooltip on hover", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Editar" delay={0}>
        <Button isIconOnly variant="ghost" aria-label="Editar Ana Torres">
          <span aria-hidden="true">✎</span>
        </Button>
      </Tooltip>,
    );

    // O React Aria só abre com o mouse se a última interação foi de ponteiro: num navegador o mouse
    // se move antes de entrar no botão; aqui o primeiro `hover` faz esse papel.
    await user.hover(document.body);
    await user.hover(screen.getByRole("button", { name: "Editar Ana Torres" }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Editar");
  });

  it("closes with Escape and when the focus leaves the button", async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.tab();
    await screen.findByRole("tooltip");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    await user.tab();
    await user.tab({ shift: true });
    await screen.findByRole("tooltip");
    await user.tab();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("the trigger button is the only tab stop", async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.tab();
    expect(screen.getByRole("button", { name: "Editar Ana Torres" })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("button", { name: "Fora do tooltip" })).toHaveFocus();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("keeps the tooltip text at 16px", async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.tab();

    expect(await screen.findByRole("tooltip")).toHaveClass("text-base");
  });
});
