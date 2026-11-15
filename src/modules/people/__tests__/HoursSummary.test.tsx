import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import i18n from "@shared/i18n";

// Registers the "people" namespace.
import "../index";
import { HoursSummary } from "../components/HoursSummary";
import { SAMPLE_SUMMARY } from "./fixtures/hours";

const UNAVAILABLE = "O banco de horas chega com o módulo de horas.";

/** The list item (card) of the indicator named `label`. */
function cardOf(summary: HTMLElement, label: string): HTMLElement {
  const card = within(summary).getByText(label).closest("li");
  if (!(card instanceof HTMLElement)) throw new Error(`No card for "${label}"`);
  return card;
}

describe("HoursSummary", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("shows the summary cards in hours", () => {
    render(<HoursSummary minutes={SAMPLE_SUMMARY} />);

    const summary = screen.getByRole("region", { name: "Resumo de horas" });
    const hoursByLabel = {
      "Total de horas lançadas": "58h",
      "Horas validadas": "48h",
      "Pendentes de validação": "8h",
      "Ajustadas / rejeitadas": "2h",
    };
    for (const [label, hours] of Object.entries(hoursByLabel)) {
      expect(within(cardOf(summary, label)).getByText(hours)).toBeInTheDocument();
    }
    expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument();
  });

  it("shows the empty state and no numbers without hours data", () => {
    render(<HoursSummary minutes={null} />);

    const summary = screen.getByRole("region", { name: "Resumo de horas" });
    expect(within(summary).getByText(UNAVAILABLE)).toBeInTheDocument();
    expect(screen.queryByText(/^\d+h(\d{2})?$/)).not.toBeInTheDocument();
    expect(screen.queryByText("Total de horas lançadas")).not.toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
