import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { HoursMemberTotalDto } from "@api/generated/model";

import { apiError, createBankSpies, createBankStore, requestsTo } from "./bank-handlers";
import {
  createDeferred,
  renderBankRoutes,
  setupBankTestServer,
  type BankRenderOptions,
} from "./bank-test-utils";

setupBankTestServer();

const MARCH = "/hours?period=2026-03";

function renderHoursPage(options: BankRenderOptions = {}) {
  return renderBankRoutes({ route: MARCH, ...options });
}

function membersTable() {
  return screen.findByRole("table", { name: /^Horas por membro/ });
}

/** The text of each cell of the body rows. */
function bodyRows(table: HTMLElement): string[][] {
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent ?? ""),
    );
}

/** Members 13 to 25, with no pending hours: enough for a second page of twenty. */
function extraMembers(): HoursMemberTotalDto[] {
  return Array.from({ length: 13 }, (_, index) => {
    const personId = `0197a000-0000-7000-8000-0000000c00${String(index).padStart(2, "0")}`;
    return {
      personId,
      member: { id: personId, name: `Membro ${index + 13}`, department: null },
      entries: 1,
      declaredMinutes: 60,
      bankMinutes: 60,
      pendingEntries: 0,
      pendingMinutes: 0,
    };
  });
}

