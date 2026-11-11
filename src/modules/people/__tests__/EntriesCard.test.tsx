import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import i18n from "@shared/i18n";

// Registers the "people" namespace.
import "../index";
import { EntriesCard } from "../components/EntriesCard";
import { SAMPLE_ENTRIES } from "./fixtures/hours";

const UNAVAILABLE = "O banco de horas chega com o módulo de horas.";

/** The cells of the row whose accessible name (the text of the row) matches `name`. */
function cellsOfRow(table: HTMLElement, name: RegExp): HTMLElement[] {
  return within(within(table).getByRole("row", { name })).getAllByRole("cell");
}

describe("EntriesCard", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("lists the columns of the table", () => {
    render(<EntriesCard entries={SAMPLE_ENTRIES} />);

    const table = screen.getByRole("table", { name: "Meus lançamentos" });

    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Data", "Atividade", "Categoria", "Declarado", "Validado", "Status"]);
  });

  it("shows the date, the category and the status of an entry", () => {
    render(<EntriesCard entries={SAMPLE_ENTRIES} />);

    const table = screen.getByRole("table", { name: "Meus lançamentos" });

    const rejected = cellsOfRow(table, /Material de apoio sem comprovação/);
    expect(rejected[0]).toHaveTextContent(/^28\/02$/);
    expect(rejected[2]).toHaveTextContent(/^Outros$/);
    expect(rejected[5]).toHaveTextContent(/^Rejeitado$/);
  });

  it("shows declared and validated time in hours", () => {
    render(<EntriesCard entries={SAMPLE_ENTRIES} />);

    const table = screen.getByRole("table", { name: "Meus lançamentos" });

    const adjusted = cellsOfRow(table, /Planejamento de conteúdo do bimestre/);
    expect(adjusted[3]).toHaveTextContent(/^3h$/);
    expect(adjusted[4]).toHaveTextContent(/^2h$/);

    const notValidated = cellsOfRow(table, /Feira de tecnologia/);
    expect(notValidated[3]).toHaveTextContent(/^4h$/);
    expect(notValidated[4]).toHaveTextContent(/^—$/);

    const rejected = cellsOfRow(table, /Material de apoio sem comprovação/);
    expect(rejected[3]).toHaveTextContent(/^2h$/);
    expect(rejected[4]).toHaveTextContent(/^0h$/);
  });

  it("never shows a duration in minutes", () => {
    render(<EntriesCard entries={SAMPLE_ENTRIES} />);

    expect(screen.queryByText(/\d+\s*min\b/)).not.toBeInTheDocument();
  });

  it("shows the empty list message", () => {
    render(<EntriesCard entries={[]} />);

    expect(screen.getByRole("heading", { name: "Meus lançamentos" })).toBeInTheDocument();
    expect(screen.getByText("Nenhum lançamento ainda.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument();
  });

  it("shows the empty state and no table without hours data", () => {
    render(<EntriesCard entries={null} />);

    expect(screen.getByRole("heading", { name: "Meus lançamentos" })).toBeInTheDocument();
    expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("Nenhum lançamento ainda.")).not.toBeInTheDocument();
  });
});
