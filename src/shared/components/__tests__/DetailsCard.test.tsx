import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import i18n from "@shared/i18n";

import { DetailsCard, type DetailsField } from "../DetailsCard";

/** The value (`<dd>`) of the field `label` (`<dt>`). */
function valueOf(label: string): HTMLElement {
  const value = screen.getByText(label, { selector: "dt" }).nextElementSibling;
  if (!(value instanceof HTMLElement)) throw new Error(`No value for "${label}"`);
  return value;
}

/** The `<dl>` that holds the pairs. */
function list(): HTMLElement {
  const root = screen.getAllByText(/./, { selector: "dt" })[0]?.closest("dl");
  if (!(root instanceof HTMLElement)) throw new Error("No <dl> in the card");
  return root;
}

/** The box (`<div>`) of the pair `label`, which is what the layout classes go on. */
function boxOf(label: string): HTMLElement {
  const box = screen.getByText(label, { selector: "dt" }).parentElement;
  if (!(box instanceof HTMLElement)) throw new Error(`No box for "${label}"`);
  return box;
}

const FIELDS: DetailsField[] = [
  { label: "Código", value: "INFO-A" },
  { label: "Curso", value: "Informática Básica" },
  { label: "Local", value: "Laboratório 3, bloco B", fullWidth: true },
];

describe("DetailsCard", () => {
  // The i18n instance is global to the test file and the language detector reads the browser.
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("shows the title as a heading and every pair as a label with its value, in the order given", () => {
    render(<DetailsCard title="Dados da turma" fields={FIELDS} />);

    expect(screen.getByRole("heading", { level: 2, name: "Dados da turma" })).toBeInTheDocument();
    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual([
      "Código",
      "Curso",
      "Local",
    ]);
    expect(valueOf("Código")).toHaveTextContent(/^INFO-A$/);
    expect(valueOf("Curso")).toHaveTextContent(/^Informática Básica$/);
    expect(valueOf("Local")).toHaveTextContent(/^Laboratório 3, bloco B$/);
    expect(screen.queryByText("—")).not.toBeInTheDocument();
    expect(screen.queryByText("Não informado")).not.toBeInTheDocument();
  });

  it("renders a node as the value, a link for instance", () => {
    render(
      <DetailsCard
        title="Dados"
        fields={[{ label: "Termo", value: <a href="https://example.com/termo">Abrir o termo</a> }]}
      />,
    );

    expect(within(valueOf("Termo")).getByRole("link", { name: "Abrir o termo" })).toHaveAttribute(
      "href",
      "https://example.com/termo",
    );
  });

  it("renders a dash for who sees and 'Não informado' for who hears, for null, undefined and an empty string", () => {
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

  it("takes a zero for a value: only null, undefined and an empty string mean 'no value'", () => {
    render(<DetailsCard title="Dados" fields={[{ label: "Faltas", value: 0 }]} />);

    expect(valueOf("Faltas")).toHaveTextContent(/^0$/);
    expect(screen.queryByText("—")).not.toBeInTheDocument();
    expect(screen.queryByText("Não informado")).not.toBeInTheDocument();
  });

  it("translates the label that the screen reader hears", async () => {
    await i18n.changeLanguage("en-US");
    render(<DetailsCard title="Details" fields={[{ label: "City", value: null }]} />);

    expect(within(valueOf("City")).getByText("—")).toHaveAttribute("aria-hidden", "true");
    expect(within(valueOf("City")).getByText("Not provided")).toHaveClass("sr-only");
  });

  it("puts the pairs in a single column by default, and fullWidth changes nothing there", () => {
    render(<DetailsCard title="Curso de origem" fields={FIELDS} />);

    expect(list()).toHaveClass("flex", "flex-col");
    expect(list()).not.toHaveClass("grid");
    expect(boxOf("Local")).not.toHaveClass("md:col-span-4");
  });

  it("puts four pairs to a row with columns 4, and fullWidth takes the whole row", () => {
    render(<DetailsCard title="Dados da turma" fields={FIELDS} columns={4} />);

    expect(list()).toHaveClass("grid", "grid-cols-1", "md:grid-cols-4");
    expect(boxOf("Código")).not.toHaveClass("md:col-span-4");
    expect(boxOf("Local")).toHaveClass("md:col-span-4");
  });

  it("shows what is given as aside on the right of the title, in the same header", () => {
    render(
      <DetailsCard
        title="Curso de origem"
        fields={FIELDS}
        aside={<a href="/courses/1">Abrir curso</a>}
      />,
    );

    const heading = screen.getByRole("heading", { name: "Curso de origem" });
    expect(within(heading.parentElement as HTMLElement).getByRole("link")).toHaveAccessibleName(
      "Abrir curso",
    );
  });

  it("has no aside when none is given", () => {
    render(<DetailsCard title="Curso de origem" fields={FIELDS} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
