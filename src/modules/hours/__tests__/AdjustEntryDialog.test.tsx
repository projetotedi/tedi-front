import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { buildEntry, ENTRY_1403_ID } from "./bank-fixtures";
import {
  apiError,
  createBankSpies,
  createBankStore,
  requestsTo,
  type BankSpies,
} from "./bank-handlers";
import {
  createDeferred,
  renderBankRoutes,
  setupBankTestServer,
  type BankRenderOptions,
} from "./bank-test-utils";

setupBankTestServer();

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

const JUSTIFICATION = "Feito em dupla com o Rafael: cada um registra 2h.";

type User = ReturnType<typeof userEvent.setup>;

async function renderAndOpen(user: User, options: BankRenderOptions = {}) {
  const view = await renderBankRoutes({ route: "/hours?period=2026-03", ...options });
  const queue = await screen.findByRole("table", {
    name: /^Lançamentos pendentes de validação, com/,
  });
  await within(queue).findByText("14/03");

  await user.click(
    within(queue).getByRole("button", { name: "Ajustar lançamento de Beatriz Nunes em 14/03" }),
  );

  const dialog = await screen.findByRole("dialog", { name: "Ajustar lançamento" });
  return { ...view, queue, dialog };
}

function adjustBodies(spies: BankSpies): unknown[] {
  return requestsTo(spies, "PATCH", `/hour-entries/${ENTRY_1403_ID}/adjust`).map(
    (request) => request.body,
  );
}

async function fill(user: User, dialog: HTMLElement, newValue: string, justification: string) {
  if (newValue !== "") {
    await user.type(
      within(dialog).getByRole("textbox", { name: /Novo valor \(horas\)/ }),
      newValue,
    );
  }
  if (justification !== "") {
    await user.type(within(dialog).getByRole("textbox", { name: /Justificativa/ }), justification);
  }
}

