import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { HoursMemberTotalDto } from "@api/generated/model";

import { BEATRIZ_ID, director, ENTRY_0503_ID, ENTRY_1203_ID, RAFAEL_ID } from "./bank-fixtures";
import {
  apiError,
  createBankSpies,
  createBankStore,
  queueRequests,
  requestsTo,
} from "./bank-handlers";
import {
  createDeferred,
  renderBankRoutes,
  server,
  setupBankTestServer,
  type BankRenderOptions,
} from "./bank-test-utils";

setupBankTestServer();

const MARCH = "/hours?period=2026-03";
const BEATRIZ_VIEW = `/hours?period=2026-03&member=${BEATRIZ_ID}`;

function searchOf(location: { search: string }) {
  return new URLSearchParams(location.search);
}

function viewGroup() {
  return screen.getByRole("group", { name: "Visão" });
}

function categoriesTable() {
  return screen.findByRole("table", { name: /^Horas do membro por categoria/ });
}

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
    await waitFor(() => {
      const queue = queueRequests(spies).at(-1);
      expect(queue?.url.searchParams.get("from")).toBe("2026-02-01");
      expect(queue?.url.searchParams.get("to")).toBe("2026-02-28");
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

  it("opens the member view from Ver membro and from the row", async () => {
    const user = userEvent.setup();
    const { router } = await renderHoursPage();
    const table = await membersTable();
    await within(table).findByText("Beatriz Nunes");

    await user.click(within(table).getByRole("button", { name: "Ver membro Beatriz Nunes" }));

    expect(searchOf(router.state.location).get("member")).toBe(BEATRIZ_ID);
    expect(searchOf(router.state.location).get("period")).toBe("2026-03");
    expect(await within(viewGroup()).findByText("Beatriz Nunes")).toBeInTheDocument();
    expect(within(viewGroup()).getByRole("button", { name: "Todos" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByText("Horas por categoria do membro")).toHaveFocus();

    await user.click(within(viewGroup()).getByRole("button", { name: "Todos" }));
    await user.click(await within(await membersTable()).findByText("Rafael Souza"));

    expect(searchOf(router.state.location).get("member")).toBe(RAFAEL_ID);
    expect(await within(viewGroup()).findByText("Rafael Souza")).toBeInTheDocument();
  });

  it("shows the totals of the member: 46h, 36h, 8h and 2h", async () => {
    await renderHoursPage({ route: BEATRIZ_VIEW });

    const totals = await screen.findByRole("list", { name: "Totais do período" });
    await within(totals).findByText("46h");
    expect(
      within(totals)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Total de horas lançadas46h",
      "Horas validadas36h",
      "Pendentes de validação8h",
      "Ajustadas / rejeitadas2h",
    ]);
    expect(screen.queryByRole("table", { name: /^Horas por membro/ })).not.toBeInTheDocument();
  });

  it("shows the hours by category of the member, only the categories with entries, without Observação", async () => {
    await renderHoursPage({ route: BEATRIZ_VIEW });

    const table = await categoriesTable();
    await within(table).findByText("Aula");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Categoria", "Horas", "Pendentes"]);
    expect(bodyRows(table)).toEqual([
      ["Aula", "28h", "—Sem pendência"],
      ["Planejamento", "8h", "8h"],
      ["Evento", "4h", "—Sem pendência"],
      ["Gestão", "4h", "—Sem pendência"],
      ["Outros", "2h", "—Sem pendência"],
    ]);
    expect(screen.queryByText(/Observação/i)).not.toBeInTheDocument();
  });

  it("goes back to Todos by the × of the chip and by Todos", async () => {
    const user = userEvent.setup();
    const { router } = await renderHoursPage({ route: BEATRIZ_VIEW });
    await within(viewGroup()).findByText("Beatriz Nunes");

    await user.click(within(viewGroup()).getByRole("button", { name: "Voltar para Todos" }));

    expect(searchOf(router.state.location).has("member")).toBe(false);
    expect(within(viewGroup()).getByRole("button", { name: "Todos" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Horas por membro")).toHaveFocus();

    await user.click(
      await within(await membersTable()).findByRole("button", { name: "Ver membro Beatriz Nunes" }),
    );
    await within(viewGroup()).findByText("Beatriz Nunes");
    await user.click(within(viewGroup()).getByRole("button", { name: "Todos" }));

    expect(searchOf(router.state.location).has("member")).toBe(false);
    expect(within(viewGroup()).queryByText("Beatriz Nunes")).not.toBeInTheDocument();
    expect(screen.getByText("Horas por membro")).toHaveFocus();
  });

  it("goes back to Todos when the person types in the member view", async () => {
    const user = userEvent.setup();
    const { router } = await renderHoursPage({ route: BEATRIZ_VIEW });
    await within(viewGroup()).findByText("Beatriz Nunes");
    const search = screen.getByRole("textbox", { name: "Buscar membro" });

    await user.type(search, "Car");

    expect(searchOf(router.state.location).has("member")).toBe(false);
    expect(search).toHaveValue("Car");
    expect(search).toHaveFocus();
    expect(await within(await membersTable()).findByText("Carla Mendes")).toBeInTheDocument();
  });

  it("shows Não foi possível abrir este membro with Voltar para Todos when the member is not found", async () => {
    const user = userEvent.setup();
    const { router } = await renderHoursPage({
      route: "/hours?period=2026-03&member=0197a000-0000-7000-8000-00000000ffff",
    });

    expect(await screen.findByText("Não foi possível abrir este membro")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Totais do período" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Voltar para Todos" }));

    expect(searchOf(router.state.location).has("member")).toBe(false);
    const table = await membersTable();
    await within(table).findByText("Beatriz Nunes");

    // A member out of the department of the director answers 403 FORBIDDEN_SCOPE.
    server.use(http.get("*/members/:id/hours", () => apiError(403, "FORBIDDEN_SCOPE")));
    await user.click(within(table).getByRole("button", { name: "Ver membro Beatriz Nunes" }));

    expect(await screen.findByText("Não foi possível abrir este membro")).toBeInTheDocument();
  });

  it("lists the pending entries of the member in the period", async () => {
    const spies = createBankSpies();
    await renderHoursPage({ route: BEATRIZ_VIEW, spies });

    expect(await screen.findByText("Lançamentos pendentes de validação (2)")).toBeInTheDocument();
    const queue = queueRequests(spies).at(-1);
    expect(queue?.url.searchParams.get("personId")).toBe(BEATRIZ_ID);
    expect(queue?.url.searchParams.get("from")).toBe("2026-03-01");
    expect(queue?.url.searchParams.get("to")).toBe("2026-03-31");
    const table = screen.getByRole("table", { name: /^Lançamentos pendentes de validação, com/ });
    await within(table).findByText("05/03");
    expect(within(table).getByText("14/03")).toBeInTheDocument();
    expect(within(table).queryByText("12/03")).not.toBeInTheDocument();
  });

  it("validates the selected entries in batch: the totals change and the rows leave the queue without reloading", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { router } = await renderHoursPage({ spies });
    const totals = await screen.findByRole("list", { name: "Totais do período" });
    await within(totals).findByText("276h");
    const queue = await screen.findByRole("table", {
      name: /^Lançamentos pendentes de validação, com/,
    });
    await within(queue).findByText("05/03");
    const location = router.state.location;

    await user.click(
      screen.getByRole("checkbox", { name: "Selecionar lançamento de Beatriz Nunes em 05/03" }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "Selecionar lançamento de Rafael Souza em 12/03" }),
    );
    await user.click(screen.getByRole("button", { name: "Validar selecionados (2)" }));

    expect(await screen.findByText("2 lançamentos validados")).toBeInTheDocument();
    expect(requestsTo(spies, "PATCH", "/hour-entries/validate").map((r) => r.body)).toEqual([
      { ids: [ENTRY_0503_ID, ENTRY_1203_ID] },
    ]);
    await waitFor(() =>
      expect(
        within(totals)
          .getAllByRole("listitem")
          .map((item) => item.textContent),
      ).toEqual([
        "Total de horas lançadas312h",
        "Horas validadas284h",
        "Pendentes de validação4h",
        "Ajustadas / rejeitadas24h",
      ]),
    );
    expect(screen.getByRole("list", { name: "Totais do período" })).toBe(totals);
    expect(screen.getByText("Lançamentos pendentes de validação (1)")).toBeInTheDocument();
    expect(within(queue).queryByText("05/03")).not.toBeInTheDocument();
    expect(within(queue).queryByText("12/03")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        bodyRows(within(document.body).getByRole("table", { name: /^Horas por membro/ })).map(
          (cells) => cells.slice(0, 4),
        ),
      ).toEqual([
        ["Beatriz Nunes", "Tecnologia", "46h", "4h"],
        ["Rafael Souza", "Comunicação", "38h", "—Sem pendência"],
        ["Carla Mendes", "Pedagogia", "32h", "—Sem pendência"],
        ["Diego Alves", "Tecnologia", "28h", "—Sem pendência"],
      ]),
    );
    expect(router.state.location).toBe(location);
  });

  it("shows the director the department the API returns, with Exportar and Ver membro", async () => {
    const spies = createBankSpies();
    await renderHoursPage({ user: director(), store: createBankStore("department"), spies });

    const totals = await screen.findByRole("list", { name: "Totais do período" });
    await within(totals).findByText("74h");
    expect(
      within(totals)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Total de horas lançadas74h",
      "Horas validadas64h",
      "Pendentes de validação8h",
      "Ajustadas / rejeitadas2h",
    ]);
    const members = await membersTable();
    await within(members).findByText("Beatriz Nunes");
    expect(bodyRows(members).map((cells) => cells[0])).toEqual(["Beatriz Nunes", "Diego Alves"]);
    expect(within(members).getByRole("button", { name: "Ver membro Diego Alves" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Exportar relatório" })).toBeInTheDocument();
    for (const request of [
      ...requestsTo(spies, "GET", "/hours/overview"),
      ...queueRequests(spies),
    ]) {
      expect([...request.url.searchParams.keys()].sort()).toEqual(
        expect.not.arrayContaining(["department", "departmentId"]),
      );
    }

    const queue = screen.getByRole("table", { name: /^Lançamentos pendentes de validação, com/ });
    await within(queue).findByText("05/03");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      within(queue).queryByRole("button", { name: /Validar|Ajustar|Rejeitar/ }),
    ).not.toBeInTheDocument();
  });

  it("labels Exportar in the member view as the report of everyone", async () => {
    await renderHoursPage({ route: BEATRIZ_VIEW });

    expect(
      await screen.findByRole("button", { name: "Exportar relatório de todos" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Exportar relatório" })).not.toBeInTheDocument();
  });
});
