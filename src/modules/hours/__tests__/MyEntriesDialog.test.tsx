import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MyEntriesDialog } from "../components/MyEntriesDialog";
import {
  ATTENDANCE_PENDING,
  buildEntry,
  createHoursStore,
  entryId,
  myHourEntriesHandler,
  pageOf,
  removeMyHourEntryHandler,
  STATEMENT,
  type ListCall,
} from "./entries-handlers";
import {
  createDeferred,
  renderWithProviders,
  server,
  setupHoursEntriesTestServer,
} from "./entries-test-utils";

setupHoursEntriesTestServer();

const SERVER_ERROR = { statusCode: 500, error: "INTERNAL_SERVER_ERROR" };
const REMOVE_E4 = "Remover o lançamento de 08/03: Feira de tecnologia (evento externo)";

const statement = () => screen.getByRole("dialog", { name: "Meus lançamentos" });
const table = () => within(statement()).getByRole("table", { name: "Meus lançamentos" });
const list = () => within(statement()).getByRole("region", { name: "Meus lançamentos" });

/** The cells of the row whose accessible name (the text of the row) matches `name`. */
function cellsOfRow(name: RegExp): HTMLElement[] {
  return within(within(table()).getByRole("row", { name })).getAllByRole("cell");
}

/** `count` pending entries of Ana, the newest first, named "Lançamento 1" and on. */
function manyEntries(count: number) {
  return Array.from({ length: count }, (_, index) =>
    buildEntry({ id: entryId(100 + index), activity: `Lançamento ${index + 1}` }),
  );
}

async function renderStatement() {
  const onClose = vi.fn();
  const view = await renderWithProviders(<MyEntriesDialog onClose={onClose} />);
  await screen.findByRole("dialog", { name: "Meus lançamentos" });
  return { ...view, onClose };
}

