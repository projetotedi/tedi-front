import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getListMyHourEntriesQueryKey } from "@api/generated/hours/hours";

import { MyEntriesCard } from "../components/MyEntriesCard";
import { MY_RECENT_ENTRIES_PARAMS } from "../lib/entry-queries";
import { myHourEntriesHandler, type ListCall } from "./entries-handlers";
import {
  createDeferred,
  renderWithProviders,
  server,
  setupHoursEntriesTestServer,
} from "./entries-test-utils";

setupHoursEntriesTestServer();

const RECENT_KEY = getListMyHourEntriesQueryKey(MY_RECENT_ENTRIES_PARAMS);
const SERVER_ERROR = { statusCode: 500, error: "INTERNAL_SERVER_ERROR" };

const table = () => screen.getByRole("table", { name: "Meus lançamentos" });

/** The cells of the row whose accessible name (the text of the row) matches `name`. */
function cellsOfRow(name: RegExp): HTMLElement[] {
  return within(within(table()).getByRole("row", { name })).getAllByRole("cell");
}

async function renderCard() {
  const view = await renderWithProviders(<MyEntriesCard />);
  return view;
}

describe("MyEntriesCard", () => {
  it("asks for the five most recent entries and lists the columns of the Figma", async () => {
    const onCall = vi.fn<(call: ListCall) => void>();
    server.use(myHourEntriesHandler({ onCall }));
    await renderCard();

    await screen.findByRole("table", { name: "Meus lançamentos" });

    expect(onCall).toHaveBeenCalledExactlyOnceWith({ page: null, limit: "5" });
    expect(screen.getByRole("heading", { name: "Meus lançamentos" })).toBeInTheDocument();
    expect(
      within(table())
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Data", "Atividade", "Categoria", "Declarado", "Validado", "Status"]);
    expect(within(table()).getAllByRole("row")).toHaveLength(6);
  });

  it("shows the date, the category and the status of an entry", async () => {
    server.use(myHourEntriesHandler());
    await renderCard();
    await screen.findByRole("table", { name: "Meus lançamentos" });

    const rejected = cellsOfRow(/Material de apoio sem comprovação/);
    expect(rejected[0]).toHaveTextContent(/^28\/02$/);
    expect(rejected[2]).toHaveTextContent(/^Outros$/);
    expect(rejected[5]).toHaveTextContent(/^Rejeitado$/);

    const lesson = cellsOfRow(/Teclado, mouse e janelas/);
    expect(lesson[2]).toHaveTextContent(/^Aula$/);
    expect(lesson[5]).toHaveTextContent(/^Aprovado$/);
  });

  it("shows declared and validated time in hours, a dash read as Não informado before validation and 0h when rejected", async () => {
    server.use(myHourEntriesHandler());
    await renderCard();
    await screen.findByRole("table", { name: "Meus lançamentos" });

    const adjusted = cellsOfRow(/Planejamento de conteúdo do bimestre/);
    expect(adjusted[3]).toHaveTextContent(/^3h$/);
    expect(adjusted[4]).toHaveTextContent(/^2h$/);

    const pending = cellsOfRow(/Feira de tecnologia/);
    expect(pending[3]).toHaveTextContent(/^4h$/);
    expect(within(pending[4]).getByText("—")).toHaveAttribute("aria-hidden", "true");
    expect(within(pending[4]).getByText("Não informado")).toBeInTheDocument();
    expect(pending[5]).toHaveTextContent(/^Pendente$/);

    const rejected = cellsOfRow(/Material de apoio sem comprovação/);
    expect(rejected[3]).toHaveTextContent(/^2h$/);
    expect(rejected[4]).toHaveTextContent(/^0h$/);
  });

  it("never shows a duration in minutes", async () => {
    server.use(myHourEntriesHandler());
    await renderCard();
    await screen.findByRole("table", { name: "Meus lançamentos" });

    expect(screen.queryByText(/\d+\s*min\b/)).not.toBeInTheDocument();
  });

  it("shows Ajustado as a tag of its own, not as information", async () => {
    server.use(myHourEntriesHandler());
    await renderCard();
    await screen.findByRole("table", { name: "Meus lançamentos" });

    const status = cellsOfRow(/Planejamento de conteúdo do bimestre/)[5];
    expect(status).toHaveTextContent(/^Ajustado$/);
    expect(within(status).getByText("Ajustado").tagName).toBe("SPAN");
  });

  it("shows the empty message, with no table and no statement link", async () => {
    server.use(
      myHourEntriesHandler({ response: () => ({ data: [], page: 1, limit: 5, total: 0 }) }),
    );
    await renderCard();

    expect(await screen.findByText("Nenhum lançamento ainda.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Meus lançamentos" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ver extrato completo/ })).not.toBeInTheDocument();
  });

  it("shows skeletons while loading", async () => {
    const response = createDeferred();
    server.use(myHourEntriesHandler({ delay: response.promise }));
    await renderCard();

    expect(screen.getByRole("status")).toHaveTextContent("Carregando os seus lançamentos…");
    expect(screen.getByRole("heading", { name: "Meus lançamentos" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    response.resolve();

    expect(await screen.findByRole("table", { name: "Meus lançamentos" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the error with Tentar de novo, which asks again", async () => {
    server.use(myHourEntriesHandler({ error: SERVER_ERROR }));
    const user = userEvent.setup();
    await renderCard();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as suas horas.",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    server.use(myHourEntriesHandler());
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByRole("table", { name: "Meus lançamentos" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the list when a refetch fails", async () => {
    server.use(myHourEntriesHandler());
    const { queryClient } = await renderCard();
    await screen.findByRole("table", { name: "Meus lançamentos" });

    server.use(myHourEntriesHandler({ error: SERVER_ERROR }));
    await queryClient.refetchQueries({ queryKey: RECENT_KEY });

    await waitFor(() => expect(queryClient.getQueryState(RECENT_KEY)?.status).toBe("error"));
    expect(within(table()).getByText("Reunião de coordenação")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("drops my entries from the cache when it unmounts", async () => {
    server.use(myHourEntriesHandler());
    const { unmount, queryClient } = await renderCard();
    await screen.findByRole("table", { name: "Meus lançamentos" });
    expect(queryClient.getQueryState(RECENT_KEY)).toBeDefined();

    unmount();

    await waitFor(() => expect(queryClient.getQueryState(RECENT_KEY)).toBeUndefined());
  });
});
