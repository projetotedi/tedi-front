import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PasswordField, type PasswordFieldProps } from "../PasswordField";

function Harness(props: Partial<Omit<PasswordFieldProps, "value" | "onChange">>) {
  const [value, setValue] = useState("");

  return (
    <PasswordField
      label="Senha"
      showLabel="Mostrar senha"
      hideLabel="Ocultar senha"
      {...props}
      value={value}
      onChange={setValue}
    />
  );
}

describe("PasswordField", () => {
  it("hides the password by default", () => {
    render(<Harness />);

    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Mostrar senha" })).toBeInTheDocument();
  });

  it("toggles the input type and the button label", async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));

    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar senha" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mostrar senha" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Ocultar senha" }));

    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Mostrar senha" })).toBeInTheDocument();
  });

  it("keeps the typed value when toggling", async () => {
    render(<Harness />);

    await userEvent.type(screen.getByLabelText("Senha"), "segredo123");
    await userEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));

    expect(screen.getByLabelText("Senha")).toHaveValue("segredo123");
  });

  it("keeps the focus on the toggle button after toggling", async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));

    expect(screen.getByRole("button", { name: "Ocultar senha" })).toHaveFocus();
  });

  it("toggles with the keyboard", async () => {
    render(<Harness />);

    await userEvent.tab(); // campo de senha
    await userEvent.tab(); // botão de mostrar/ocultar
    expect(screen.getByRole("button", { name: "Mostrar senha" })).toHaveFocus();

    await userEvent.keyboard("{Enter}");

    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "text");
  });

  it("does not submit the surrounding form when toggling", async () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Harness />
      </form>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("names the state in the label instead of aria-pressed", () => {
    render(<Harness />);

    expect(screen.getByRole("button", { name: "Mostrar senha" })).not.toHaveAttribute(
      "aria-pressed",
    );
  });

  it("hides the decorative icon from assistive technology", () => {
    render(<Harness />);

    const svg = screen.getByRole("button", { name: "Mostrar senha" }).querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("disables the toggle together with the field", () => {
    render(<Harness isDisabled />);

    expect(screen.getByLabelText("Senha")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mostrar senha" })).toBeDisabled();
  });

  it("keeps a 44px touch target on the toggle", () => {
    render(<Harness />);

    expect(screen.getByRole("button", { name: "Mostrar senha" })).toHaveClass(
      "min-h-11",
      "min-w-11",
    );
  });

  it("passes the field props through", () => {
    render(<Harness description="Mínimo de 8 caracteres" errorMessage="Senha curta demais" />);

    const input = screen.getByLabelText("Senha");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Senha curta demais");
  });
});
