import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { describe, expect, it } from "vitest";

import type { MemberHourEntryResponseDto } from "@api/generated/model";

import { PendingEntriesTable } from "../components/PendingEntriesTable";
import {
  buildEntry,
  buildOwnEntry,
  director,
  ENTRY_0503_ID,
  ENTRY_1203_ID,
  FROM,
  TO,
} from "./bank-fixtures";
import {
  apiError,
  createBankSpies,
  createBankStore,
  queueRequests,
  requestsTo,
  type BankStore,
} from "./bank-handlers";
import {
  createDeferred,
  renderBankRoutes,
  renderBankUi,
  setupBankTestServer,
  type BankRenderOptions,
} from "./bank-test-utils";

setupBankTestServer();

const MARCH_FILTER = { from: FROM, to: TO };

function renderQueue(options: BankRenderOptions = {}) {
  return renderBankUi(<PendingEntriesTable filter={MARCH_FILTER} />, options);
}

async function queueTable() {
  const table = await screen.findByRole("table", {
    name: /^Lançamentos pendentes de validação, com/,
  });
  await within(table).findByText("05/03");
  return table;
}

function row(table: HTMLElement, date: string): HTMLElement {
  return within(table).getByRole("row", { name: new RegExp(date) });
}

function entryBox(name: string, date: string): HTMLElement {
  return screen.getByRole("checkbox", { name: `Selecionar lançamento de ${name} em ${date}` });
}

function selectAllBox(): HTMLElement {
  return screen.getByRole("checkbox", { name: "Selecionar todos os lançamentos" });
}

function validateBodies(spies: ReturnType<typeof createBankSpies>): unknown[] {
  return requestsTo(spies, "PATCH", "/hour-entries/validate").map((request) => request.body);
}

/** Pending entries of March beyond the three of the Figma, one a day from the 15th. */
function morePending(count: number): MemberHourEntryResponseDto[] {
  return Array.from({ length: count }, (_, index) =>
    buildEntry({
      id: `0197a000-0000-7000-8000-0000000f${String(index).padStart(4, "0")}`,
      date: `2026-03-${String(15 + (index % 15)).padStart(2, "0")}`,
      activity: `Atividade ${index + 1}`,
      declaredMinutes: 60,
    }),
  );
}

/** Adjusts 14/03 to 2h, which leaves the toast with "Ver histórico". */
async function adjust(user: ReturnType<typeof userEvent.setup>, table: HTMLElement) {
  await user.click(
    within(row(table, "14/03")).getByRole("button", {
      name: "Ajustar lançamento de Beatriz Nunes em 14/03",
    }),
  );
  const dialog = await screen.findByRole("dialog", { name: "Ajustar lançamento" });
  await user.type(within(dialog).getByRole("textbox", { name: /Novo valor/ }), "2h");
  await user.type(
    within(dialog).getByRole("textbox", { name: /Justificativa/ }),
    "Feito em dupla.",
  );
  await user.click(within(dialog).getByRole("button", { name: "Salvar ajuste" }));
  await screen.findByText("Lançamento ajustado");
}

function storeWith(entries: MemberHourEntryResponseDto[]): BankStore {
  const store = createBankStore();
  store.entries.push(...entries);
  return store;
}