describe("MyEntriesDialog", () => {
  it("after removing, the row leaves the statement and the focus goes to the list", async () => {
    const store = createHoursStore();
    server.use(...store.handlers);
    const user = userEvent.setup();
    await renderStatement();
    await within(statement()).findByText("Feira de tecnologia (evento externo)");

    await user.click(within(statement()).getByRole("button", { name: REMOVE_E4 }));
    const confirm = await screen.findByRole("dialog", { name: "Remover lançamento" });
    await user.click(within(confirm).getByRole("button", { name: "Remover lançamento" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Remover lançamento" })).not.toBeInTheDocument(),
    );
    expect(
      within(table()).queryByText("Feira de tecnologia (evento externo)"),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(list()).toHaveFocus());
    expect(store.entries.map((entry) => entry.id)).not.toContain(entryId(4));
  });

  it("asks the first page of 20 and lists the statement newest first, with the seven columns of the Figma", async () => {
    const onCall = vi.fn<(call: ListCall) => void>();
    server.use(myHourEntriesHandler({ onCall }));
    await renderStatement();
    await within(statement()).findByText("Reunião de coordenação");

    expect(onCall).toHaveBeenCalledExactlyOnceWith({ page: "1", limit: "20" });
    expect(
      within(table())
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Data", "Atividade", "Categoria", "Declarado", "Validado", "Status", "Ações"]);
    expect(
      within(table())
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getAllByRole("cell")[0].textContent),
    ).toEqual(["14/03", "12/03", "10/03", "08/03", "05/03", "28/02", "20/02", "15/02"]);
    expect(cellsOfRow(/Atendimento a membro novo/)[2]).toHaveTextContent(/^Atendimento$/);
  });

  it("shows the review note under the activity of an adjusted and a rejected entry, in quotes", async () => {
    server.use(myHourEntriesHandler());
    await renderStatement();
    await within(statement()).findByText("Reunião de coordenação");

    expect(cellsOfRow(/Planejamento de conteúdo do bimestre/)[1]).toHaveTextContent(
      "Planejamento de conteúdo do bimestreAjustado pela coordenação: “Feito em dupla: cada pessoa registra 2h.”",
    );
    expect(cellsOfRow(/Material de apoio sem comprovação/)[1]).toHaveTextContent(
      "Material de apoio sem comprovaçãoRejeitado pela coordenação: “Sem link do material. Lance de novo com o link.”",
    );
    expect(cellsOfRow(/Reunião de coordenação/)[1]).toHaveTextContent(/^Reunião de coordenação$/);
    expect(within(statement()).getAllByText(/pela coordenação:/)).toHaveLength(2);
  });

  it("shows 1h30 and 1h40 in hours", async () => {
    server.use(myHourEntriesHandler());
    await renderStatement();
    await within(statement()).findByText("Reunião de coordenação");

    const calendar = cellsOfRow(/Planejamento do calendário do bimestre/);
    expect(calendar[3]).toHaveTextContent(/^1h30$/);
    expect(calendar[4]).toHaveTextContent(/^1h30$/);
    expect(cellsOfRow(/Cobertura de aula substituta/)[3]).toHaveTextContent(/^1h40$/);
    expect(within(statement()).queryByText(/\d+\s*min\b/)).not.toBeInTheDocument();
  });

  it("offers Remover only on pending entries that did not come from the attendance", async () => {
    const entries = [...STATEMENT.slice(0, 3), ATTENDANCE_PENDING, ...STATEMENT.slice(3)];
    server.use(myHourEntriesHandler({ response: (call) => pageOf(entries, call) }));
    await renderStatement();
    await within(statement()).findByText("Reunião de coordenação");

    const actionsOf = (name: RegExp) => within(table()).getAllByRole("row", { name });
    for (const name of [/^08\/03 Feira/, /^15\/02 Cobertura/]) {
      expect(
        within(actionsOf(name)[0]).getByRole("button", { name: /^Remover o lançamento/ }),
      ).toBeInTheDocument();
    }
    for (const name of [/^14\/03/, /^12\/03/, /^05\/03/, /^28\/02/, /^20\/02/]) {
      expect(within(actionsOf(name)[0]).queryByRole("button")).not.toBeInTheDocument();
    }
    // The two of 10/03 are lesson hours: the approved one and the pending one (e9).
    const lessons = actionsOf(/^10\/03/);
    expect(lessons).toHaveLength(2);
    for (const row of lessons) expect(within(row).queryByRole("button")).not.toBeInTheDocument();
    expect(within(lessons[1]).getByText("Pendente")).toBeInTheDocument();
    expect(within(table()).getAllByRole("button", { name: /^Remover/ })).toHaveLength(2);
  });

  it("names each Remover by the day and the activity", async () => {
    server.use(myHourEntriesHandler());
    await renderStatement();
    await within(statement()).findByText("Reunião de coordenação");

    const buttons = within(table()).getAllByRole("button", { name: /^Remover/ });
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      REMOVE_E4,
      "Remover o lançamento de 15/02: Cobertura de aula substituta",
    ]);
    expect(buttons[0]).toHaveTextContent(/^Remover$/);
  });

  it("shows the pagination only past 20 entries and asks the next page", async () => {
    const onCall = vi.fn<(call: ListCall) => void>();
    const entries = manyEntries(21);
    server.use(myHourEntriesHandler({ onCall, response: (call) => pageOf(entries, call) }));
    const user = userEvent.setup();
    await renderStatement();
    await within(statement()).findByText("Lançamento 1");

    const pages = within(statement()).getByRole("navigation", { name: "Paginação do extrato" });
    await user.click(within(pages).getByRole("button", { name: "Página 2" }));

    expect(await within(statement()).findByText("Lançamento 21")).toBeInTheDocument();
    expect(within(statement()).queryByText("Lançamento 1")).not.toBeInTheDocument();
    expect(onCall).toHaveBeenLastCalledWith({ page: "2", limit: "20" });
  });

  it("has no pagination with 20 entries or fewer", async () => {
    const entries = manyEntries(20);
    server.use(myHourEntriesHandler({ response: (call) => pageOf(entries, call) }));
    await renderStatement();
    await within(statement()).findByText("Lançamento 20");

    expect(within(statement()).queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("keeps the page on screen, busy, while the next one loads", async () => {
    const entries = manyEntries(21);
    const nextPage = createDeferred();
    server.use(
      myHourEntriesHandler({
        response: (call) => pageOf(entries, call),
      }),
    );
    const user = userEvent.setup();
    await renderStatement();
    await within(statement()).findByText("Lançamento 1");

    server.use(
      myHourEntriesHandler({
        delay: nextPage.promise,
        response: (call) => pageOf(entries, call),
      }),
    );
    await user.click(within(statement()).getByRole("button", { name: "Página 2" }));

    await waitFor(() => expect(list()).toHaveAttribute("aria-busy", "true"));
    expect(within(statement()).getByText("Lançamento 1")).toBeInTheDocument();

    nextPage.resolve();

    expect(await within(statement()).findByText("Lançamento 21")).toBeInTheDocument();
    expect(list()).not.toHaveAttribute("aria-busy");
  });

  it("keeps the headers and shows the loading state", async () => {
    const response = createDeferred();
    server.use(myHourEntriesHandler({ delay: response.promise }));
    await renderStatement();

    expect(within(table()).getAllByRole("columnheader")).toHaveLength(7);
    expect(within(statement()).getByRole("status")).toHaveTextContent(
      "Carregando os seus lançamentos…",
    );

    response.resolve();

    expect(await within(statement()).findByText("Reunião de coordenação")).toBeInTheDocument();
    expect(within(statement()).queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    server.use(myHourEntriesHandler({ response: (call) => pageOf([], call) }));
    await renderStatement();

    expect(
      await within(statement()).findByRole("heading", { name: "Nenhum lançamento ainda" }),
    ).toBeInTheDocument();
    expect(
      within(statement()).getByText(
        "Use + Lançar horas no seu perfil para registrar horas de planejamento, eventos e gestão.",
      ),
    ).toBeInTheDocument();
    expect(within(table()).getAllByRole("columnheader")).toHaveLength(7);
    expect(within(statement()).queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("shows the error state with Tentar de novo, which asks again", async () => {
    server.use(myHourEntriesHandler({ error: SERVER_ERROR }));
    const user = userEvent.setup();
    await renderStatement();

    const alert = await within(statement()).findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível carregar os seus lançamentos");
    expect(alert).toHaveTextContent("Verifique a conexão e tente de novo.");
    expect(within(table()).getAllByRole("columnheader")).toHaveLength(7);

    server.use(myHourEntriesHandler());
    await user.click(within(statement()).getByRole("button", { name: "Tentar de novo" }));

    expect(await within(statement()).findByText("Reunião de coordenação")).toBeInTheDocument();
    expect(within(statement()).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("closes with Fechar, with the X and with Esc", async () => {
    server.use(myHourEntriesHandler());
    const user = userEvent.setup();
    const { onClose } = await renderStatement();
    await within(statement()).findByText("Reunião de coordenação");

    const [closeX, closeFooter] = within(statement()).getAllByRole("button", { name: "Fechar" });
    await user.click(closeFooter);
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(closeX);
    expect(onClose).toHaveBeenCalledTimes(2);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("opens Remover lançamento over the statement, and Voltar gives the focus back to that Remover", async () => {
    server.use(myHourEntriesHandler());
    const user = userEvent.setup();
    const { onClose } = await renderStatement();
    await within(statement()).findByText("Reunião de coordenação");
    const remove = within(table()).getByRole("button", { name: REMOVE_E4 });

    await user.click(remove);

    const confirm = await screen.findByRole("dialog", { name: "Remover lançamento" });
    // The statement stays behind, hidden from the tree while the confirmation is on top of it.
    expect(
      screen.getByRole("dialog", { name: "Meus lançamentos", hidden: true }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Meus lançamentos" })).not.toBeInTheDocument();
    // Esc closes the one on top only.
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Remover lançamento" })).not.toBeInTheDocument(),
    );
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(remove).toHaveFocus());

    await user.click(remove);
    const again = await screen.findByRole("dialog", { name: "Remover lançamento" });
    expect(again).not.toBe(confirm);
    await user.click(within(again).getByRole("button", { name: "Voltar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Remover lançamento" })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(remove).toHaveFocus());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("goes back a page when the only entry of the last page is removed", async () => {
    let entries = manyEntries(21);
    const onCall = vi.fn<(call: ListCall) => void>();
    server.use(
      myHourEntriesHandler({ onCall, response: (call) => pageOf(entries, call) }),
      removeMyHourEntryHandler({
        onRemoved: (id) => {
          entries = entries.filter((entry) => entry.id !== id);
        },
      }),
    );
    const user = userEvent.setup();
    await renderStatement();
    await within(statement()).findByText("Lançamento 1");
    await user.click(within(statement()).getByRole("button", { name: "Página 2" }));
    await within(statement()).findByText("Lançamento 21");

    await user.click(
      within(table()).getByRole("button", { name: /^Remover o lançamento de .*: Lançamento 21$/ }),
    );
    const confirm = await screen.findByRole("dialog", { name: "Remover lançamento" });
    await user.click(within(confirm).getByRole("button", { name: "Remover lançamento" }));

    expect(await within(statement()).findByText("Lançamento 1")).toBeInTheDocument();
    expect(within(statement()).queryByText("Lançamento 21")).not.toBeInTheDocument();
    expect(onCall).toHaveBeenLastCalledWith({ page: "1", limit: "20" });
    expect(within(statement()).queryByRole("navigation")).not.toBeInTheDocument();
  });
});
