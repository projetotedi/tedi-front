import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { describe, expect, it, vi } from "vitest";

import {
  HourEntryEventType,
  HourEntryStatus,
  type HourEntryEventResponseDto,
} from "@api/generated/model";

import { EntryHistoryDialog } from "../components/EntryHistoryDialog";
import {
  ANA_ID,
  buildCreatedEvent,
  buildEntry,
  ENTRY_1403_ID,
  EVENT_ADJUSTED_ID,
} from "./bank-fixtures";
import { apiError, createBankStore, type BankStore } from "./bank-handlers";
import { createDeferred, renderBankUi, setupBankTestServer } from "./bank-test-utils";

setupBankTestServer();

const JUSTIFICATION = "Feito em dupla com o Rafael: cada um registra 2h.";

const PENDING = buildEntry({
  id: ENTRY_1403_ID,
  date: "2026-03-14",
  activity: "Planejamento de conteúdo do bimestre",
  createdAt: "2026-03-14T21:42:00.000Z",
});

const ADJUSTED = {
  ...PENDING,
  status: HourEntryStatus.adjusted,
  validatedMinutes: 120,
  reviewNote: JUSTIFICATION,
  reviewedAt: "2026-03-16T13:15:00.000Z",
  reviewedById: ANA_ID,
};

function reviewEvent(overrides: Partial<HourEntryEventResponseDto>): HourEntryEventResponseDto {
  return {
    id: EVENT_ADJUSTED_ID,
    hourEntryId: ENTRY_1403_ID,
    type: HourEntryEventType.adjusted,
    actor: { id: ANA_ID, name: "Ana Paula Torres" },
    createdAt: "2026-03-16T13:15:00.000Z",
    fromMinutes: 240,
    toMinutes: 120,
    fromStatus: HourEntryStatus.pending,
    toStatus: HourEntryStatus.adjusted,
    note: JUSTIFICATION,
    ...overrides,
  };
}

function storeWithHistory(events: HourEntryEventResponseDto[]): BankStore {
  const store = createBankStore();
  store.history.set(ENTRY_1403_ID, [buildCreatedEvent(PENDING), ...events]);
  return store;
}

/** The lines of each event of the timeline, the newest first. */
function timeline(): string[][] {
  const list = screen.getByRole("list", { name: "Linha do tempo" });
  return within(list)
    .getAllByRole("listitem")
    .map((item) => [...item.querySelectorAll("p")].map((line) => line.textContent ?? ""));
}

