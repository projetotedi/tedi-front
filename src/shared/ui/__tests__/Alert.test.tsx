import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Alert } from "../Alert";

describe("Alert", () => {
  it("announces an error immediately with role alert", () => {
    render(<Alert variant="error">Matrícula ou senha incorretos</Alert>);

    expect(screen.getByRole("alert")).toHaveTextContent("Matrícula ou senha incorretos");
  });

  it("announces an info notice politely with role status", () => {
    render(<Alert variant="info">Conectando ao servidor</Alert>);

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Conectando ao servidor");
    expect(notice).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not add aria-live to an error, whose role already announces it", () => {
    render(<Alert variant="error">Falhou</Alert>);

    expect(screen.getByRole("alert")).not.toHaveAttribute("aria-live");
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["false", false],
    ["an empty string", ""],
  ])("renders nothing when the content is %s", (_label, children) => {
    const { container } = render(<Alert variant="error">{children}</Alert>);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders nothing for an empty info notice either", () => {
    const { container } = render(<Alert variant="info" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("passes the id through", () => {
    render(
      <Alert variant="error" id="login-error">
        Falhou
      </Alert>,
    );

    expect(screen.getByRole("alert")).toHaveAttribute("id", "login-error");
  });

  it("hides the decorative icon and keeps only the message as the accessible name", () => {
    render(<Alert variant="error">Matrícula ou senha incorretos</Alert>);

    const alert = screen.getByRole("alert");
    expect(alert.querySelector("[data-slot='alert-indicator']")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(alert.textContent).toBe("Matrícula ou senha incorretos");
  });
});
