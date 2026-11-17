import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { describe, expect, it } from "vitest";

import { ENTRY_1203_ID } from "./bank-fixtures";
import {
  apiError,
  createBankSpies,
  queueRequests,
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

const REASON = "Sem comprovação da feira. Lance de novo com o link da lista de presença.";

type User = ReturnType<typeof userEvent.setup>;

async function renderAndOpen(user: User, options: BankRenderOptions = {}) {
  const view = await renderBankRoutes({ route: "/hours?period=2026-03", ...options });
  const queue = await screen.findByRole("table", {
    name: /^Lançamentos pendentes de validação, com/,
  });
  await within(queue).findByText("12/03");

  await user.click(
    within(queue).getByRole("button", { name: "Rejeitar lançamento de Rafael Souza em 12/03" }),
  );

  const dialog = await screen.findByRole("dialog", { name: "Rejeitar lançamento" });
  return { ...view, queue, dialog };
}

function rejectBodies(spies: BankSpies): unknown[] {
  return requestsTo(spies, "PATCH", `/hour-entries/${ENTRY_1203_ID}/reject`).map(
    (request) => request.body,
  );
}

function reasonField(dialog: HTMLElement): HTMLElement {
  return within(dialog).getByRole("textbox", { name: /Motivo da rejeição/ });
}

describe("RejectEntryDialog", () => {
  it("shows the summary and the warning that the hours do not enter the bank", async () => {
    const user = userEvent.setup();
    const { dialog } = await renderAndOpen(user);

    expect(within(dialog).getByText("Rafael Souza · Evento · 12/03")).toBeInTheDocument();
    expect(within(dialog).getByText("Feira de tecnologia (evento externo)")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Lançado pelo próprio membro em 12/03 · pendente de validação"),
    ).toBeInTheDocument();
    expect(reasonField(dialog)).toBeRequired();
    expect(
      within(dialog).getByText("Obrigatório. O membro vê este texto no extrato."),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "As 4h não entram no banco de horas. O lançamento fica no histórico como Rejeitado.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the error on Motivo da rejeição and sends nothing when rejecting without a reason", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { dialog } = await renderAndOpen(user, { spies });
    await user.type(reasonField(dialog), "   ");

    await user.click(within(dialog).getByRole("button", { name: "Rejeitar lançamento" }));

    await waitFor(() => expect(reasonField(dialog)).toHaveAttribute("aria-invalid", "true"));
    expect(within(dialog).getByText("Escreva o motivo da rejeição.")).toBeInTheDocument();
    expect(reasonField(dialog)).toHaveAccessibleDescription("Escreva o motivo da rejeição.");
    expect(rejectBodies(spies)).toEqual([]);
  });

  it("says the limit of the contract when the reason is too long", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { dialog } = await renderAndOpen(user, { spies });
    await user.click(reasonField(dialog));
    await user.paste("a".repeat(501));

    await user.click(within(dialog).getByRole("button", { name: "Rejeitar lançamento" }));

    await waitFor(() =>
      expect(reasonField(dialog)).toHaveAccessibleDescription("Use até 500 caracteres."),
    );
    expect(rejectBodies(spies)).toEqual([]);
  });

  it("rejects, closes, removes the row and shows the neutral toast", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { dialog, queue } = await renderAndOpen(user, { spies });
    await user.type(reasonField(dialog), REASON);

    await user.click(within(dialog).getByRole("button", { name: "Rejeitar lançamento" }));

    expect(await screen.findByText("Lançamento rejeitado")).toBeInTheDocument();
    expect(
      screen.getByText("Rafael Souza vê o motivo no extrato e pode lançar de novo."),
    ).toBeInTheDocument();
    expect(rejectBodies(spies)).toEqual([{ reason: REASON }]);
    expect(screen.queryByRole("dialog", { name: "Rejeitar lançamento" })).not.toBeInTheDocument();
    expect(within(queue).queryByText("12/03")).not.toBeInTheDocument();
    expect(screen.getByText("Lançamentos pendentes de validação (2)")).toHaveFocus();
    const totals = screen.getByRole("list", { name: "Totais do período" });
    await waitFor(() =>
      expect(
        within(totals)
          .getAllByRole("listitem")
          .map((item) => item.textContent),
      ).toEqual([
        "Total de horas lançadas312h",
        "Horas validadas276h",
        "Pendentes de validação8h",
        "Ajustadas / rejeitadas28h",
      ]),
    );
  });

  it("keeps Rejeitar lançamento busy and the dialog open until the queue answers again", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { dialog } = await renderAndOpen(user, { spies });
    await user.type(reasonField(dialog), REASON);
    const gate = createDeferred();
    spies.queueGate = gate.promise;
    const reject = within(dialog).getByRole("button", { name: "Rejeitar lançamento" });

    await user.click(reject);

    await waitFor(() => expect(rejectBodies(spies)).toHaveLength(1));
    await waitFor(() => expect(reject).toHaveAttribute("aria-disabled", "true"));
    expect(screen.getByRole("dialog", { name: "Rejeitar lançamento" })).toBeInTheDocument();
    await user.click(reject);
    expect(rejectBodies(spies)).toHaveLength(1);

    spies.queueGate = null;
    gate.resolve();

    expect(await screen.findByText("Lançamento rejeitado")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Rejeitar lançamento" })).not.toBeInTheDocument();
  });

  it("shows a VALIDATION_FAILED of the reason on its field", async () => {
    const user = userEvent.setup();
    const { dialog } = await renderAndOpen(user, {
      extraHandlers: [
        http.patch("*/hour-entries/:id/reject", () =>
          apiError(400, "VALIDATION_FAILED", [{ field: "reason", message: "must not be blank" }]),
        ),
      ],
    });
    await user.type(reasonField(dialog), REASON);

    await user.click(within(dialog).getByRole("button", { name: "Rejeitar lançamento" }));

    await waitFor(() =>
      expect(reasonField(dialog)).toHaveAccessibleDescription("Escreva o motivo da rejeição."),
    );
    expect(reasonField(dialog)).toHaveFocus();
  });

  it("closes and refreshes the queue when the entry is no longer pending", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { dialog, queue } = await renderAndOpen(user, {
      spies,
      extraHandlers: [
        http.patch("*/hour-entries/:id/reject", () => apiError(404, "HOUR_ENTRY_NOT_FOUND")),
      ],
    });
    await user.type(reasonField(dialog), REASON);
    const reads = queueRequests(spies).length;

    await user.click(within(dialog).getByRole("button", { name: "Rejeitar lançamento" }));

    expect(await screen.findByText("Este lançamento já não está pendente.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Rejeitar lançamento" })).not.toBeInTheDocument();
    expect(queueRequests(spies).length).toBeGreaterThan(reads);
    expect(within(queue).getByText("12/03")).toBeInTheDocument();
  });

  it("keeps the dialog open with the alert of the person's own entry on a 409 SELF_REVIEW_NOT_ALLOWED", async () => {
    const user = userEvent.setup();
    const { dialog } = await renderAndOpen(user, {
      extraHandlers: [
        http.patch("*/hour-entries/:id/reject", () => apiError(409, "SELF_REVIEW_NOT_ALLOWED")),
      ],
    });
    await user.type(reasonField(dialog), REASON);

    await user.click(within(dialog).getByRole("button", { name: "Rejeitar lançamento" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("Você não pode revisar o próprio lançamento.");
    expect(screen.getByRole("dialog", { name: "Rejeitar lançamento" })).toBeInTheDocument();
    expect(screen.queryByText("Lançamento rejeitado")).not.toBeInTheDocument();
  });

  it("Voltar and Escape close without sending", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { dialog, queue } = await renderAndOpen(user, { spies });
    await user.type(reasonField(dialog), REASON);

    await user.click(within(dialog).getByRole("button", { name: "Voltar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Rejeitar lançamento" })).not.toBeInTheDocument(),
    );
    await user.click(
      within(queue).getByRole("button", { name: "Rejeitar lançamento de Rafael Souza em 12/03" }),
    );
    await screen.findByRole("dialog", { name: "Rejeitar lançamento" });
    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Rejeitar lançamento" })).not.toBeInTheDocument(),
    );
    expect(rejectBodies(spies)).toEqual([]);
    expect(within(queue).getByText("12/03")).toBeInTheDocument();
  });

  it("sends one PATCH when Rejeitar lançamento is pressed twice in a row", async () => {
    const user = userEvent.setup();
    const spies = createBankSpies();
    const { dialog } = await renderAndOpen(user, { spies });
    await user.type(reasonField(dialog), REASON);

    pressTwiceAtOnce(within(dialog).getByRole("button", { name: "Rejeitar lançamento" }));

    expect(await screen.findByText("Lançamento rejeitado")).toBeInTheDocument();
    expect(rejectBodies(spies)).toHaveLength(1);
  });

  it("keeps the dialog open with an alert when rejecting fails", async () => {
    const user = userEvent.setup();
    const { dialog } = await renderAndOpen(user, {
      extraHandlers: [http.patch("*/hour-entries/:id/reject", () => apiError(500, "INTERNAL"))],
    });
    await user.type(reasonField(dialog), REASON);

    await user.click(within(dialog).getByRole("button", { name: "Rejeitar lançamento" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível rejeitar o lançamento. Tente de novo.");
    expect(screen.getByRole("dialog", { name: "Rejeitar lançamento" })).toBeInTheDocument();
  });
});
