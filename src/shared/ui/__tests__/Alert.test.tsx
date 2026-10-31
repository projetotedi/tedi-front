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

  it.each([
    ["omitted", undefined],
    ["null", null],
    ["false", false],
    ["an empty string", ""],
  ])(
    "keeps an empty polite status region mounted when the info content is %s",
    (_label, children) => {
      render(<Alert variant="info">{children}</Alert>);

      const region = screen.getByRole("status");
      expect(region).toBeEmptyDOMElement();
      expect(region).toHaveAttribute("aria-live", "polite");
    },
  );

  it("fills and empties the very same status region instead of remounting it", () => {
    const { rerender } = render(<Alert variant="info" />);
    const region = screen.getByRole("status");

    rerender(<Alert variant="info">Conectando ao servidor</Alert>);
    expect(screen.getByRole("status")).toBe(region);
    expect(region).toHaveTextContent("Conectando ao servidor");

    rerender(<Alert variant="info">{null}</Alert>);
    expect(screen.getByRole("status")).toBe(region);
    expect(region).toBeEmptyDOMElement();
  });

  it("does not nest a second live region inside the info notice", () => {
    render(<Alert variant="info">Conectando ao servidor</Alert>);

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("takes the empty region out of the flow without hiding it from assistive technology", () => {
    render(<Alert variant="info" />);

    const region = screen.getByRole("status");
    expect(region).toHaveClass("empty:sr-only");
    expect(region.className).not.toContain("hidden");
    expect(region).not.toHaveAttribute("hidden");
    expect(region).not.toHaveAttribute("aria-hidden");
  });

  it("passes the id through", () => {
    render(
      <Alert variant="error" id="login-error">
        Falhou
      </Alert>,
    );

    expect(screen.getByRole("alert")).toHaveAttribute("id", "login-error");
  });

  it("puts the id of an info notice on its status region, filled or not", () => {
    const { rerender } = render(<Alert variant="info" id="login-notice" />);
    expect(screen.getByRole("status")).toHaveAttribute("id", "login-notice");

    rerender(
      <Alert variant="info" id="login-notice">
        Conectando ao servidor
      </Alert>,
    );
    expect(screen.getByRole("status")).toHaveAttribute("id", "login-notice");
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

  it("renders a static warning with title and description (no alert/status role)", () => {
    render(
      <Alert variant="warning" description="O link vale por 48 horas.">
        Guarde este link agora
      </Alert>,
    );

    expect(screen.getByText("Guarde este link agora")).toBeInTheDocument();
    expect(screen.getByText("O link vale por 48 horas.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders nothing for an empty warning", () => {
    const { container } = render(<Alert variant="warning">{null}</Alert>);

    expect(container).toBeEmptyDOMElement();
  });

  it("danger variant is static (no alert role)", () => {
    render(
      <Alert variant="danger" description="O histórico de aulas continua.">
        A pessoa deixa de entrar no sistema
      </Alert>,
    );

    expect(screen.getByText("A pessoa deixa de entrar no sistema")).toBeInTheDocument();
    expect(screen.getByText("O histórico de aulas continua.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("danger variant keeps the red look of the error variant and passes the id through", () => {
    const { container } = render(
      <Alert variant="danger" id="disable-warning">
        Aviso
      </Alert>,
    );

    const box = container.querySelector("#disable-warning");
    expect(box).toHaveClass("border-danger", "bg-danger-soft");
  });

  it("renders nothing for an empty danger alert", () => {
    const { container } = render(<Alert variant="danger">{null}</Alert>);

    expect(container).toBeEmptyDOMElement();
  });

  it.each([["danger"], ["warning"]] as const)(
    "a %s alert can carry only a description, in regular weight and with no title",
    (variant) => {
      const { container } = render(<Alert variant={variant} description="Só o complemento." />);

      expect(screen.getByText("Só o complemento.")).toBeInTheDocument();
      expect(container.querySelector("[data-slot='alert-title']")).toBeNull();
      expect(container.querySelector("[data-slot='alert-description']")).toHaveClass("text-base");
    },
  );

  it("keeps an info region empty when it has neither title nor description", () => {
    render(<Alert variant="info" description={null} />);

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("fills the info region when it only has a description", () => {
    render(<Alert variant="info" description="Link copiado." />);

    expect(screen.getByRole("status")).toHaveTextContent("Link copiado.");
  });

  it("the description follows the colour of the alert instead of the muted grey (4.5:1)", () => {
    const { container } = render(
      <Alert variant="warning" description="O link vale por 48 horas.">
        Guarde este link agora
      </Alert>,
    );

    const description = container.querySelector("[data-slot='alert-description']");
    expect(description).toHaveClass("text-inherit");
    expect(description).not.toHaveClass("text-muted");
  });

  it.each([
    ["danger", "text-danger-soft-foreground"],
    ["error", "text-danger-soft-foreground"],
    ["info", "text-accent-soft-foreground"],
    ["warning", "text-tedi-warning-foreground"],
  ] as const)("the %s alert sets its own text colour (%s)", (variant, textClass) => {
    const { container } = render(<Alert variant={variant}>Aviso</Alert>);

    expect(container.querySelector("[data-slot='alert-root']")).toHaveClass(textClass);
  });
});
