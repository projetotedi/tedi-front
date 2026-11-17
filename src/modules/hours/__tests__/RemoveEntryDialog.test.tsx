import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  getGetMemberHoursQueryKey,
  getGetMyHoursSummaryQueryKey,
  getListMyHourEntriesQueryKey,
} from "@api/generated/hours/hours";

import { MyEntriesCard } from "../components/MyEntriesCard";
import { MyHoursSummary } from "../components/MyHoursSummary";
import { RemoveEntryDialog } from "../components/RemoveEntryDialog";
import {
  createDeferred,
  renderWithProviders,
  server,
  setupHoursEntriesTestServer,
} from "./entries-test-utils";
import {
  ANA_ID,
  entryId,
  myHourEntriesHandler,
  myHoursSummaryHandler,
  removeMyHourEntryHandler,
  statementEntry,
  type RemoveCall,
} from "./entries-handlers";

setupHoursEntriesTestServer();

const ENTRY = statementEntry(4);
const WARNING =
  "Lançamento enviado não pode ser editado. Para corrigir, remova e lance de novo com os dados certos. Só dá para remover enquanto estiver pendente de validação.";

const dialog = () => screen.getByRole("dialog", { name: "Remover lançamento" });
const submitButton = () =>
  within(dialog()).getByRole("button", { name: /^(Remover lançamento|Removendo…)$/ });
const backButton = () => within(dialog()).getByRole("button", { name: "Voltar" });

/** The box of the warning or the alert of the API, which takes the focus. */
function issueBox(text: string): HTMLElement {
  const box = within(dialog()).getByText(text).closest<HTMLElement>("[tabindex='-1']");
  if (box === null) throw new Error(`"${text}" is not in a focusable box`);
  return box;
}

async function renderRemove() {
  const onClose = vi.fn();
  const onRemoved = vi.fn();
  const onStale = vi.fn();
  const view = await renderWithProviders(
    <RemoveEntryDialog entry={ENTRY} onClose={onClose} onRemoved={onRemoved} onStale={onStale} />,
  );
  await screen.findByRole("dialog", { name: "Remover lançamento" });
  return { ...view, onClose, onRemoved, onStale };
}

