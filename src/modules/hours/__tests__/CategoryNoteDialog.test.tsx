import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { describe, expect, it } from "vitest";

import { BEATRIZ_ID, buildBeatrizSummary, director } from "./bank-fixtures";
import { apiError, createBankSpies, createBankStore, requestsTo } from "./bank-handlers";
import { renderBankRoutes, setupBankTestServer, type BankRenderOptions } from "./bank-test-utils";

setupBankTestServer();

const NOTE = "Aguardando validação da coordenação.";
const PATH = `/members/${BEATRIZ_ID}/hours/notes`;

type User = ReturnType<typeof userEvent.setup>;

async function renderMember(options: BankRenderOptions = {}) {
  await renderBankRoutes({ route: `/hours?period=2026-03&member=${BEATRIZ_ID}`, ...options });
  const table = await screen.findByRole("table", { name: /^Horas do membro por categoria/ });
  await within(table).findByText("Aula");
  return table;
}

async function openNote(user: User, category: string, options: BankRenderOptions = {}) {
  const table = await renderMember(options);
  await user.click(within(table).getByRole("button", { name: `Editar observação de ${category}` }));
  const dialog = await screen.findByRole("dialog", { name: `Observação de ${category}` });
  const field = within(dialog).getByRole("textbox", { name: "Observação" });
  const save = within(dialog).getByRole("button", { name: "Salvar observação" });
  return { table, dialog, field, save };
}

describe("CategoryNoteDialog", () => {
  it("writes the trimmed note and shows it in the table", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { table, field, save } = await openNote(user, "Aula", { spies });
    await user.type(field, "  Conferir a lista.  ");

    await user.click(save);

    expect(await within(table).findByText("Conferir a lista.")).toBeInTheDocument();
    expect(requestsTo(spies, "PUT", PATH).map((request) => request.body)).toEqual([
      { category: "lesson", note: "Conferir a lista." },
    ]);
    expect(await screen.findByText("Observação salva")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("starts with the current note and clears it when blank", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { table, field, save } = await openNote(user, "Planejamento", { spies });
    expect(field).toHaveValue(NOTE);
    await user.clear(field);

    await user.click(save);

    expect(await screen.findByText("Observação apagada")).toBeInTheDocument();
    expect(requestsTo(spies, "PUT", PATH).map((request) => request.body)).toEqual([
      { category: "planning", note: null },
    ]);
    expect(within(table).queryByText(NOTE)).not.toBeInTheDocument();
  });

  it("refuses more than 500 characters without sending", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { field, save } = await openNote(user, "Aula", { spies });
    await user.click(field);
    await user.paste("a".repeat(501));

    await user.click(save);

    await waitFor(() => expect(field).toHaveAccessibleDescription("Use até 500 caracteres."));
    expect(requestsTo(spies, "PUT", PATH)).toEqual([]);
  });

  it("keeps the dialog and the text when saving fails", async () => {
    const user = userEvent.setup();
    const { dialog, field, save } = await openNote(user, "Aula", {
      extraHandlers: [http.put("*/members/:id/hours/notes", () => apiError(500, "INTERNAL"))],
    });
    await user.type(field, "Texto");

    await user.click(save);

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Não foi possível salvar a observação. Tente de novo.",
    );
    expect(field).toHaveValue("Texto");
  });

  it("shows the note to the director without the button to edit", async () => {
    const table = await renderMember({ user: director() });

    expect(within(table).getByText(NOTE)).toBeInTheDocument();
    expect(within(table).queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows a category with a note and no entries in the period", async () => {
    const store = createBankStore();
    const summary = buildBeatrizSummary();
    store.memberSummaries.set(BEATRIZ_ID, {
      ...summary,
      byCategory: summary.byCategory.map((total) =>
        total.category === "meeting" ? { ...total, note: "Falta a ata." } : total,
      ),
    });

    const table = await renderMember({ store });

    expect(within(table).getByText("Reunião")).toBeInTheDocument();
    expect(within(table).getByText("Falta a ata.")).toBeInTheDocument();
  });
});
