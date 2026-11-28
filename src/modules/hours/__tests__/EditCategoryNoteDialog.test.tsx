import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { describe, expect, it } from "vitest";

import { buildMeUser } from "@modules/auth/__tests__/handlers";
import { Role } from "@shared/lib/role";

import { BEATRIZ_ID, buildBeatrizSummary, director } from "./bank-fixtures";
import {
  apiError,
  createBankSpies,
  createBankStore,
  requestsTo,
  withNote,
  type BankSpies,
  type BankStore,
} from "./bank-handlers";
import {
  createDeferred,
  renderBankRoutes,
  setupBankTestServer,
  type BankRenderOptions,
} from "./bank-test-utils";

setupBankTestServer();

const BEATRIZ_VIEW = `/hours?period=2026-03&member=${BEATRIZ_ID}`;
const NOTE = "Ajuste de 2h por lançamento duplicado";
const OTHER_NOTE = "Ajuste de 3h, depois de conferir a lista de presença";

type User = ReturnType<typeof userEvent.setup>;

/**
 * Two presses before React renders again: the second one still sees the button free, which is the
 * race the guard of the double submit exists for (user-event lets React render between clicks).
 */
function pressTwiceAtOnce(element: HTMLElement) {
  act(() => {
    element.click();
    element.click();
  });
}

/**
 * The bank in the view of Beatriz, with the table of her hours by category on the screen once the
 * row `firstRow` is in it.
 */
async function renderMemberView(options: BankRenderOptions = {}, firstRow = "Aula") {
  const view = await renderBankRoutes({ route: BEATRIZ_VIEW, ...options });
  const table = await screen.findByRole("table", { name: /^Horas do membro por categoria/ });
  await within(table).findByText(firstRow);
  return { ...view, table };
}

/** The store where Beatriz has no entry in any category: only a note keeps a row in her table. */
function storeWithoutEntries(): BankStore {
  const store = createBankStore();
  const summary = buildBeatrizSummary();
  store.memberSummaries.set(BEATRIZ_ID, {
    ...summary,
    byCategory: summary.byCategory.map((total) => ({
      ...total,
      entries: 0,
      declaredMinutes: 0,
      pendingMinutes: 0,
      bankMinutes: 0,
    })),
  });
  return store;
}

/** The title of the card of the hours by category, which is where the focus goes when a row leaves. */
function categoriesTitle(): HTMLElement {
  return screen.getByText("Horas por categoria do membro");
}

/** The cell Observação of the row of the category, by its label ("Planejamento"). */
function noteCell(table: HTMLElement, label: string): HTMLElement {
  const row = within(table).getByRole("row", { name: new RegExp(`^${label}`) });
  return within(row).getAllByRole("cell")[3];
}

/** Presses the button of the cell and waits for the dialog, named by the category. */
async function openDialog(user: User, table: HTMLElement, button: string, category: string) {
  await user.click(within(table).getByRole("button", { name: button }));
  return screen.findByRole("dialog", { name: `Observação de ${category}` });
}

function noteField(dialog: HTMLElement): HTMLElement {
  return within(dialog).getByRole("textbox", { name: "Observação" });
}

function save(dialog: HTMLElement): HTMLElement {
  return within(dialog).getByRole("button", { name: "Salvar" });
}

function noteBodies(spies: BankSpies): unknown[] {
  return requestsTo(spies, "PUT", `/members/${BEATRIZ_ID}/hours/notes`).map(
    (request) => request.body,
  );
}

function hoursReads(spies: BankSpies): number {
  return requestsTo(spies, "GET", `/members/${BEATRIZ_ID}/hours`).length;
}

async function expectDialogGone() {
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
}

