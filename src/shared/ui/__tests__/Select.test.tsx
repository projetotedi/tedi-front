import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Select, type SelectProps } from "../Select";

const OPTIONS = [
  { id: "a", label: "A" },
  { id: "b", label: "B" },
];

function Harness({ onChange, ...props }: Partial<Omit<SelectProps, "value" | "options">>) {
  const [value, setValue] = useState<string | null>(null);

  return (
    <Select
      label="Perfil"
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

describe("Select", () => {
  it("trigger is named by its label", () => {
    render(<Harness />);

    expect(screen.getByRole("button", { name: /Perfil/ })).toBeInTheDocument();
  });

  it("opens the listbox and reports the chosen option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /Perfil/ }));
    await user.click(screen.getByRole("option", { name: "B" }));

    expect(onChange).toHaveBeenCalledWith("b");
    expect(screen.getByRole("button", { name: /Perfil/ })).toHaveTextContent("B");
  });

  it("focuses the trigger when autoFocus", () => {
    render(<Harness autoFocus />);

    expect(screen.getByRole("button", { name: /Perfil/ })).toHaveFocus();
  });

  it("shows the error message", () => {
    render(<Harness errorMessage="Escolha um perfil" />);

    expect(screen.getByRole("button", { name: /Perfil/ })).toHaveAccessibleDescription(
      "Escolha um perfil",
    );
  });
});
