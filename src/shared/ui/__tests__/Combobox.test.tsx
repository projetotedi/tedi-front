import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Combobox, type ComboboxProps } from "../Combobox";

const OPTIONS = ["2026.1", "2025.2", "2025.1"];

function Harness({
  initial = "",
  onChange,
  ...props
}: Partial<Omit<ComboboxProps, "value">> & { initial?: string }) {
  const [value, setValue] = useState(initial);

  return (
    <Combobox
      label="Edição"
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

const input = () => screen.getByRole("combobox", { name: /Edição/ });

describe("Combobox", () => {
  it("is a text field named by its label", () => {
    render(<Harness initial="2026.1" />);

    expect(input()).toHaveValue("2026.1");
  });

  it("suggests the options that contain the text", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(input(), "2025");

    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
      "2025.2",
      "2025.1",
    ]);
  });

  it("puts the picked suggestion in the field", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.type(input(), "2025");
    await user.click(await screen.findByRole("option", { name: "2025.1" }));

    expect(input()).toHaveValue("2025.1");
    expect(onChange).toHaveBeenLastCalledWith("2025.1");
  });

  it("keeps a text that is no suggestion", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.type(input(), "2026.2");
    await user.tab();

    expect(input()).toHaveValue("2026.2");
    expect(onChange).toHaveBeenLastCalledWith("2026.2");
  });

  it("shows the error", () => {
    render(<Harness errorMessage="Informe a edição no formato 2026.1." />);

    expect(screen.getByText("Informe a edição no formato 2026.1.")).toBeInTheDocument();
  });
});