describe("AdjustEntryDialog", () => {
  it("shows the summary, the declared value turned off and the required fields", async () => {
    const user = userEvent.setup();
    const { dialog } = await renderAndOpen(user);

    expect(within(dialog).getByText("Beatriz Nunes · Planejamento · 14/03")).toBeInTheDocument();
    expect(within(dialog).getByText("Planejamento de conteúdo do bimestre")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Lançado pelo próprio membro em 14/03 · pendente de validação"),
    ).toBeInTheDocument();
    const declared = within(dialog).getByRole("textbox", { name: "Valor declarado" });
    expect(declared).toBeDisabled();
    expect(declared).toHaveValue("4h");
    expect(within(dialog).getByRole("textbox", { name: /Novo valor \(horas\)/ })).toBeRequired();
    expect(within(dialog).getByRole("textbox", { name: /Justificativa/ })).toBeRequired();
    expect(
      within(dialog).getByText("Obrigatória. O membro vê este texto no extrato."),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("O valor declarado (4h) continua registrado ao lado do ajuste."),
    ).toBeInTheDocument();
  });

  it("shows the error on Justificativa and sends nothing when saving without a justification", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { dialog } = await renderAndOpen(user, { spies });
    await fill(user, dialog, "2h", "");

    await user.click(within(dialog).getByRole("button", { name: "Salvar ajuste" }));

    const justification = within(dialog).getByRole("textbox", { name: /Justificativa/ });
    await waitFor(() => expect(justification).toHaveAttribute("aria-invalid", "true"));
    expect(within(dialog).getByText("Escreva a justificativa.")).toBeInTheDocument();
    expect(justification).toHaveAccessibleDescription("Escreva a justificativa.");
    expect(adjustBodies(spies)).toEqual([]);
  });

  it.each([
    ["", "Informe o novo valor."],
    ["2:30", "Use o formato 2h ou 2h30."],
    ["25h", "Informe um valor entre 0h01 e 24h."],
    ["4h", "O novo valor precisa ser diferente do declarado."],
  ])("shows the error of Novo valor %j on the field and sends nothing", async (value, message) => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { dialog } = await renderAndOpen(user, { spies });
    await fill(user, dialog, value, JUSTIFICATION);

    await user.click(within(dialog).getByRole("button", { name: "Salvar ajuste" }));

    const newValue = within(dialog).getByRole("textbox", { name: /Novo valor \(horas\)/ });
    await waitFor(() => expect(newValue).toHaveAttribute("aria-invalid", "true"));
    expect(newValue).toHaveAccessibleDescription(message);
    expect(adjustBodies(spies)).toEqual([]);
  });

  it("says the limit of the contract when the justification is too long", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { dialog } = await renderAndOpen(user, { spies });
    await fill(user, dialog, "2h", "");
    const justification = within(dialog).getByRole("textbox", { name: /Justificativa/ });
    await user.click(justification);
    await user.paste("a".repeat(501));

    await user.click(within(dialog).getByRole("button", { name: "Salvar ajuste" }));

    await waitFor(() =>
      expect(justification).toHaveAccessibleDescription("Use até 500 caracteres."),
    );
    expect(adjustBodies(spies)).toEqual([]);
  });

  it("says the new validated hours in the notice while the value is typed", async () => {
    const user = userEvent.setup();
    const { dialog } = await renderAndOpen(user);
    const newValue = within(dialog).getByRole("textbox", { name: /Novo valor \(horas\)/ });

    await user.type(newValue, "2h");

    expect(
      within(dialog).getByText(
        "O valor declarado (4h) continua registrado ao lado do ajuste. As horas validadas passam a ser 2h.",
      ),
    ).toBeInTheDocument();

    await user.type(newValue, "99");

    expect(
      within(dialog).getByText("O valor declarado (4h) continua registrado ao lado do ajuste."),
    ).toBeInTheDocument();
  });

  it("shows the error on Novo valor when the API says it did not change", async () => {
    const user = userEvent.setup();
    const { dialog } = await renderAndOpen(user, {
      extraHandlers: [
        http.patch("*/hour-entries/:id/adjust", () => apiError(400, "ADJUSTED_MINUTES_UNCHANGED")),
      ],
    });
    await fill(user, dialog, "2h", JUSTIFICATION);

    await user.click(within(dialog).getByRole("button", { name: "Salvar ajuste" }));

    const newValue = within(dialog).getByRole("textbox", { name: /Novo valor \(horas\)/ });
    await waitFor(() =>
      expect(newValue).toHaveAccessibleDescription(
        "O novo valor precisa ser diferente do declarado.",
      ),
    );
    expect(newValue).toHaveFocus();
    expect(screen.getByRole("dialog", { name: "Ajustar lançamento" })).toBeInTheDocument();
  });

  it("saves the adjustment, closes, refreshes the queue and the totals and shows the toast with Ver histórico", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { dialog, queue } = await renderAndOpen(user, { spies });
    await fill(user, dialog, "2h", JUSTIFICATION);

    await user.click(within(dialog).getByRole("button", { name: "Salvar ajuste" }));

    expect(await screen.findByText("Lançamento ajustado")).toBeInTheDocument();
    expect(screen.getByText("Beatriz Nunes: 4h declaradas, 2h validadas.")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Notificações" })).getByRole("button", {
        name: "Ver histórico",
      }),
    ).toBeInTheDocument();
    expect(adjustBodies(spies)).toEqual([{ validatedMinutes: 120, justification: JUSTIFICATION }]);
    expect(screen.queryByRole("dialog", { name: "Ajustar lançamento" })).not.toBeInTheDocument();
    expect(within(queue).queryByText("14/03")).not.toBeInTheDocument();
    expect(screen.getByText("Lançamentos pendentes de validação (2)")).toHaveFocus();
    const totals = screen.getByRole("list", { name: "Totais do período" });
    await waitFor(() =>
      expect(
        within(totals)
          .getAllByRole("listitem")
          .map((item) => item.textContent),
      ).toEqual([
        "Total de horas lançadas312h",
        "Horas validadas278h",
        "Pendentes de validação8h",
        "Ajustadas / rejeitadas26h",
      ]),
    );
  });

  it("keeps Salvar ajuste busy and the dialog open until the queue answers again", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { dialog } = await renderAndOpen(user, { spies });
    await fill(user, dialog, "2h", JUSTIFICATION);
    const gate = createDeferred();
    spies.queueGate = gate.promise;
    const save = within(dialog).getByRole("button", { name: "Salvar ajuste" });

    await user.click(save);

    await waitFor(() => expect(adjustBodies(spies)).toHaveLength(1));
    await waitFor(() => expect(save).toHaveAttribute("aria-disabled", "true"));
    expect(screen.getByRole("dialog", { name: "Ajustar lançamento" })).toBeInTheDocument();
    await user.click(save);
    expect(adjustBodies(spies)).toHaveLength(1);

    spies.queueGate = null;
    gate.resolve();

    expect(await screen.findByText("Lançamento ajustado")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Ajustar lançamento" })).not.toBeInTheDocument();
    expect(adjustBodies(spies)).toHaveLength(1);
  });

  it("closes the history opened from Ver histórico with the focus on the title of the queue", async () => {
    const user = userEvent.setup();
    const { dialog } = await renderAndOpen(user);
    await fill(user, dialog, "2h", JUSTIFICATION);
    await user.click(within(dialog).getByRole("button", { name: "Salvar ajuste" }));
    const region = screen.getByRole("region", { name: "Notificações" });
    await user.click(await within(region).findByRole("button", { name: "Ver histórico" }));
    const history = await screen.findByRole("dialog", { name: "Histórico do lançamento" });
    const buttons = within(history).getAllByRole("button", { name: "Fechar" });

    await user.click(buttons[buttons.length - 1]);

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Histórico do lançamento" }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByText("Lançamentos pendentes de validação (2)")).toHaveFocus(),
    );
  });

  it("says in the toast the hours that were sent, whatever the answer carries", async () => {
    const user = userEvent.setup();
    const answer = buildEntry({
      id: ENTRY_1403_ID,
      date: "2026-03-14",
      status: "adjusted",
      validatedMinutes: null,
    });
    const { dialog } = await renderAndOpen(user, {
      extraHandlers: [http.patch("*/hour-entries/:id/adjust", () => HttpResponse.json(answer))],
    });
    await fill(user, dialog, "2h", JUSTIFICATION);

    await user.click(within(dialog).getByRole("button", { name: "Salvar ajuste" }));

    expect(
      await screen.findByText("Beatriz Nunes: 4h declaradas, 2h validadas."),
    ).toBeInTheDocument();
  });

  it("opens the history from Ver histórico of the toast", async () => {
    const user = userEvent.setup();
    const { dialog } = await renderAndOpen(user);
    await fill(user, dialog, "2h", JUSTIFICATION);
    await user.click(within(dialog).getByRole("button", { name: "Salvar ajuste" }));
    const region = screen.getByRole("region", { name: "Notificações" });

    await user.click(await within(region).findByRole("button", { name: "Ver histórico" }));

    const history = await screen.findByRole("dialog", { name: "Histórico do lançamento" });
    expect(
      within(history).getByText("Situação atual: Ajustado · declarado 4h · validado 2h"),
    ).toBeInTheDocument();
    expect(
      await within(history).findByText("Ana Paula Torres ajustou de 4h para 2h"),
    ).toBeInTheDocument();
    expect(within(history).getByText(`Justificativa: “${JUSTIFICATION}”`)).toBeInTheDocument();
    expect(screen.queryByText("Lançamento ajustado")).not.toBeInTheDocument();
  });

  it("closes and refreshes the queue when the entry is no longer pending", async () => {
    const user = userEvent.setup();
    const store = createBankStore();
    const { dialog, queue } = await renderAndOpen(user, { store });
    await fill(user, dialog, "2h", JUSTIFICATION);
    // Somebody else reviewed it in the meantime.
    store.entries = store.entries.map((entry) =>
      entry.id === ENTRY_1403_ID ? { ...entry, status: "approved", validatedMinutes: 240 } : entry,
    );

    await user.click(within(dialog).getByRole("button", { name: "Salvar ajuste" }));

    expect(await screen.findByText("Este lançamento já não está pendente.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Ajustar lançamento" })).not.toBeInTheDocument();
    await waitFor(() => expect(within(queue).queryByText("14/03")).not.toBeInTheDocument());
  });

  it("shows a VALIDATION_FAILED of the API on the fields it points at", async () => {
    const user = userEvent.setup();
    const { dialog } = await renderAndOpen(user, {
      extraHandlers: [
        http.patch("*/hour-entries/:id/adjust", () =>
          apiError(400, "VALIDATION_FAILED", [
            { field: "justification", message: "must not be blank" },
            { field: "validatedMinutes", message: "must be at most 1440" },
          ]),
        ),
      ],
    });
    await fill(user, dialog, "2h", JUSTIFICATION);

    await user.click(within(dialog).getByRole("button", { name: "Salvar ajuste" }));

    const newValue = within(dialog).getByRole("textbox", { name: /Novo valor \(horas\)/ });
    await waitFor(() =>
      expect(newValue).toHaveAccessibleDescription("Informe um valor entre 0h01 e 24h."),
    );
    expect(
      within(dialog).getByRole("textbox", { name: /Justificativa/ }),
    ).toHaveAccessibleDescription("Escreva a justificativa.");
    expect(newValue).toHaveFocus();
  });

  it.each([
    ["a VALIDATION_FAILED with no field of the form", apiError(400, "VALIDATION_FAILED", [])],
    ["the person's own entry", apiError(409, "SELF_REVIEW_NOT_ALLOWED")],
  ])("shows an alert for %s", async (_case, response) => {
    const user = userEvent.setup();
    const { dialog } = await renderAndOpen(user, {
      extraHandlers: [http.patch("*/hour-entries/:id/adjust", () => response.clone())],
    });
    await fill(user, dialog, "2h", JUSTIFICATION);

    await user.click(within(dialog).getByRole("button", { name: "Salvar ajuste" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent(
      response.status === 409
        ? "Você não pode revisar o próprio lançamento."
        : "Não foi possível salvar o ajuste. Tente de novo.",
    );
  });

  it("keeps the dialog open with an alert when saving fails", async () => {
    const user = userEvent.setup();
    const { dialog } = await renderAndOpen(user, {
      extraHandlers: [http.patch("*/hour-entries/:id/adjust", () => apiError(500, "INTERNAL"))],
    });
    await fill(user, dialog, "2h", JUSTIFICATION);

    await user.click(within(dialog).getByRole("button", { name: "Salvar ajuste" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível salvar o ajuste. Tente de novo.");
    expect(screen.getByRole("dialog", { name: "Ajustar lançamento" })).toBeInTheDocument();
  });

  it("Escape and the × close without sending", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { dialog, queue } = await renderAndOpen(user, { spies });
    await fill(user, dialog, "2h", JUSTIFICATION);

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Ajustar lançamento" })).not.toBeInTheDocument(),
    );
    await user.click(
      within(queue).getByRole("button", { name: "Ajustar lançamento de Beatriz Nunes em 14/03" }),
    );
    const again = await screen.findByRole("dialog", { name: "Ajustar lançamento" });
    await user.click(within(again).getByRole("button", { name: "Fechar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Ajustar lançamento" })).not.toBeInTheDocument(),
    );
    expect(adjustBodies(spies)).toEqual([]);
  });

  it("sends one PATCH when Salvar ajuste is pressed twice in a row", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { dialog } = await renderAndOpen(user, { spies });
    await fill(user, dialog, "2h", JUSTIFICATION);

    pressTwiceAtOnce(within(dialog).getByRole("button", { name: "Salvar ajuste" }));

    expect(await screen.findByText("Lançamento ajustado")).toBeInTheDocument();
    expect(adjustBodies(spies)).toHaveLength(1);
  });

  it("Voltar closes without sending", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { dialog, queue } = await renderAndOpen(user, { spies });
    await fill(user, dialog, "2h", JUSTIFICATION);

    await user.click(within(dialog).getByRole("button", { name: "Voltar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Ajustar lançamento" })).not.toBeInTheDocument(),
    );
    expect(adjustBodies(spies)).toEqual([]);
    expect(within(queue).getByText("14/03")).toBeInTheDocument();
  });
});