describe("EntryHistoryDialog", () => {
  it("shows the current status and the timeline, newest first", async () => {
    await renderBankUi(<EntryHistoryDialog entry={ADJUSTED} onClose={vi.fn()} />, {
      store: storeWithHistory([reviewEvent({})]),
    });

    const dialog = await screen.findByRole("dialog", { name: "Histórico do lançamento" });
    await within(dialog).findByRole("list", { name: "Linha do tempo" });
    expect(within(dialog).getByText("Beatriz Nunes · Planejamento · 14/03")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Situação atual: Ajustado · declarado 4h · validado 2h"),
    ).toBeInTheDocument();
    expect(timeline()).toEqual([
      [
        "16/03 · 10:15",
        "Ana Paula Torres ajustou de 4h para 2h",
        `Justificativa: “${JUSTIFICATION}”`,
      ],
      ["14/03 · 18:42", "Beatriz Nunes lançou 4h em Planejamento", "Status: pendente de validação"],
    ]);
  });

  it("says O histórico não pode ser editado nem apagado", async () => {
    await renderBankUi(<EntryHistoryDialog entry={PENDING} onClose={vi.fn()} />, {
      store: storeWithHistory([]),
    });

    const dialog = await screen.findByRole("dialog", { name: "Histórico do lançamento" });
    expect(
      within(dialog).getByText("O histórico não pode ser editado nem apagado."),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Situação atual: Pendente · declarado 4h")).toBeInTheDocument();
  });

  it.each([
    [
      "approved",
      reviewEvent({ type: HourEntryEventType.approved, toMinutes: 240, note: null }),
      ["Ana Paula Torres validou 4h", "Status: aprovado"],
    ],
    [
      "rejected",
      reviewEvent({
        type: HourEntryEventType.rejected,
        toMinutes: 0,
        toStatus: HourEntryStatus.rejected,
        note: "Sem comprovação.",
      }),
      ["Ana Paula Torres rejeitou o lançamento", "Motivo: “Sem comprovação.”"],
    ],
    [
      "removed",
      reviewEvent({
        type: HourEntryEventType.removed,
        toMinutes: null,
        toStatus: null,
        note: null,
      }),
      ["Ana Paula Torres removeu o lançamento"],
    ],
    [
      "reversed",
      reviewEvent({ type: HourEntryEventType.reversed, actor: null, note: null }),
      ["As horas foram estornadas", "Correção da presença ou aula cancelada."],
    ],
    [
      "adjusted by someone who was removed",
      reviewEvent({ actor: null }),
      ["Alguém ajustou de 4h para 2h", `Justificativa: “${JUSTIFICATION}”`],
    ],
  ])("writes the event %s", async (_type, event, lines) => {
    await renderBankUi(<EntryHistoryDialog entry={ADJUSTED} onClose={vi.fn()} />, {
      store: storeWithHistory([event]),
    });

    await screen.findByRole("list", { name: "Linha do tempo" });
    expect(timeline()[0]).toEqual(["16/03 · 10:15", ...lines]);
  });

  it.each([
    [
      "created, with no minutes nor status",
      PENDING,
      { ...buildCreatedEvent(PENDING), toMinutes: null, toStatus: null },
      ["14/03 · 18:42", "Beatriz Nunes lançou 4h em Planejamento"],
    ],
    [
      "adjusted, with no minutes nor note",
      ADJUSTED,
      reviewEvent({ fromMinutes: null, toMinutes: null, note: null }),
      ["16/03 · 10:15", "Ana Paula Torres ajustou de 4h para 2h"],
    ],
    [
      "adjusted, of an entry that carries no validated minutes either",
      { ...ADJUSTED, validatedMinutes: null },
      reviewEvent({ toMinutes: null, note: null }),
      ["16/03 · 10:15", "Ana Paula Torres ajustou de 4h para 4h"],
    ],
    [
      "approved, with no minutes",
      { ...ADJUSTED, status: HourEntryStatus.approved, validatedMinutes: 240 },
      reviewEvent({ type: HourEntryEventType.approved, toMinutes: null, note: null }),
      ["16/03 · 10:15", "Ana Paula Torres validou 4h", "Status: aprovado"],
    ],
    [
      "rejected, with no reason",
      { ...ADJUSTED, status: HourEntryStatus.rejected, validatedMinutes: 0 },
      reviewEvent({ type: HourEntryEventType.rejected, toMinutes: 0, note: null }),
      ["16/03 · 10:15", "Ana Paula Torres rejeitou o lançamento"],
    ],
  ])("writes the event %s with what the entry knows", async (_case, entry, event, lines) => {
    const store = createBankStore();
    store.history.set(ENTRY_1403_ID, [event]);
    await renderBankUi(<EntryHistoryDialog entry={entry} onClose={vi.fn()} />, { store });

    await screen.findByRole("list", { name: "Linha do tempo" });
    expect(timeline()).toEqual([lines]);
  });

  it("says validado — when an adjusted entry carries no validated minutes", async () => {
    await renderBankUi(
      <EntryHistoryDialog entry={{ ...ADJUSTED, validatedMinutes: null }} onClose={vi.fn()} />,
      { store: storeWithHistory([reviewEvent({})]) },
    );

    expect(
      await screen.findByText("Situação atual: Ajustado · declarado 4h · validado —"),
    ).toBeInTheDocument();
  });

  it("keeps the alert and Tentar de novo, busy and with the focus, while it reads again", async () => {
    const user = userEvent.setup();
    const gate = createDeferred();
    let calls = 0;
    await renderBankUi(<EntryHistoryDialog entry={ADJUSTED} onClose={vi.fn()} />, {
      store: storeWithHistory([reviewEvent({})]),
      extraHandlers: [
        http.get("*/hour-entries/:id/history", async () => {
          calls += 1;
          if (calls === 1) return apiError(500, "INTERNAL");
          await gate.promise;
        }),
      ],
    });
    const retry = await screen.findByRole("button", { name: "Tentar de novo" });

    await user.click(retry);

    await waitFor(() => expect(retry).toHaveAttribute("data-pending", "true"));
    expect(retry).toHaveFocus();
    expect(screen.getByText("Não foi possível carregar o histórico.")).toBeInTheDocument();
    expect(screen.queryByText("Carregando o histórico…")).not.toBeInTheDocument();

    gate.resolve();

    expect(await screen.findByRole("list", { name: "Linha do tempo" })).toBeInTheDocument();
  });

  it("shows the loading state and then the events", async () => {
    const gate = createDeferred();
    await renderBankUi(<EntryHistoryDialog entry={ADJUSTED} onClose={vi.fn()} />, {
      store: storeWithHistory([reviewEvent({})]),
      extraHandlers: [
        http.get("*/hour-entries/:id/history", async () => {
          await gate.promise;
        }),
      ],
    });

    expect(await screen.findByText("Carregando o histórico…")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Linha do tempo" })).not.toBeInTheDocument();

    gate.resolve();

    expect(await screen.findByRole("list", { name: "Linha do tempo" })).toBeInTheDocument();
    expect(screen.queryByText("Carregando o histórico…")).not.toBeInTheDocument();
  });

  it("shows the error with Tentar de novo, which reads it again", async () => {
    const user = userEvent.setup();
    await renderBankUi(<EntryHistoryDialog entry={ADJUSTED} onClose={vi.fn()} />, {
      store: storeWithHistory([reviewEvent({})]),
      extraHandlers: [
        http.get("*/hour-entries/:id/history", () => apiError(500, "INTERNAL"), { once: true }),
      ],
    });

    expect(await screen.findByText("Não foi possível carregar o histórico.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByRole("list", { name: "Linha do tempo" })).toBeInTheDocument();
    expect(timeline()).toHaveLength(2);
  });

  it("Escape and the × close", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    await renderBankUi(<EntryHistoryDialog entry={ADJUSTED} onClose={onClose} />, {
      store: storeWithHistory([reviewEvent({})]),
    });
    const dialog = await screen.findByRole("dialog", { name: "Histórico do lançamento" });

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(within(dialog).getAllByRole("button", { name: "Fechar" })[0]);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("Fechar closes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    await renderBankUi(<EntryHistoryDialog entry={ADJUSTED} onClose={onClose} />, {
      store: storeWithHistory([reviewEvent({})]),
    });
    const dialog = await screen.findByRole("dialog", { name: "Histórico do lançamento" });

    const buttons = within(dialog).getAllByRole("button", { name: "Fechar" });
    await user.click(buttons[buttons.length - 1]);

    expect(onClose).toHaveBeenCalledOnce();
  });
});
