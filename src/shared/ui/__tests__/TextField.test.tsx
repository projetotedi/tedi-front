import { createRef, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TextField, type TextFieldProps } from "../TextField";

function Harness({ onChange, ...props }: Partial<Omit<TextFieldProps, "value">>) {
  const [value, setValue] = useState("");

  return (
    <TextField
      label="Matrícula (RA)"
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe("TextField", () => {
  it("renders a visible label bound to the input", () => {
    render(<Harness />);

    const input = screen.getByLabelText("Matrícula (RA)");
    expect(input.tagName).toBe("INPUT");
    expect(screen.getByText("Matrícula (RA)").tagName).toBe("LABEL");
  });

  it("calls onChange with the typed text", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.type(screen.getByLabelText("Matrícula (RA)"), "2024");

    expect(onChange).toHaveBeenLastCalledWith("2024");
    expect(screen.getByLabelText("Matrícula (RA)")).toHaveValue("2024");
  });

  it("calls onBlur when the field loses focus", async () => {
    const onBlur = vi.fn();
    render(<Harness onBlur={onBlur} />);

    await userEvent.click(screen.getByLabelText("Matrícula (RA)"));
    await userEvent.tab();

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("shows the placeholder without replacing the label", () => {
    render(<Harness placeholder="Digite sua matrícula" />);

    expect(screen.getByPlaceholderText("Digite sua matrícula")).toBe(
      screen.getByLabelText("Matrícula (RA)"),
    );
  });

  it("links the description to the input", () => {
    render(<Harness description="Mínimo de 8 caracteres" />);

    expect(screen.getByLabelText("Matrícula (RA)")).toHaveAccessibleDescription(
      "Mínimo de 8 caracteres",
    );
  });

  it("marks the input as invalid, links the error message and hides the description", () => {
    render(<Harness description="Mínimo de 8 caracteres" errorMessage="Informe sua matrícula" />);

    const input = screen.getByLabelText("Matrícula (RA)");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Informe sua matrícula");
    expect(screen.queryByText("Mínimo de 8 caracteres")).not.toBeInTheDocument();
  });

  it("does not mark the input as invalid without an error message", () => {
    render(<Harness />);

    expect(screen.getByLabelText("Matrícula (RA)")).not.toHaveAttribute("aria-invalid", "true");
  });

  it("links an external description to the input", () => {
    render(
      <>
        <p id="form-error">Matrícula ou senha incorretos</p>
        <Harness aria-describedby="form-error" />
      </>,
    );

    expect(screen.getByLabelText("Matrícula (RA)")).toHaveAccessibleDescription(
      "Matrícula ou senha incorretos",
    );
  });

  it("disables the input", () => {
    render(<Harness isDisabled />);

    expect(screen.getByLabelText("Matrícula (RA)")).toBeDisabled();
  });

  it("applies the type, name and autocomplete attributes", () => {
    render(<Harness type="password" name="password" autoComplete="current-password" />);

    const input = screen.getByLabelText("Matrícula (RA)");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("name", "password");
    expect(input).toHaveAttribute("autocomplete", "current-password");
  });

  it("renders an email input so mobile keyboards offer the at sign", () => {
    render(<Harness type="email" autoComplete="email" />);

    const input = screen.getByLabelText("Matrícula (RA)");
    expect(input).toHaveAttribute("type", "email");
    expect(input).toHaveAttribute("autocomplete", "email");
  });

  it("forwards the input ref", () => {
    const inputRef = createRef<HTMLInputElement>();
    render(<Harness inputRef={inputRef} />);

    expect(inputRef.current).toBe(screen.getByLabelText("Matrícula (RA)"));
  });

  it("renders the end content inside the field", () => {
    render(<Harness endContent={<button type="button">Ação</button>} />);

    expect(screen.getByRole("button", { name: "Ação" })).toBeInTheDocument();
  });

  it("keeps the 44px touch target and the 16px font", () => {
    render(<Harness />);

    expect(screen.getByLabelText("Matrícula (RA)")).toHaveClass("min-h-11", "text-base");
  });
});
