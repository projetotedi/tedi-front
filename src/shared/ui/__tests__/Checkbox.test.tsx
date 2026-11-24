import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Checkbox } from "../Checkbox";

describe("Checkbox", () => {
  it("is named by its label and reports the new state", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox label="Arquivada" isSelected={false} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox", { name: "Arquivada" });
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText("Arquivada")).toBeVisible();

    await user.click(checkbox);

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("shows the mixed state when isIndeterminate, and checks on press", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(
      <Checkbox
        label="Selecionar todos os lançamentos"
        isLabelHidden
        isSelected={false}
        isIndeterminate
        onChange={onChange}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Selecionar todos os lançamentos" });
    expect(checkbox).toBePartiallyChecked();
    // HeroUI paints the mixed state from this attribute of the root, which the fill of the token reads.
    expect(container.querySelector('[data-indeterminate="true"]')).not.toBeNull();

    await user.click(checkbox);

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("keeps the label for assistive technology only when isLabelHidden", () => {
    render(
      <Checkbox
        label="Selecionar lançamento de Beatriz Nunes em 05/03"
        isLabelHidden
        isSelected
        onChange={() => {}}
      />,
    );

    expect(
      screen.getByRole("checkbox", { name: "Selecionar lançamento de Beatriz Nunes em 05/03" }),
    ).toBeChecked();
    expect(screen.getByText("Selecionar lançamento de Beatriz Nunes em 05/03")).toHaveClass(
      "sr-only",
    );
  });

  it("does not change when disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox label="Arquivada" isSelected={false} isDisabled onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox", { name: "Arquivada" });
    expect(checkbox).toBeDisabled();

    await user.click(checkbox);

    expect(onChange).not.toHaveBeenCalled();
  });
});
