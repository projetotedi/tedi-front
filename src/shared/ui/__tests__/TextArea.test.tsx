import { createRef, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TextArea, type TextAreaProps } from "../TextArea";

function Harness({ onChange, ...props }: Partial<Omit<TextAreaProps, "value">>) {
  const [value, setValue] = useState("");

  return (
    <TextArea
      label="Motivo (opcional)"
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe("TextArea", () => {
  it("renders a visible label bound to the textarea", () => {
    render(<Harness />);

    const field = screen.getByLabelText("Motivo (opcional)");
    expect(field.tagName).toBe("TEXTAREA");
    expect(screen.getByText("Motivo (opcional)").tagName).toBe("LABEL");
  });

  it("calls onChange with the typed text", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.type(screen.getByLabelText("Motivo (opcional)"), "Conteúdo revisado");

    expect(onChange).toHaveBeenLastCalledWith("Conteúdo revisado");
    expect(screen.getByLabelText("Motivo (opcional)")).toHaveValue("Conteúdo revisado");
  });

  it("accepts line breaks", async () => {
    render(<Harness />);

    await userEvent.type(screen.getByLabelText("Motivo (opcional)"), "linha 1{Enter}linha 2");

    expect(screen.getByLabelText("Motivo (opcional)")).toHaveValue("linha 1\nlinha 2");
  });

  it("calls onBlur when the field loses focus", async () => {
    const onBlur = vi.fn();
    render(<Harness onBlur={onBlur} />);

    await userEvent.click(screen.getByLabelText("Motivo (opcional)"));
    await userEvent.tab();

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("shows the placeholder without replacing the label", () => {
    render(<Harness placeholder="Conteúdo revisado em um novo plano." />);

    expect(screen.getByPlaceholderText("Conteúdo revisado em um novo plano.")).toBe(
      screen.getByLabelText("Motivo (opcional)"),
    );
  });

  it("links the description to the textarea", () => {
    render(<Harness description="Fica registrado no histórico do plano." />);

    expect(screen.getByLabelText("Motivo (opcional)")).toHaveAccessibleDescription(
      "Fica registrado no histórico do plano.",
    );
  });

  it("marks the textarea as invalid, links the error message and hides the description", () => {
    render(
      <Harness
        description="Fica registrado no histórico do plano."
        errorMessage="O motivo pode ter no máximo 500 caracteres."
      />,
    );

    const field = screen.getByLabelText("Motivo (opcional)");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("O motivo pode ter no máximo 500 caracteres.");
    expect(screen.queryByText("Fica registrado no histórico do plano.")).not.toBeInTheDocument();
  });

  it("does not mark the textarea as invalid without an error message", () => {
    render(<Harness />);

    expect(screen.getByLabelText("Motivo (opcional)")).not.toHaveAttribute("aria-invalid", "true");
  });

  it("links an external description to the textarea", () => {
    render(
      <>
        <p id="form-hint">Não registre dados de saúde</p>
        <Harness aria-describedby="form-hint" />
      </>,
    );

    expect(screen.getByLabelText("Motivo (opcional)")).toHaveAccessibleDescription(
      "Não registre dados de saúde",
    );
  });

  it("disables the textarea", () => {
    render(<Harness isDisabled />);

    expect(screen.getByLabelText("Motivo (opcional)")).toBeDisabled();
  });

  it("keeps the value of a read-only textarea", () => {
    render(
      <TextArea label="Objetivo" value="Aprender a usar o mouse" onChange={() => {}} isReadOnly />,
    );

    const field = screen.getByLabelText("Objetivo");
    expect(field).toHaveValue("Aprender a usar o mouse");
    expect(field).toHaveAttribute("readonly");
    expect(field).not.toBeDisabled();
  });

  it("applies the name and the number of rows", () => {
    render(<Harness name="reason" rows={6} />);

    const field = screen.getByLabelText("Motivo (opcional)");
    expect(field).toHaveAttribute("name", "reason");
    expect(field).toHaveAttribute("rows", "6");
  });

  it("forwards the textarea ref", () => {
    const inputRef = createRef<HTMLTextAreaElement>();
    render(<Harness inputRef={inputRef} />);

    expect(inputRef.current).toBe(screen.getByLabelText("Motivo (opcional)"));
  });

  it("keeps the 16px font", () => {
    render(<Harness />);

    expect(screen.getByLabelText("Motivo (opcional)")).toHaveClass("text-base");
  });
});