describe("HoursPage", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the filters: Buscar membro, Período with Março/2026, Visão with Todos pressed, and Exportar relatório", async () => {
    await renderHoursPage();

    expect(screen.getByRole("textbox", { name: "Buscar membro" })).toHaveAttribute(
      "placeholder",
      "Buscar membro por nome…",
    );
    expect(screen.getByRole("button", { name: /Período/ })).toHaveTextContent("Março/2026");
    const view = screen.getByRole("group", { name: "Visão" });
    expect(within(view).getByRole("button", { name: "Todos" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Exportar relatório" })).toBeInTheDocument();
  });

  it("shows the four totals of the period", async () => {
    await renderHoursPage();

    const totals = await screen.findByRole("list", { name: "Totais do período" });
    await within(totals).findByText("312h");
    expect(
      within(totals)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Total de horas lançadas312h",
      "Horas validadas276h",
      "Pendentes de validação12h",
      "Ajustadas / rejeitadas24h",
    ]);
  });

  it("lists 4 members with the pending ones first and Ver todos", async () => {
    await renderHoursPage();

    const table = await membersTable();
    await within(table).findByText("Beatriz Nunes");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(expect.arrayContaining(["Membro", "Departamento", "Lançadas", "Pendentes"]));
    expect(bodyRows(table).map((cells) => cells.slice(0, 4))).toEqual([
      ["Beatriz Nunes", "Tecnologia", "46h", "8h"],
      ["Rafael Souza", "Comunicação", "38h", "4h"],
      ["Carla Mendes", "Pedagogia", "32h", "—Sem pendência"],
      ["Diego Alves", "Tecnologia", "28h", "—Sem pendência"],
    ]);
    expect(
      screen.getByText("Mostrando 4 de 12 membros, com pendências primeiro"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver todos" })).toBeInTheDocument();
  });

  it("Ver todos lists 20 per page with pagination and hides the button", async () => {
    const user = userEvent.setup();
    const store = createBankStore();
    store.members.push(...extraMembers());
    const spies = createBankSpies();
    await renderHoursPage({ store, spies });
    await within(await membersTable()).findByText("Beatriz Nunes");

    await user.click(screen.getByRole("button", { name: "Ver todos" }));

    expect(
      await screen.findByText("Mostrando 20 de 25 membros, com pendências primeiro"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver todos" })).not.toBeInTheDocument();
    const lastOverview = requestsTo(spies, "GET", "/hours/overview").at(-1);
    expect(lastOverview?.url.searchParams.get("limit")).toBe("20");
    expect(lastOverview?.url.searchParams.get("page")).toBe("1");

    const pages = screen.getByRole("navigation", { name: "Páginas dos membros" });
    await user.click(within(pages).getByRole("button", { name: "Página 2" }));

    expect(
      await screen.findByText("Mostrando 5 de 25 membros, com pendências primeiro"),
    ).toBeInTheDocument();
    expect(requestsTo(spies, "GET", "/hours/overview").at(-1)?.url.searchParams.get("page")).toBe(
      "2",
    );
  });

  it("sends the search to the overview after the pause and starts the members on the first page", async () => {
    const user = userEvent.setup();
    const store = createBankStore();
    store.members.push(...extraMembers());
    const spies = createBankSpies();
    await renderHoursPage({ store, spies });
    await within(await membersTable()).findByText("Beatriz Nunes");
    await user.click(screen.getByRole("button", { name: "Ver todos" }));
    const pages = await screen.findByRole("navigation", { name: "Páginas dos membros" });
    await user.click(within(pages).getByRole("button", { name: "Página 2" }));
    await screen.findByText("Mostrando 5 de 25 membros, com pendências primeiro");

    await user.type(screen.getByRole("textbox", { name: "Buscar membro" }), "Membro");

    expect(
      requestsTo(spies, "GET", "/hours/overview").some((request) =>
        request.url.searchParams.has("search"),
      ),
    ).toBe(false);
    await waitFor(() => {
      const last = requestsTo(spies, "GET", "/hours/overview").at(-1);
      expect(last?.url.searchParams.get("search")).toBe("Membro");
      expect(last?.url.searchParams.get("page")).toBe("1");
    });
    expect(
      await screen.findByText("Mostrando 13 de 13 membros, com pendências primeiro"),
    ).toBeInTheDocument();
  });

  it("shows Nenhum membro encontrado with Limpar busca, which clears and focuses the field", async () => {
    const user = userEvent.setup();
    await renderHoursPage();
    await within(await membersTable()).findByText("Beatriz Nunes");
    const search = screen.getByRole("textbox", { name: "Buscar membro" });

    await user.type(search, "Zé Ninguém");

    expect(await screen.findByText("Nenhum membro encontrado")).toBeInTheDocument();
    expect(
      screen.getByText("Nenhum membro combina com a busca. Tente outro nome."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpar busca" }));

    expect(search).toHaveValue("");
    expect(search).toHaveFocus();
    expect(await within(await membersTable()).findByText("Beatriz Nunes")).toBeInTheDocument();
  });

  it("shows Nenhum lançamento neste período when the period has no entries", async () => {
    const store = createBankStore();
    store.members = [];
    await renderHoursPage({ store });

    expect(await screen.findByText("Nenhum lançamento neste período")).toBeInTheDocument();
    expect(
      screen.getByText("Quando os membros lançarem horas, elas aparecem aqui."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Mostrando/)).not.toBeInTheDocument();
  });

  it("shows the error of the bank with Tentar de novo, which reads it again", async () => {
    const user = userEvent.setup();
    await renderHoursPage({
      extraHandlers: [
        http.get("*/hours/overview", () => apiError(500, "INTERNAL_ERROR"), { once: true }),
      ],
    });

    expect(
      await screen.findByText("Não foi possível carregar o banco de horas"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Totais do período" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await within(await membersTable()).findByText("Beatriz Nunes")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Totais do período" })).toHaveTextContent("312h");
  });

  it("shows the loading state before the first answer", async () => {
    const gate = createDeferred();
    await renderHoursPage({
      extraHandlers: [
        http.get("*/hours/overview", async () => {
          await gate.promise;
        }),
      ],
    });

    expect(screen.getByText("Carregando membros…")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Totais do período" })).not.toHaveTextContent("312h");

    gate.resolve();

    expect(await screen.findByText("312h")).toBeInTheDocument();
    expect(screen.queryByText("Carregando membros…")).not.toBeInTheDocument();
  });

  it("asks every block for the first and last day of the chosen month", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { router } = await renderHoursPage({ spies });
    await within(await membersTable()).findByText("Beatriz Nunes");
    const before = requestsTo(spies, "GET", "/hours/overview").at(-1);
    expect(before?.url.searchParams.get("from")).toBe("2026-03-01");
    expect(before?.url.searchParams.get("to")).toBe("2026-03-31");

    await user.click(screen.getByRole("button", { name: /Período/ }));
    await user.click(await screen.findByRole("option", { name: "Fevereiro/2026" }));

    await waitFor(() => {
      const last = requestsTo(spies, "GET", "/hours/overview").at(-1);
      expect(last?.url.searchParams.get("from")).toBe("2026-02-01");
      expect(last?.url.searchParams.get("to")).toBe("2026-02-28");
    });
    expect(new URLSearchParams(router.state.location.search).get("period")).toBe("2026-02");
  });

  it("offers the months from the oldest entry to the current month, newest first", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-16T12:00:00-03:00"));
    const user = userEvent.setup();
    await renderBankRoutes({ route: "/hours" });
    const period = screen.getByRole("button", { name: /Período/ });
    expect(period).toHaveTextContent("Março/2026");

    await user.click(period);

    await waitFor(() =>
      expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
        "Março/2026",
        "Fevereiro/2026",
      ]),
    );
  });
});
