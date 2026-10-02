import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import i18n from "@shared/i18n";

// Registra o namespace "people".
import "../index";
import { CategoryHoursCard } from "../components/CategoryHoursCard";

type Language = "pt-BR" | "en-US";

/** Renderiza uma única linha e devolve a célula "Pendentes" dela. */
async function renderPendingCell(pendingMinutes: number, language: Language) {
  await i18n.changeLanguage(language);
  render(
    <CategoryHoursCard
      period="2026-03"
      rows={[{ category: "planning", totalMinutes: 3000, pendingMinutes, note: "Observação" }]}
    />,
  );
  return screen.getAllByRole("cell")[2];
}

// O pt-BR tem a categoria de plural `many` (a partir de 1 milhão); o en-US não.
const PENDING_CASES = [
  { minutes: 480, tag: "8h", ptBR: "8 horas pendentes", enUS: "8 hours pending" },
  { minutes: 60, tag: "1h", ptBR: "1 hora pendente", enUS: "1 hour pending" },
  {
    minutes: 90,
    tag: "1h30",
    ptBR: "1 hora e 30 minutos pendentes",
    enUS: "1 hour and 30 minutes pending",
  },
  {
    minutes: 150,
    tag: "2h30",
    ptBR: "2 horas e 30 minutos pendentes",
    enUS: "2 hours and 30 minutes pending",
  },
  {
    minutes: 61,
    tag: "1h01",
    ptBR: "1 hora e 1 minuto pendentes",
    enUS: "1 hour and 1 minute pending",
  },
  { minutes: 30, tag: "0h30", ptBR: "30 minutos pendentes", enUS: "30 minutes pending" },
  { minutes: 1, tag: "0h01", ptBR: "1 minuto pendente", enUS: "1 minute pending" },
  {
    minutes: 60_000_000,
    tag: "1000000h",
    ptBR: "1000000 de horas pendentes",
    enUS: "1000000 hours pending",
  },
];

describe("CategoryHoursCard pending column", () => {
  it.each(PENDING_CASES)(
    "spells out $minutes pending minutes for screen readers in pt-BR",
    async ({ minutes, tag, ptBR }) => {
      const cell = await renderPendingCell(minutes, "pt-BR");

      expect(within(cell).getByText(tag)).toHaveAttribute("aria-hidden", "true");
      expect(within(cell).getByText(ptBR)).toBeInTheDocument();
    },
  );

  it.each(PENDING_CASES)(
    "spells out $minutes pending minutes for screen readers in en-US",
    async ({ minutes, tag, enUS }) => {
      const cell = await renderPendingCell(minutes, "en-US");

      expect(within(cell).getByText(tag)).toHaveAttribute("aria-hidden", "true");
      expect(within(cell).getByText(enUS)).toBeInTheDocument();
    },
  );

  it.each([
    { language: "pt-BR" as const, header: "Pendentes", label: "Sem pendência" },
    { language: "en-US" as const, header: "Pending", label: "Nothing pending" },
  ])("names the column and the empty cell in $language", async ({ language, header, label }) => {
    const cell = await renderPendingCell(0, language);

    expect(screen.getByRole("columnheader", { name: header })).toBeInTheDocument();
    expect(within(cell).getByText("—")).toHaveAttribute("aria-hidden", "true");
    expect(within(cell).getByText(label)).toBeInTheDocument();
  });
});
