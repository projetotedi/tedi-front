import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Stepper } from "../Stepper";

const STEPS = ["Seus dados", "Crie sua senha"];

function renderStepper(current: number) {
  return render(
    <Stepper
      steps={STEPS}
      current={current}
      label={`Etapa ${current} de 2`}
      completedLabel="concluída"
    />,
  );
}

describe("Stepper", () => {
  it("is an ordered list named by the label, with one item per step", () => {
    renderStepper(1);

    const list = screen.getByRole("list", { name: "Etapa 1 de 2" });
    expect(list.tagName).toBe("OL");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Seus dados");
    expect(items[1]).toHaveTextContent("Crie sua senha");
  });

  it("marks only the current step with aria-current", () => {
    renderStepper(1);

    const [first, second] = screen.getAllByRole("listitem");
    expect(first).toHaveAttribute("aria-current", "step");
    expect(second).not.toHaveAttribute("aria-current");
  });

  it("moves aria-current to the second step", () => {
    renderStepper(2);

    const [first, second] = screen.getAllByRole("listitem");
    expect(first).not.toHaveAttribute("aria-current");
    expect(second).toHaveAttribute("aria-current", "step");
  });

  it("tells screen readers that a previous step is completed, and only that one", () => {
    renderStepper(2);

    const [first, second] = screen.getAllByRole("listitem");
    expect(first).toHaveTextContent("Seus dados");
    expect(first).toHaveTextContent("concluída");
    expect(second).not.toHaveTextContent("concluída");
  });

  it("does not mention completion while still on the first step", () => {
    renderStepper(1);

    expect(screen.queryByText("concluída")).not.toBeInTheDocument();
  });

  it("shows the number of a current or upcoming step and a check for a completed one", () => {
    const { container, rerender } = renderStepper(1);
    const circles = () => Array.from(container.querySelectorAll("li > span:first-child"));

    expect(circles().map((circle) => circle.textContent)).toEqual(["1", "2"]);

    rerender(<Stepper steps={STEPS} current={2} label="Etapa 2 de 2" completedLabel="concluída" />);

    expect(circles().map((circle) => circle.textContent)).toEqual(["✓", "2"]);
  });

  it("hides the circles and the connector from assistive technology", () => {
    const { container } = renderStepper(1);

    const decorative = container.querySelectorAll("[aria-hidden='true']");
    // Um círculo por etapa e um conector entre as duas.
    expect(decorative).toHaveLength(3);
    for (const element of decorative) {
      expect(within(element as HTMLElement).queryAllByRole("button")).toHaveLength(0);
    }
  });

  it("does not put a connector after the last step", () => {
    const { container } = renderStepper(1);

    const [first, second] = Array.from(container.querySelectorAll("li"));
    expect(first?.querySelectorAll("[aria-hidden='true']")).toHaveLength(2);
    expect(second?.querySelectorAll("[aria-hidden='true']")).toHaveLength(1);
  });

  // Exceção consciente à regra "asserção por papel, não por classe": o jsdom não carrega CSS, então
  // a fonte de 16px só é verificável pela classe do Tailwind. A medida real é conferida no navegador.
  it("keeps the 16px base font on the step names", () => {
    renderStepper(1);

    for (const item of screen.getAllByRole("listitem")) {
      expect(item).toHaveClass("text-base");
    }
  });
});
