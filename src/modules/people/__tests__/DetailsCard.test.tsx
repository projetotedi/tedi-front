import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import i18n from "@shared/i18n";

// Registers the "people" namespace.
import "../index";
import { DetailsCard } from "../components/DetailsCard";

/** The value (`<dd>`) of the field `label` (`<dt>`). */
function valueOf(label: string): HTMLElement {
  const value = screen.getByText(label, { selector: "dt" }).nextElementSibling;
  if (!(value instanceof HTMLElement)) throw new Error(`No value for "${label}"`);
  return value;
}

describe("DetailsCard", () => {
  // The i18n instance is global to the test file and the language detector reads the browser.
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("renders the value when present", () => {
    render(
      <DetailsCard
        title="Dados"
        fields={[
          { label: "Cidade", value: "São Paulo" },
          { label: "Termo", value: <a href="https://example.com/termo">Abrir o termo</a> },
          { label: "Faltas", value: 0 },
        ]}
      />,
    );

    expect(valueOf("Cidade")).toHaveTextContent(/^São Paulo$/);
    expect(within(valueOf("Termo")).getByRole("link", { name: "Abrir o termo" })).toHaveAttribute(
      "href",
      "https://example.com/termo",
    );
    // A zero is a value: only null, undefined and an empty string mean "no value".
    expect(valueOf("Faltas")).toHaveTextContent(/^0$/);
    expect(screen.queryByText("—")).not.toBeInTheDocument();
    expect(screen.queryByText("Não informado")).not.toBeInTheDocument();
  });

  it("renders a dash and a screen reader label for an empty value", () => {
    render(
      <DetailsCard
        title="Dados"
        fields={[
          { label: "Nulo", value: null },
          { label: "Indefinido", value: undefined },
          { label: "Vazio", value: "" },
        ]}
      />,
    );

    for (const label of ["Nulo", "Indefinido", "Vazio"]) {
      const value = within(valueOf(label));
      expect(value.getByText("—")).toHaveAttribute("aria-hidden", "true");
      expect(value.getByText("Não informado")).toHaveClass("sr-only");
    }
  });

  it("translates the screen reader label", async () => {
    await i18n.changeLanguage("en-US");
    render(<DetailsCard title="Details" fields={[{ label: "City", value: null }]} />);

    expect(within(valueOf("City")).getByText("Not provided")).toHaveClass("sr-only");
  });
});