describe("PendingEntriesTable", () => {
  it("lists date, member, activity, category and hours with Validar, Ajustar and Rejeitar", async () => {
    await renderQueue();
    const table = await queueTable();

    expect(screen.getByText("Lançamentos pendentes de validação (3)")).toBeInTheDocument();
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual([
      "Selecionar todos os lançamentos",
      "Data",
      "Membro",
      "Atividade",
      "Categoria",
      "Horas",
      "Ações",
    ]);
    const first = row(table, "05/03");
    expect(
      within(first)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual([
      "Selecionar lançamento de Beatriz Nunes em 05/03",
      "05/03",
      "Beatriz Nunes",
      "Planejamento de aula — WhatsApp",
      "Planejamento",
      "4h",
      "ValidarAjustarRejeitar",
    ]);
    expect(
      within(first).getByRole("button", { name: "Validar lançamento de Beatriz Nunes em 05/03" }),
    ).toBeEnabled();
    expect(
      within(first).getByRole("button", { name: "Ajustar lançamento de Beatriz Nunes em 05/03" }),
    ).toBeEnabled();
    expect(
      within(first).getByRole("button", { name: "Rejeitar lançamento de Beatriz Nunes em 05/03" }),
    ).toBeEnabled();
    expect(within(row(table, "12/03")).getByText("Evento")).toBeInTheDocument();
  });

  it("shows the selection bar with the count and the hours, and the mixed header checkbox", async () => {
    const user = userEvent.setup();
    await renderQueue();
    await queueTable();

    await user.click(entryBox("Beatriz Nunes", "05/03"));
    await user.click(entryBox("Rafael Souza", "12/03"));

    expect(screen.getByText("2 de 3 selecionados · 8h")).toBeInTheDocument();
    expect(selectAllBox()).toBePartiallyChecked();
    expect(screen.getByRole("button", { name: "Validar selecionados (2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Limpar seleção" })).toBeInTheDocument();
  });

  it("selects every entry from the header and clears the selection", async () => {
    const user = userEvent.setup();
    await renderQueue();
    await queueTable();

    await user.click(selectAllBox());

    expect(screen.getByText("3 de 3 selecionados · 12h")).toBeInTheDocument();
    expect(selectAllBox()).toBeChecked();
    expect(entryBox("Beatriz Nunes", "14/03")).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Limpar seleção" }));

    expect(screen.queryByText(/selecionados ·/)).not.toBeInTheDocument();
    expect(selectAllBox()).not.toBeChecked();
    expect(entryBox("Beatriz Nunes", "05/03")).not.toBeChecked();
  });

  it("validates one entry from its row with the toast of one entry", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    await renderQueue({ spies });
    const table = await queueTable();

    await user.click(
      within(row(table, "05/03")).getByRole("button", {
        name: "Validar lançamento de Beatriz Nunes em 05/03",
      }),
    );

    expect(await screen.findByText("1 lançamento validado")).toBeInTheDocument();
    expect(screen.getByText("4h entraram no banco de horas de Beatriz Nunes.")).toBeInTheDocument();
    expect(validateBodies(spies)).toEqual([{ ids: [ENTRY_0503_ID] }]);
    expect(within(table).queryByText("05/03")).not.toBeInTheDocument();
    expect(screen.getByText("Lançamentos pendentes de validação (2)")).toHaveFocus();
  });

  it("validates the selected entries in batch with the toast of the names", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    await renderQueue({ spies });
    const table = await queueTable();
    await user.click(entryBox("Beatriz Nunes", "05/03"));
    await user.click(entryBox("Rafael Souza", "12/03"));

    await user.click(screen.getByRole("button", { name: "Validar selecionados (2)" }));

    expect(await screen.findByText("2 lançamentos validados")).toBeInTheDocument();
    expect(
      screen.getByText("8h entraram no banco de horas de Beatriz Nunes e Rafael Souza."),
    ).toBeInTheDocument();
    expect(validateBodies(spies)).toEqual([{ ids: [ENTRY_0503_ID, ENTRY_1203_ID] }]);
    expect(screen.getByText("Lançamentos pendentes de validação (1)")).toHaveFocus();
    expect(screen.queryByText(/selecionados ·/)).not.toBeInTheDocument();
    expect(within(table).queryByText("12/03")).not.toBeInTheDocument();
    expect(within(table).getByText("14/03")).toBeInTheDocument();
  });

  it("keeps Validar selecionados busy and the rows on screen until the queue answers again", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    await renderQueue({ spies });
    const table = await queueTable();
    await user.click(entryBox("Beatriz Nunes", "05/03"));
    await user.click(entryBox("Rafael Souza", "12/03"));
    const gate = createDeferred();
    spies.queueGate = gate.promise;
    const validateSelected = screen.getByRole("button", { name: "Validar selecionados (2)" });

    await user.click(validateSelected);

    await waitFor(() => expect(validateBodies(spies)).toHaveLength(1));
    await waitFor(() => expect(queueRequests(spies)).toHaveLength(2));
    expect(validateSelected).toHaveAttribute("aria-disabled", "true");
    expect(within(table).getByText("05/03")).toBeInTheDocument();
    expect(entryBox("Beatriz Nunes", "14/03")).toBeDisabled();

    await user.click(validateSelected);
    expect(validateBodies(spies)).toHaveLength(1);

    spies.queueGate = null;
    gate.resolve();

    expect(await screen.findByText("2 lançamentos validados")).toBeInTheDocument();
    expect(within(table).queryByText("05/03")).not.toBeInTheDocument();
    expect(validateBodies(spies)).toHaveLength(1);
  });

  it("refreshes the queue and clears the selection when an entry was already reviewed", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const store = createBankStore();
    await renderQueue({ spies, store });
    const table = await queueTable();
    await user.click(entryBox("Beatriz Nunes", "05/03"));
    await user.click(entryBox("Rafael Souza", "12/03"));
    // Somebody else validated 12/03 in the meantime.
    store.entries = store.entries.map((entry) =>
      entry.id === ENTRY_1203_ID ? { ...entry, status: "approved", validatedMinutes: 240 } : entry,
    );

    await user.click(screen.getByRole("button", { name: "Validar selecionados (2)" }));

    expect(
      await screen.findByText("Um dos lançamentos já foi revisado. A lista foi atualizada."),
    ).toBeInTheDocument();
    await waitFor(() => expect(within(table).queryByText("12/03")).not.toBeInTheDocument());
    expect(screen.queryByText(/selecionados ·/)).not.toBeInTheDocument();
    expect(entryBox("Beatriz Nunes", "05/03")).not.toBeChecked();
    expect(queueRequests(spies)).toHaveLength(2);
  });

  it("tells the person a removed entry refreshed the queue", async () => {
    const user = userEvent.setup();
    const store = createBankStore();
    await renderQueue({ store });
    const table = await queueTable();
    await user.click(selectAllBox());
    store.entries = store.entries.filter((entry) => entry.id !== ENTRY_1203_ID);

    await user.click(screen.getByRole("button", { name: "Validar selecionados (3)" }));

    expect(
      await screen.findByText("Um dos lançamentos foi removido. A lista foi atualizada."),
    ).toBeInTheDocument();
    await waitFor(() => expect(within(table).queryByText("12/03")).not.toBeInTheDocument());
    expect(screen.queryByText(/selecionados ·/)).not.toBeInTheDocument();
  });

  it("tells the person the validation failed and keeps the selection", async () => {
    const user = userEvent.setup();
    await renderQueue({
      extraHandlers: [http.patch("*/hour-entries/validate", () => apiError(500, "INTERNAL_ERROR"))],
    });
    await queueTable();
    await user.click(entryBox("Beatriz Nunes", "05/03"));
    await user.click(entryBox("Rafael Souza", "12/03"));

    await user.click(screen.getByRole("button", { name: "Validar selecionados (2)" }));

    expect(await screen.findByText("Não foi possível validar. Tente de novo.")).toBeInTheDocument();
    expect(screen.getByText("2 de 3 selecionados · 8h")).toBeInTheDocument();
    expect(entryBox("Rafael Souza", "12/03")).toBeChecked();
  });

  it("turns off the review of the person's own entry and leaves it out of select all", async () => {
    const user = userEvent.setup();
    await renderQueue({ store: storeWith([buildOwnEntry()]) });
    const table = await queueTable();
    const own = row(table, "16/03");

    expect(entryBox("Ana Paula Torres", "16/03")).toBeDisabled();
    const reviewing = within(own).getAllByRole("button", {
      name: /^(Validar|Ajustar|Rejeitar) lançamento de Ana/,
    });
    expect(reviewing).toHaveLength(3);
    for (const button of reviewing) expect(button).toBeDisabled();
    expect(own).toHaveTextContent("Você não pode revisar o próprio lançamento.");

    await user.click(selectAllBox());

    expect(screen.getByText("3 de 3 selecionados · 12h")).toBeInTheDocument();
    expect(selectAllBox()).toBeChecked();
    expect(entryBox("Ana Paula Torres", "16/03")).not.toBeChecked();
  });

  it("shows the queue to the director without selection, Validar, Ajustar, Rejeitar nor Histórico", async () => {
    await renderQueue({ user: director(), store: createBankStore("department") });
    const table = await queueTable();

    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Data", "Membro", "Atividade", "Categoria", "Horas"]);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      within(table).queryByRole("button", { name: /Validar|Ajustar|Rejeitar|histórico/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Lançamentos pendentes de validação (2)")).toBeInTheDocument();
    expect(within(table).getByText("14/03")).toBeInTheDocument();
  });

  it("goes back to the last page when validating empties the current one", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    // 21 pending: the 29/03 is alone on page 2.
    await renderQueue({ spies, store: storeWith(morePending(18)) });
    const table = await queueTable();
    const pages = screen.getByRole("navigation", { name: "Páginas dos lançamentos pendentes" });
    await user.click(within(pages).getByRole("button", { name: "Página 2" }));
    await within(table).findByText("29/03");

    await user.click(
      within(row(table, "29/03")).getByRole("button", {
        name: "Validar lançamento de Beatriz Nunes em 29/03",
      }),
    );

    expect(await screen.findByText("1 lançamento validado")).toBeInTheDocument();
    await waitFor(() => expect(within(table).getAllByRole("row")).toHaveLength(21));
    expect(within(table).getByText("05/03")).toBeInTheDocument();
    expect(screen.getByText("Lançamentos pendentes de validação (20)")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Páginas dos lançamentos pendentes" }),
    ).not.toBeInTheDocument();
    expect(queueRequests(spies).at(-1)?.url.searchParams.get("page")).toBe("1");
  });

  it("paginates a queue longer than 20 and clears the selection on another page", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    await renderQueue({ spies, store: storeWith(morePending(22)) });
    await queueTable();
    expect(screen.getByText("Mostrando 20 de 25 lançamentos")).toBeInTheDocument();
    await user.click(entryBox("Beatriz Nunes", "05/03"));
    expect(screen.getByText("1 de 20 selecionados · 4h")).toBeInTheDocument();

    const pages = screen.getByRole("navigation", { name: "Páginas dos lançamentos pendentes" });
    await user.click(within(pages).getByRole("button", { name: "Página 2" }));

    expect(await screen.findByText("Mostrando 5 de 25 lançamentos")).toBeInTheDocument();
    expect(screen.queryByText(/selecionados ·/)).not.toBeInTheDocument();
    expect(queueRequests(spies).at(-1)?.url.searchParams.get("page")).toBe("2");
  });

  it("shows the loading, empty and error states of the queue", async () => {
    const user = userEvent.setup();
    const gate = createDeferred();
    const store = createBankStore();
    await renderQueue({
      store,
      extraHandlers: [
        http.get(
          "*/hour-entries",
          async () => {
            await gate.promise;
            return apiError(500, "INTERNAL_ERROR");
          },
          { once: true },
        ),
      ],
    });

    expect(screen.getByText("Carregando lançamentos…")).toBeInTheDocument();
    expect(screen.getByText("Lançamentos pendentes de validação")).toBeInTheDocument();

    gate.resolve();

    expect(
      await screen.findByText("Não foi possível carregar os lançamentos pendentes"),
    ).toBeInTheDocument();
    store.entries = [];

    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("Nenhum lançamento pendente")).toBeInTheDocument();
    expect(
      screen.getByText("Quando alguém lançar horas, o lançamento aparece aqui para validar."),
    ).toBeInTheDocument();
    expect(screen.getByText("Lançamentos pendentes de validação (0)")).toBeInTheDocument();
  });

  it("opens the history of a pending entry from its row", async () => {
    const user = userEvent.setup();
    await renderQueue();
    const table = await queueTable();

    await user.click(
      within(row(table, "14/03")).getByRole("button", {
        name: "Ver histórico do lançamento de Beatriz Nunes em 14/03",
      }),
    );

    const history = await screen.findByRole("dialog", { name: "Histórico do lançamento" });
    expect(
      within(history).getByText("Situação atual: Pendente · declarado 4h"),
    ).toBeInTheDocument();
    expect(
      await within(history).findByText("Beatriz Nunes lançou 4h em Planejamento"),
    ).toBeInTheDocument();
  });

  it("closes the toast of Ver histórico when the queue leaves the screen", async () => {
    const user = userEvent.setup();
    await renderBankRoutes({ route: "/hours?period=2026-03" });
    const table = await queueTable();
    await adjust(user, table);
    const region = screen.getByRole("region", { name: "Notificações" });
    expect(await within(region).findByRole("button", { name: "Ver histórico" })).toBeVisible();

    // The view of a member mounts its own queue: the one of everyone leaves the screen.
    await user.click(screen.getByRole("button", { name: "Ver membro Beatriz Nunes" }));

    await waitFor(() => expect(screen.queryByText("Lançamento ajustado")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Ver histórico" })).not.toBeInTheDocument();
  });

  it("closes the toast of Ver histórico before the toast of the next review", async () => {
    const user = userEvent.setup();
    await renderQueue();
    const table = await queueTable();
    await adjust(user, table);
    // The region of the toasts is drawn again when its queue empties: read it each time.
    const toasts = () => screen.getByRole("region", { name: "Notificações" });
    await within(toasts()).findByRole("button", { name: "Ver histórico" });

    await user.click(
      within(row(table, "05/03")).getByRole("button", {
        name: "Validar lançamento de Beatriz Nunes em 05/03",
      }),
    );

    expect(await screen.findByText("1 lançamento validado")).toBeInTheDocument();
    expect(within(toasts()).queryByText("Lançamento ajustado")).not.toBeInTheDocument();

    await user.click(within(toasts()).getByRole("button", { name: "Fechar notificação" }));

    await waitFor(() =>
      expect(screen.queryByText("1 lançamento validado")).not.toBeInTheDocument(),
    );
    expect(screen.queryByText("Lançamento ajustado")).not.toBeInTheDocument();
  });

  it("shows the spinner only on the Validar of the row being validated", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    await renderQueue({ spies });
    const table = await queueTable();
    spies.queueGate = createDeferred().promise;
    const first = within(row(table, "05/03")).getByRole("button", { name: /^Validar/ });
    const second = within(row(table, "12/03")).getByRole("button", { name: /^Validar/ });

    await user.click(first);

    await waitFor(() => expect(first).toHaveAttribute("data-pending", "true"));
    expect(first).toHaveAttribute("aria-disabled", "true");
    expect(second).not.toHaveAttribute("data-pending");
    expect(second).toBeDisabled();
  });
});