describe("EditCategoryNoteDialog", () => {
  it("lets the coordination add a note to a category and shows it in the table after the re-read", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { table } = await renderMemberView({ spies });
    const reads = hoursReads(spies);
    const dialog = await openDialog(
      user,
      table,
      "Adicionar observação em Planejamento",
      "Planejamento",
    );
    await user.type(noteField(dialog), NOTE);

    await user.click(save(dialog));

    expect(await screen.findByText("Observação salva")).toBeInTheDocument();
    expect(noteBodies(spies)).toEqual([{ category: "planning", note: NOTE }]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(hoursReads(spies)).toBeGreaterThan(reads);
    const cell = noteCell(table, "Planejamento");
    expect(within(cell).getByText(NOTE)).toBeInTheDocument();
    expect(
      within(cell).getByRole("button", { name: "Editar a observação de Planejamento" }),
    ).toBeInTheDocument();
  });

  it("edits an existing note, starting from its text", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const store = withNote(createBankStore(), BEATRIZ_ID, "planning", NOTE);
    const { table } = await renderMemberView({ store, spies });
    expect(within(noteCell(table, "Planejamento")).getByText(NOTE)).toBeInTheDocument();
    const dialog = await openDialog(
      user,
      table,
      "Editar a observação de Planejamento",
      "Planejamento",
    );

    expect(noteField(dialog)).toHaveValue(NOTE);

    await user.clear(noteField(dialog));
    await user.type(noteField(dialog), OTHER_NOTE);
    await user.click(save(dialog));

    expect(await screen.findByText("Observação salva")).toBeInTheDocument();
    expect(noteBodies(spies)).toEqual([{ category: "planning", note: OTHER_NOTE }]);
    await waitFor(() =>
      expect(within(noteCell(table, "Planejamento")).getByText(OTHER_NOTE)).toBeInTheDocument(),
    );
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
  });

  it("clears the note when the field is left blank, sending null, and shows the dash", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const store = withNote(createBankStore(), BEATRIZ_ID, "planning", NOTE);
    const { table } = await renderMemberView({ store, spies });
    const dialog = await openDialog(
      user,
      table,
      "Editar a observação de Planejamento",
      "Planejamento",
    );

    await user.clear(noteField(dialog));
    await user.click(save(dialog));

    expect(await screen.findByText("Observação removida")).toBeInTheDocument();
    expect(noteBodies(spies)).toEqual([{ category: "planning", note: null }]);
    await expectDialogGone();
    await waitFor(() => expect(screen.queryByText(NOTE)).not.toBeInTheDocument());
    const cell = noteCell(table, "Planejamento");
    expect(within(cell).getByText("—")).toHaveAttribute("aria-hidden", "true");
    expect(within(cell).getByText("Sem observação")).toBeInTheDocument();
    expect(
      within(cell).getByRole("button", { name: "Adicionar observação em Planejamento" }),
    ).toBeInTheDocument();
  });

  it("clears the note when the field has only spaces", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const store = withNote(createBankStore(), BEATRIZ_ID, "planning", NOTE);
    const { table } = await renderMemberView({ store, spies });
    const dialog = await openDialog(
      user,
      table,
      "Editar a observação de Planejamento",
      "Planejamento",
    );

    await user.clear(noteField(dialog));
    await user.type(noteField(dialog), "   ");
    await user.click(save(dialog));

    expect(await screen.findByText("Observação removida")).toBeInTheDocument();
    expect(noteBodies(spies)).toEqual([{ category: "planning", note: null }]);
  });

  it("trims the note before sending it", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { table } = await renderMemberView({ spies });
    const dialog = await openDialog(
      user,
      table,
      "Adicionar observação em Planejamento",
      "Planejamento",
    );
    await user.type(noteField(dialog), `   ${NOTE}   `);

    await user.click(save(dialog));

    expect(await screen.findByText("Observação salva")).toBeInTheDocument();
    expect(noteBodies(spies)).toEqual([{ category: "planning", note: NOTE }]);
  });

  it("keeps the line breaks the coordination typed", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { table } = await renderMemberView({ spies });
    const dialog = await openDialog(
      user,
      table,
      "Adicionar observação em Planejamento",
      "Planejamento",
    );
    await user.type(noteField(dialog), "Primeira linha{Enter}Segunda linha");

    await user.click(save(dialog));

    expect(await screen.findByText("Observação salva")).toBeInTheDocument();
    expect(noteBodies(spies)).toEqual([
      { category: "planning", note: "Primeira linha\nSegunda linha" },
    ]);
    const text = await within(noteCell(table, "Planejamento")).findByText(/^Primeira linha/);
    expect(text.textContent).toBe("Primeira linha\nSegunda linha");
    expect(text).toHaveClass("whitespace-pre-line");
  });

  it("writes the note of Aula too: every category takes one", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { table } = await renderMemberView({ spies });
    const dialog = await openDialog(user, table, "Adicionar observação em Aula", "Aula");
    await user.type(noteField(dialog), NOTE);

    await user.click(save(dialog));

    expect(await screen.findByText("Observação salva")).toBeInTheDocument();
    expect(noteBodies(spies)).toEqual([{ category: "lesson", note: NOTE }]);
    expect(within(noteCell(table, "Aula")).getByText(NOTE)).toBeInTheDocument();
  });

  it("accepts exactly 500 characters", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { table } = await renderMemberView({ spies });
    const dialog = await openDialog(
      user,
      table,
      "Adicionar observação em Planejamento",
      "Planejamento",
    );
    await user.click(noteField(dialog));
    await user.paste("a".repeat(500));

    await user.click(save(dialog));

    expect(await screen.findByText("Observação salva")).toBeInTheDocument();
    expect(noteBodies(spies)).toEqual([{ category: "planning", note: "a".repeat(500) }]);
  });

  it("refuses more than 500 characters on the field and sends nothing", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { table } = await renderMemberView({ spies });
    const dialog = await openDialog(
      user,
      table,
      "Adicionar observação em Planejamento",
      "Planejamento",
    );
    await user.click(noteField(dialog));
    await user.paste("a".repeat(501));

    await user.click(save(dialog));

    await waitFor(() =>
      expect(noteField(dialog)).toHaveAccessibleDescription("Use até 500 caracteres."),
    );
    expect(noteField(dialog)).toHaveAttribute("aria-invalid", "true");
    expect(noteBodies(spies)).toEqual([]);
    expect(screen.getByRole("dialog", { name: "Observação de Planejamento" })).toBeInTheDocument();
  });

  it("closes without sending when the note did not change", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const store = withNote(createBankStore(), BEATRIZ_ID, "planning", NOTE);
    const { table } = await renderMemberView({ store, spies });
    const dialog = await openDialog(
      user,
      table,
      "Editar a observação de Planejamento",
      "Planejamento",
    );

    await user.click(save(dialog));

    await expectDialogGone();
    expect(noteBodies(spies)).toEqual([]);
    expect(screen.queryByText("Observação salva")).not.toBeInTheDocument();
    expect(screen.queryByText("Observação removida")).not.toBeInTheDocument();
    expect(within(noteCell(table, "Planejamento")).getByText(NOTE)).toBeInTheDocument();
  });

  it("closes without sending when a category with no note is saved blank", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { table } = await renderMemberView({ spies });
    const dialog = await openDialog(
      user,
      table,
      "Adicionar observação em Planejamento",
      "Planejamento",
    );
    await user.type(noteField(dialog), "   ");

    await user.click(save(dialog));

    await expectDialogGone();
    expect(noteBodies(spies)).toEqual([]);
    expect(screen.queryByText("Observação removida")).not.toBeInTheDocument();
  });

  it("shows the refusal of the API on the field (400 VALIDATION_FAILED on note)", async () => {
    const user = userEvent.setup();
    const { table } = await renderMemberView({
      extraHandlers: [
        http.put("*/members/:id/hours/notes", () =>
          apiError(400, "VALIDATION_FAILED", [{ field: "note", message: "too long" }]),
        ),
      ],
    });
    const dialog = await openDialog(
      user,
      table,
      "Adicionar observação em Planejamento",
      "Planejamento",
    );
    await user.type(noteField(dialog), NOTE);

    await user.click(save(dialog));

    await waitFor(() =>
      expect(noteField(dialog)).toHaveAccessibleDescription(
        "A observação não foi aceita. Revise o texto.",
      ),
    );
    expect(noteField(dialog)).toHaveAttribute("aria-invalid", "true");
    expect(noteField(dialog)).toHaveFocus();
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Observação salva")).not.toBeInTheDocument();
  });

  it("shows a VALIDATION_FAILED of another field as the generic alert", async () => {
    const user = userEvent.setup();
    const { table } = await renderMemberView({
      extraHandlers: [
        http.put("*/members/:id/hours/notes", () =>
          apiError(400, "VALIDATION_FAILED", [{ field: "category", message: "must be valid" }]),
        ),
      ],
    });
    const dialog = await openDialog(
      user,
      table,
      "Adicionar observação em Planejamento",
      "Planejamento",
    );
    await user.type(noteField(dialog), NOTE);

    await user.click(save(dialog));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Não foi possível salvar a observação. Tente de novo.",
    );
    expect(noteField(dialog)).not.toHaveAttribute("aria-invalid", "true");
  });

  it.each([
    {
      refusal: "403 FORBIDDEN",
      status: 403,
      code: "FORBIDDEN",
      text: "Você não tem permissão para editar a observação deste membro.",
    },
    {
      refusal: "403 FORBIDDEN_SCOPE",
      status: 403,
      code: "FORBIDDEN_SCOPE",
      text: "Você não tem permissão para editar a observação deste membro.",
    },
    {
      refusal: "404 MEMBER_NOT_FOUND",
      status: 404,
      code: "MEMBER_NOT_FOUND",
      text: "Este membro não foi encontrado.",
    },
    {
      refusal: "500",
      status: 500,
      code: "INTERNAL_ERROR",
      text: "Não foi possível salvar a observação. Tente de novo.",
    },
  ])(
    "keeps the dialog open with an alert on $refusal, and the focus goes to it",
    async ({ status, code, text }) => {
      const user = userEvent.setup();
      const { table } = await renderMemberView({
        extraHandlers: [http.put("*/members/:id/hours/notes", () => apiError(status, code))],
      });
      const dialog = await openDialog(
        user,
        table,
        "Adicionar observação em Planejamento",
        "Planejamento",
      );
      await user.type(noteField(dialog), NOTE);

      await user.click(save(dialog));

      const alert = await within(dialog).findByRole("alert");
      expect(alert).toHaveTextContent(text);
      expect(
        screen.getByRole("dialog", { name: "Observação de Planejamento" }),
      ).toBeInTheDocument();
      expect(screen.queryByText("Observação salva")).not.toBeInTheDocument();
      await waitFor(() => expect(document.activeElement).toContainElement(alert));
      expect(save(dialog)).not.toHaveAttribute("aria-disabled", "true");
      expect(noteField(dialog)).toHaveValue(NOTE);
    },
  );

  it("lets the person try again after an error, and the alert goes away", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    let calls = 0;
    const { table } = await renderMemberView({
      spies,
      extraHandlers: [
        http.put("*/members/:id/hours/notes", () => {
          calls += 1;
          if (calls === 1) return apiError(500, "INTERNAL_ERROR");
        }),
      ],
    });
    const dialog = await openDialog(
      user,
      table,
      "Adicionar observação em Planejamento",
      "Planejamento",
    );
    await user.type(noteField(dialog), NOTE);
    await user.click(save(dialog));
    await within(dialog).findByRole("alert");

    await user.click(save(dialog));

    expect(await screen.findByText("Observação salva")).toBeInTheDocument();
    expect(calls).toBe(2);
    expect(noteBodies(spies)).toEqual([{ category: "planning", note: NOTE }]);
    await expectDialogGone();
  });

  it("keeps Salvar busy until the hours of the member are read again", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const gate = createDeferred();
    let hold = false;
    let held = 0;
    const { table } = await renderMemberView({
      spies,
      extraHandlers: [
        // Answers nothing, which sends the request on to the handler of the store, once the gate opens.
        http.get("*/members/:id/hours", async () => {
          if (!hold) return;
          held += 1;
          await gate.promise;
        }),
      ],
    });
    const dialog = await openDialog(
      user,
      table,
      "Adicionar observação em Planejamento",
      "Planejamento",
    );
    await user.type(noteField(dialog), NOTE);
    hold = true;

    await user.click(save(dialog));

    await waitFor(() => expect(held).toBe(1));
    expect(noteBodies(spies)).toHaveLength(1);
    await waitFor(() => expect(save(dialog)).toHaveAttribute("aria-disabled", "true"));
    expect(screen.getByRole("dialog", { name: "Observação de Planejamento" })).toBeInTheDocument();
    expect(screen.queryByText("Observação salva")).not.toBeInTheDocument();
    await user.click(save(dialog));
    expect(noteBodies(spies)).toHaveLength(1);

    hold = false;
    gate.resolve();

    expect(await screen.findByText("Observação salva")).toBeInTheDocument();
    await expectDialogGone();
    expect(within(noteCell(table, "Planejamento")).getByText(NOTE)).toBeInTheDocument();
  });

  it("sends one PUT when Salvar is pressed twice in a row", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { table } = await renderMemberView({ spies });
    const dialog = await openDialog(
      user,
      table,
      "Adicionar observação em Planejamento",
      "Planejamento",
    );
    await user.type(noteField(dialog), NOTE);

    pressTwiceAtOnce(save(dialog));

    expect(await screen.findByText("Observação salva")).toBeInTheDocument();
    expect(noteBodies(spies)).toHaveLength(1);
  });

  it("does not offer the edit to the director", async () => {
    const { table } = await renderMemberView({
      user: director(),
      store: withNote(createBankStore("department"), BEATRIZ_ID, "planning", NOTE),
    });

    expect(screen.getByRole("columnheader", { name: "Observação" })).toBeInTheDocument();
    expect(within(noteCell(table, "Planejamento")).getByText(NOTE)).toBeInTheDocument();
    expect(within(table).queryByRole("button")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Adicionar observação|Editar a observação/ }),
    ).not.toBeInTheDocument();
  });

  it("does not offer the edit on the coordinator's own hours", async () => {
    const { table } = await renderMemberView({
      user: buildMeUser({ role: Role.coordinator, id: BEATRIZ_ID, name: "Beatriz Nunes" }),
      store: withNote(createBankStore(), BEATRIZ_ID, "planning", NOTE),
    });

    expect(screen.getByRole("columnheader", { name: "Observação" })).toBeInTheDocument();
    expect(within(noteCell(table, "Planejamento")).getByText(NOTE)).toBeInTheDocument();
    expect(within(table).queryByRole("button")).not.toBeInTheDocument();
  });

  it("names the dialog by the category and the member, and goes back to the button on Cancelar", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { table } = await renderMemberView({ spies });
    const button = within(table).getByRole("button", {
      name: "Adicionar observação em Planejamento",
    });
    const dialog = await openDialog(
      user,
      table,
      "Adicionar observação em Planejamento",
      "Planejamento",
    );

    expect(dialog).toHaveAccessibleName("Observação de Planejamento");
    expect(dialog).toHaveAccessibleDescription("Beatriz Nunes vê esta observação no Meu perfil.");
    expect(noteField(dialog)).toHaveValue("");
    expect(
      within(dialog).getByText("Até 500 caracteres. Deixe em branco para remover."),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Fechar" })).toBeInTheDocument();

    await user.type(noteField(dialog), NOTE);
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await expectDialogGone();
    expect(noteBodies(spies)).toEqual([]);
    await waitFor(() => expect(button).toHaveFocus());
    expect(within(noteCell(table, "Planejamento")).queryByText(NOTE)).not.toBeInTheDocument();
  });

  it("sends the focus to the title when the row of the cleared note leaves the table", async () => {
    const user = userEvent.setup();
    const store = withNote(createBankStore(), BEATRIZ_ID, "meeting", NOTE);
    const { table } = await renderMemberView({ store });
    const dialog = await openDialog(user, table, "Editar a observação de Reunião", "Reunião");

    await user.clear(noteField(dialog));
    await user.click(save(dialog));

    expect(await screen.findByText("Observação removida")).toBeInTheDocument();
    await expectDialogGone();
    await waitFor(() =>
      expect(within(table).queryByRole("row", { name: /^Reunião/ })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(categoriesTitle()).toHaveFocus());
    expect(within(table).getByRole("row", { name: /^Aula/ })).toBeInTheDocument();
  });

  it("sends the focus to the title when the cleared note was the last row and the table is left empty", async () => {
    const user = userEvent.setup();
    const store = withNote(storeWithoutEntries(), BEATRIZ_ID, "meeting", NOTE);
    const { table } = await renderMemberView({ store }, "Reunião");
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    const dialog = await openDialog(user, table, "Editar a observação de Reunião", "Reunião");

    await user.clear(noteField(dialog));
    await user.click(save(dialog));

    expect(await screen.findByText("Observação removida")).toBeInTheDocument();
    await expectDialogGone();
    expect(
      await screen.findByText("Nenhum lançamento deste membro no período"),
    ).toBeInTheDocument();
    expect(within(table).getAllByRole("row")).toHaveLength(1);
    await waitFor(() => expect(categoriesTitle()).toHaveFocus());
  });

  it("gives the focus back to the button when the cleared note leaves its row in the table", async () => {
    const user = userEvent.setup();
    const store = withNote(createBankStore(), BEATRIZ_ID, "planning", NOTE);
    const { table } = await renderMemberView({ store });
    const dialog = await openDialog(
      user,
      table,
      "Editar a observação de Planejamento",
      "Planejamento",
    );

    await user.clear(noteField(dialog));
    await user.click(save(dialog));

    expect(await screen.findByText("Observação removida")).toBeInTheDocument();
    await expectDialogGone();
    await waitFor(() =>
      expect(
        within(noteCell(table, "Planejamento")).getByRole("button", {
          name: "Adicionar observação em Planejamento",
        }),
      ).toHaveFocus(),
    );
    expect(categoriesTitle()).not.toHaveFocus();
  });

  it.each([
    {
      how: "Cancelar",
      close: async (user: User, dialog: HTMLElement) => {
        await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
      },
    },
    {
      how: "Escape",
      close: async (user: User) => {
        await user.keyboard("{Escape}");
      },
    },
    {
      how: "Salvar with the text unchanged",
      close: async (user: User, dialog: HTMLElement) => {
        await user.click(save(dialog));
      },
    },
    {
      how: "Salvar with another text",
      close: async (user: User, dialog: HTMLElement) => {
        await user.clear(noteField(dialog));
        await user.type(noteField(dialog), OTHER_NOTE);
        await user.click(save(dialog));
        await screen.findByText("Observação salva");
      },
    },
  ])(
    "gives the focus back to the button of a category with no entries when the dialog closes by $how",
    async ({ close }) => {
      const user = userEvent.setup();
      const store = withNote(createBankStore(), BEATRIZ_ID, "meeting", NOTE);
      const { table } = await renderMemberView({ store });
      const dialog = await openDialog(user, table, "Editar a observação de Reunião", "Reunião");

      await close(user, dialog);

      await expectDialogGone();
      await waitFor(() =>
        expect(
          within(noteCell(table, "Reunião")).getByRole("button", {
            name: "Editar a observação de Reunião",
          }),
        ).toHaveFocus(),
      );
      expect(categoriesTitle()).not.toHaveFocus();
    },
  );

  it("names the dialog by the category of the row it was opened from", async () => {
    const user = userEvent.setup();
    const { table } = await renderMemberView();

    const dialog = await openDialog(user, table, "Adicionar observação em Evento", "Evento");

    expect(dialog).toHaveAccessibleName("Observação de Evento");
  });

  it("Escape and Fechar close without sending", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { table } = await renderMemberView({ spies });
    const dialog = await openDialog(
      user,
      table,
      "Adicionar observação em Planejamento",
      "Planejamento",
    );
    await user.type(noteField(dialog), NOTE);

    await user.keyboard("{Escape}");

    await expectDialogGone();
    const reopened = await openDialog(
      user,
      table,
      "Adicionar observação em Planejamento",
      "Planejamento",
    );
    expect(noteField(reopened)).toHaveValue("");

    await user.click(within(reopened).getByRole("button", { name: "Fechar" }));

    await expectDialogGone();
    expect(noteBodies(spies)).toEqual([]);
  });
});
