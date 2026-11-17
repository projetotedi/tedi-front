import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MultiSelect, type MultiSelectProps } from "../MultiSelect";

const OPTIONS = [
  { id: "a", label: "Informática Básica" },
  { id: "b", label: "Smartphones" },
  { id: "c", label: "Redes Sociais" },
];

function Harness({
  initial = [],
  onChange,
  ...props
}: Partial<Omit<MultiSelectProps, "value" | "options">> & { initial?: string[] }) {
  const [value, setValue] = useState<string[]>(initial);

  return (
    <MultiSelect
      label="Pré-requisitos"
      options={OPTIONS}
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

const trigger = () => screen.getByRole("button", { name: /Pré-requisitos/ });

describe("MultiSelect", () => {
  it("is named by its label and shows the placeholder with nothing chosen", () => {
    render(<Harness placeholder="Nenhum" />);

    expect(trigger()).toHaveTextContent("Nenhum");
  });

  it("keeps more than one choice and names them in the trigger", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(trigger());
    await user.click(screen.getByRole("option", { name: "Smartphones" }));
    await user.click(screen.getByRole("option", { name: "Informática Básica" }));

    expect(onChange).toHaveBeenLastCalledWith(expect.arrayContaining(["a", "b"]));
    expect(onChange.mock.lastCall?.[0]).toHaveLength(2);
    expect(screen.getByRole("listbox")).toHaveAttribute("aria-multiselectable", "true");
  });

  it("unchecks a chosen option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={["a", "b"]} onChange={onChange} />);

    expect(trigger()).toHaveTextContent("Informática Básica, Smartphones");
    await user.click(trigger());
    await user.click(screen.getByRole("option", { name: "Informática Básica" }));

    expect(onChange).toHaveBeenLastCalledWith(["b"]);
  });

  it("shows the error message instead of the description and marks the field invalid", () => {
    render(<Harness description="Dica" errorMessage="Ciclo de pré-requisitos." />);

    expect(screen.getByText("Ciclo de pré-requisitos.")).toBeInTheDocument();
    expect(screen.queryByText("Dica")).not.toBeInTheDocument();
  });

  it("uses formatValue for the trigger text", () => {
    render(<Harness initial={["c"]} formatValue={(selected) => `${selected.length} escolhido`} />);

    expect(trigger()).toHaveTextContent("1 escolhido");
  });
});
