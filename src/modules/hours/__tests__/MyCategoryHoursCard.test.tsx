import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getGetMyHoursSummaryQueryKey } from "@api/generated/hours/hours";

import { MyCategoryHoursCard } from "../components/MyCategoryHoursCard";
import { buildSummary, myHoursSummaryHandler, type SummaryCall } from "./entries-handlers";
import {
  createDeferred,
  freezeToday,
  renderWithProviders,
  server,
  setupHoursEntriesTestServer,
} from "./entries-test-utils";

setupHoursEntriesTestServer();

const MONTH_KEY = getGetMyHoursSummaryQueryKey({ from: "2026-03-01", to: "2026-03-31" });
const SERVER_ERROR = { statusCode: 500, error: "INTERNAL_SERVER_ERROR" };

type Language = "pt-BR" | "en-US";

const table = (name = "Horas por categoria") => screen.getByRole("table", { name });

/** The cells of the row whose accessible name (the text of the row) matches `name`. */
function cellsOfRow(name: RegExp): HTMLElement[] {
  return within(within(table()).getByRole("row", { name })).getAllByRole("cell");
}

/** A month with one row, Planejamento, with `pendingMinutes` waiting; returns its cell Pendentes. */
async function renderPendingCell(pendingMinutes: number, language: Language) {
  server.use(
    myHoursSummaryHandler({
      month: buildSummary({
        byCategory: [
          {
            category: "planning",
            entries: 1,
            declaredMinutes: 3000,
            bankMinutes: 3000,
            pendingMinutes,
          },
        ],
      }),
    }),
  );
  await renderWithProviders(<MyCategoryHoursCard />, { language });
  const [rows] = await screen.findAllByRole("table");
  return within(rows).getAllByRole("cell")[2];
}

// The pt-BR has the plural category `many` (from 1 million on); the en-US does not.
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
  { minutes: 0.5, tag: "0h01", ptBR: "1 minuto pendente", enUS: "1 minute pending" },
  {
    minutes: 60_000_000,
    tag: "1000000h",
    ptBR: "1000000 de horas pendentes",
    enUS: "1000000 hours pending",
  },
];

describe("MyCategoryHoursCard", () => {
  freezeToday();

  it("asks the summary of the current month and shows Março/2026 next to the title", async () => {
    const onCall = vi.fn<(call: SummaryCall) => void>();
    server.use(myHoursSummaryHandler({ onCall }));
    await renderWithProviders(<MyCategoryHoursCard />);

    await screen.findByRole("table", { name: "Horas por categoria" });

    expect(onCall).toHaveBeenCalledExactlyOnceWith({ from: "2026-03-01", to: "2026-03-31" });
    expect(screen.getByRole("heading", { name: "Horas por categoria" })).toBeInTheDocument();
    expect(screen.getByText("Março/2026")).toBeInTheDocument();
  });

  it("lists Aula 28h, Gestão 20h, Planejamento 8h and Evento 2h, in this order, with three columns and no Observação", async () => {
    server.use(myHoursSummaryHandler());
    await renderWithProviders(<MyCategoryHoursCard />);
    await screen.findByRole("table", { name: "Horas por categoria" });

    expect(
      within(table())
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Categoria", "Horas", "Pendentes"]);
    expect(screen.queryByText(/Observação/)).not.toBeInTheDocument();

    const rows = within(table())
      .getAllByRole("row")
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole("cell")
          .slice(0, 2)
          .map((cell) => cell.textContent),
      );
    expect(rows).toEqual([
      ["Aula", "28h"],
      ["Gestão", "20h"],
      ["Planejamento", "8h"],
      ["Evento", "2h"],
    ]);

    const planning = cellsOfRow(/^Planejamento/);
    expect(within(planning[2]).getByText("8h")).toHaveAttribute("aria-hidden", "true");
    expect(within(planning[2]).getByText("8 horas pendentes")).toBeInTheDocument();
  });

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

  it.each([0, 0.4])(
    "shows the dash and Sem pendência when nothing is pending, also when it rounds to zero (%s)",
    async (minutes) => {
      const cell = await renderPendingCell(minutes, "pt-BR");

      expect(within(cell).getByText("—")).toHaveAttribute("aria-hidden", "true");
      expect(within(cell).getByText("Sem pendência")).toBeInTheDocument();
      expect(within(cell).queryByText("0h")).not.toBeInTheDocument();
    },
  );

  it.each([
    { language: "pt-BR" as const, header: "Pendentes", label: "Sem pendência" },
    { language: "en-US" as const, header: "Pending", label: "Nothing pending" },
  ])(
    "names the pending column and the empty cell in both languages ($language)",
    async ({ language, header, label }) => {
      const cell = await renderPendingCell(0, language);

      expect(screen.getByRole("columnheader", { name: header })).toBeInTheDocument();
      expect(within(cell).getByText("—")).toHaveAttribute("aria-hidden", "true");
      expect(within(cell).getByText(label)).toBeInTheDocument();
    },
  );

  it("says no hours were logged in the month when it has none", async () => {
    server.use(myHoursSummaryHandler({ month: buildSummary() }));
    await renderWithProviders(<MyCategoryHoursCard />);

    expect(await screen.findByText("Nenhuma hora lançada em Março/2026.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("Março/2026")).toBeInTheDocument();
  });

  it("shows skeletons while loading", async () => {
    const response = createDeferred();
    server.use(myHoursSummaryHandler({ delay: response.promise }));
    await renderWithProviders(<MyCategoryHoursCard />);

    expect(screen.getByRole("status")).toHaveTextContent("Carregando as horas por categoria…");
    expect(screen.getByText("Março/2026")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    response.resolve();

    expect(await screen.findByRole("table", { name: "Horas por categoria" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the error with Tentar de novo, which asks again", async () => {
    server.use(myHoursSummaryHandler({ error: SERVER_ERROR }));
    const user = userEvent.setup();
    await renderWithProviders(<MyCategoryHoursCard />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as suas horas.",
    );

    server.use(myHoursSummaryHandler());
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByRole("table", { name: "Horas por categoria" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("drops the month summary from the cache when it unmounts", async () => {
    server.use(myHoursSummaryHandler());
    const { unmount, queryClient } = await renderWithProviders(<MyCategoryHoursCard />);
    await screen.findByRole("table", { name: "Horas por categoria" });
    expect(queryClient.getQueryState(MONTH_KEY)).toBeDefined();

    unmount();

    await waitFor(() => expect(queryClient.getQueryState(MONTH_KEY)).toBeUndefined());
  });
});