describe("RemoveEntryDialog", () => {
  it("summarises the entry and warns that a sent entry cannot be edited", async () => {
    await renderRemove();

    expect(within(dialog()).getByText("08/03 · Evento · 4h declaradas")).toBeInTheDocument();
    expect(within(dialog()).getByText("Feira de tecnologia (evento externo)")).toBeInTheDocument();
    expect(within(dialog()).getByText("Pendente de validação")).toBeInTheDocument();
    expect(within(dialog()).getByText(WARNING)).toBeInTheDocument();
    expect(dialog()).toHaveAccessibleDescription(
      `08/03 · Evento · 4h declaradas Feira de tecnologia (evento externo) Pendente de validação ${WARNING}`,
    );
  });

  it("opens with the focus on Voltar", async () => {
    await renderRemove();

    await waitFor(() => expect(backButton()).toHaveFocus());
  });

  it("sends DELETE /me/hour-entries/:id, shows the toast and closes", async () => {
    const onCall = vi.fn<(call: RemoveCall) => void>();
    server.use(removeMyHourEntryHandler({ onCall }));
    const user = userEvent.setup();
    const { onClose, onRemoved } = await renderRemove();

    await user.click(submitButton());

    expect(await screen.findByText("Lançamento removido")).toBeInTheDocument();
    expect(
      screen.getByText("Feira de tecnologia (evento externo) (08/03) saiu do seu extrato."),
    ).toBeInTheDocument();
    expect(onCall).toHaveBeenCalledExactlyOnceWith({ id: entryId(4) });
    expect(onRemoved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onRemoved.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0]);
  });

  it("closes at once and reads my summary and my entries again in the background", async () => {
    const reread = createDeferred();
    server.use(removeMyHourEntryHandler(), myHourEntriesHandler());
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { queryClient } = await renderWithProviders(
      <>
        <MyEntriesCard />
        <RemoveEntryDialog
          entry={ENTRY}
          onClose={onClose}
          onRemoved={() => {}}
          onStale={() => {}}
        />
      </>,
    );
    // The card is behind the dialog, so it is out of the accessibility tree.
    await screen.findByRole("table", { name: "Meus lançamentos", hidden: true });
    queryClient.setQueryData(getGetMyHoursSummaryQueryKey(), { cached: true });
    queryClient.setQueryData(getGetMemberHoursQueryKey(ANA_ID, { page: 1 }), { cached: true });
    // The second read of the entries (after the removal) waits until the test lets it go.
    server.use(myHourEntriesHandler({ delay: reread.promise }));

    await user.click(submitButton());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(queryClient.getQueryState(getListMyHourEntriesQueryKey({ limit: 5 }))?.fetchStatus).toBe(
      "fetching",
    );
    expect(queryClient.getQueryState(getGetMyHoursSummaryQueryKey())?.isInvalidated).toBe(true);
    // My hours as a member: the screens of the bank of hours read them too.
    expect(
      queryClient.getQueryState(getGetMemberHoursQueryKey(ANA_ID, { page: 1 }))?.isInvalidated,
    ).toBe(true);

    reread.resolve();
    await waitFor(() =>
      expect(
        queryClient.getQueryState(getListMyHourEntriesQueryKey({ limit: 5 }))?.fetchStatus,
      ).toBe("idle"),
    );
  });

  it("closes and says the entry was removed even when reading the summary again fails", async () => {
    server.use(removeMyHourEntryHandler(), myHoursSummaryHandler());
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onRemoved = vi.fn();
    await renderWithProviders(
      <>
        <MyHoursSummary />
        <RemoveEntryDialog
          entry={ENTRY}
          onClose={onClose}
          onRemoved={onRemoved}
          onStale={() => {}}
        />
      </>,
    );
    await screen.findByText("58h");
    // From now on the summary never answers: the removal is done in the API all the same.
    server.use(myHoursSummaryHandler({ delay: new Promise<void>(() => {}) }));

    await user.click(submitButton());

    expect(await screen.findByText("Lançamento removido")).toBeInTheDocument();
    expect(onRemoved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("while removing, says Removendo…, ignores a second press and keeps Voltar, X and Esc off", async () => {
    const response = createDeferred();
    const onCall = vi.fn<(call: RemoveCall) => void>();
    server.use(removeMyHourEntryHandler({ delay: response.promise, onCall }));
    const user = userEvent.setup();
    const { onClose } = await renderRemove();

    await user.click(submitButton());
    await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));

    expect(submitButton()).toHaveTextContent("Removendo…");
    expect(backButton()).toBeDisabled();
    expect(within(dialog()).getByRole("button", { name: "Fechar" })).toBeDisabled();
    await user.keyboard("{Escape}");
    await user.click(backButton());
    await user.click(submitButton());
    expect(onClose).not.toHaveBeenCalled();
    expect(onCall).toHaveBeenCalledTimes(1);

    response.resolve();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onCall).toHaveBeenCalledTimes(1);
  });

  it("sends one DELETE when Remover lançamento is pressed twice in a row", async () => {
    const response = createDeferred();
    const onCall = vi.fn<(call: RemoveCall) => void>();
    server.use(removeMyHourEntryHandler({ delay: response.promise, onCall }));
    const { onClose } = await renderRemove();

    // Two presses in the same tick, before the dialog draws the request on its way.
    fireEvent.click(submitButton());
    fireEvent.click(submitButton());

    await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
    response.resolve();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onCall).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Este lançamento não existe mais.")).not.toBeInTheDocument();
  });

  it.each([
    {
      code: "ENTRY_NOT_PENDING",
      text: "A coordenação já validou este lançamento. Ele não pode mais ser removido.",
    },
    {
      code: "ATTENDANCE_ENTRY_NOT_REMOVABLE",
      text: "Horas de aula vêm da presença e não podem ser removidas aqui.",
    },
  ])(
    "shows $code as a warning with the focus, turns Remover lançamento off and reads the lists again",
    async ({ code, text }) => {
      server.use(removeMyHourEntryHandler({ error: { statusCode: 409, error: code } }));
      const user = userEvent.setup();
      const { onClose, onStale, queryClient } = await renderRemove();
      queryClient.setQueryData(getListMyHourEntriesQueryKey({ limit: 5 }), { cached: true });
      queryClient.setQueryData(getGetMyHoursSummaryQueryKey(), { cached: true });

      await user.click(submitButton());

      expect(await within(dialog()).findByText(text)).toBeInTheDocument();
      // A warning is not an alert: it is read because it takes the focus.
      expect(within(dialog()).queryByRole("alert")).not.toBeInTheDocument();
      await waitFor(() => expect(issueBox(text)).toHaveFocus());
      expect(submitButton()).toBeDisabled();
      expect(
        queryClient.getQueryState(getListMyHourEntriesQueryKey({ limit: 5 }))?.isInvalidated,
      ).toBe(true);
      expect(queryClient.getQueryState(getGetMyHoursSummaryQueryKey())?.isInvalidated).toBe(true);
      expect(onStale).toHaveBeenCalledTimes(1);
      expect(within(dialog()).queryByText("Pendente de validação")).not.toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    },
  );

  it("shows 404 HOUR_ENTRY_NOT_FOUND as an alert and turns Remover lançamento off", async () => {
    server.use(
      removeMyHourEntryHandler({ error: { statusCode: 404, error: "HOUR_ENTRY_NOT_FOUND" } }),
    );
    const user = userEvent.setup();
    const { onStale, queryClient } = await renderRemove();
    queryClient.setQueryData(getListMyHourEntriesQueryKey({ limit: 5 }), { cached: true });

    await user.click(submitButton());

    expect(await within(dialog()).findByRole("alert")).toHaveTextContent(
      "Este lançamento não existe mais.",
    );
    expect(onStale).toHaveBeenCalledTimes(1);
    expect(within(dialog()).queryByText("Pendente de validação")).not.toBeInTheDocument();
    await waitFor(() => expect(issueBox("Este lançamento não existe mais.")).toHaveFocus());
    expect(submitButton()).toBeDisabled();
    expect(
      queryClient.getQueryState(getListMyHourEntriesQueryKey({ limit: 5 }))?.isInvalidated,
    ).toBe(true);
  });

  it("shows a network failure as an alert, and a new attempt is allowed", async () => {
    server.use(removeMyHourEntryHandler({ networkError: true }));
    const user = userEvent.setup();
    const { onClose, onStale, queryClient } = await renderRemove();
    queryClient.setQueryData(getListMyHourEntriesQueryKey({ limit: 5 }), { cached: true });

    await user.click(submitButton());

    const message = "Não foi possível remover o lançamento. Tente de novo.";
    expect(await within(dialog()).findByRole("alert")).toHaveTextContent(message);
    await waitFor(() => expect(issueBox(message)).toHaveFocus());
    expect(submitButton()).toBeEnabled();
    // Nothing says the entry changed: it still waits for validation.
    expect(within(dialog()).getByText("Pendente de validação")).toBeInTheDocument();
    // Nothing says the entry changed: the lists are not read again.
    expect(
      queryClient.getQueryState(getListMyHourEntriesQueryKey({ limit: 5 }))?.isInvalidated,
    ).toBe(false);
    expect(onStale).not.toHaveBeenCalled();

    server.use(removeMyHourEntryHandler());
    await user.click(submitButton());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
