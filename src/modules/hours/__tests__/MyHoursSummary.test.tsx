import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getGetMyHoursSummaryQueryKey } from "@api/generated/hours/hours";

import { MyHoursSummary } from "../components/MyHoursSummary";
import { buildSummary, myHoursSummaryHandler, type SummaryCall } from "./entries-handlers";
import {
  createDeferred,
  renderWithProviders,
  server,
  sessionUserWith,
  setupHoursEntriesTestServer,
} from "./entries-test-utils";

setupHoursEntriesTestServer();

const LABELS = [
  "Total de horas lançadas",
  "Horas validadas",
  "Pendentes de validação",
  "Ajustadas / rejeitadas",
];

const summaryRegion = () => screen.getByRole("region", { name: "Resumo de horas" });

/** The tile (list item) of the number named `label`. */
function tileOf(label: string): HTMLElement {
  const tile = within(summaryRegion()).getByText(label).closest("li");
  if (!(tile instanceof HTMLElement)) throw new Error(`No tile for "${label}"`);
  return tile;
}

const SERVER_ERROR = { statusCode: 500, error: "INTERNAL_SERVER_ERROR" };

describe("MyHoursSummary", () => {
  it("shows the four totals in hours from the summary of the whole period", async () => {
    const onCall = vi.fn<(call: SummaryCall) => void>();
    server.use(myHoursSummaryHandler({ onCall }));
    await renderWithProviders(<MyHoursSummary />);

    expect(await within(tileOf("Total de horas lançadas")).findByText("58h")).toBeInTheDocument();
    expect(within(tileOf("Horas validadas")).getByText("48h")).toBeInTheDocument();
    expect(within(tileOf("Pendentes de validação")).getByText("8h")).toBeInTheDocument();
    expect(within(tileOf("Ajustadas / rejeitadas")).getByText("2h")).toBeInTheDocument();
    expect(onCall).toHaveBeenCalledExactlyOnceWith({ from: null, to: null });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows 0h in every tile for a person with no entries", async () => {
    server.use(myHoursSummaryHandler({ all: buildSummary() }));
    await renderWithProviders(<MyHoursSummary />);

    await within(tileOf("Total de horas lançadas")).findByText("0h");
    for (const label of LABELS) {
      expect(within(tileOf(label)).getByText("0h"), label).toBeInTheDocument();
    }
  });

  it("shows a skeleton and says it is loading", async () => {
    const response = createDeferred();
    server.use(myHoursSummaryHandler({ delay: response.promise }));
    await renderWithProviders(<MyHoursSummary />);

    expect(screen.getByRole("status")).toHaveTextContent("Carregando as suas horas…");
    for (const label of LABELS) {
      expect(within(tileOf(label)).queryByText(/h$/), label).not.toBeInTheDocument();
    }

    response.resolve();

    expect(await within(tileOf("Horas validadas")).findByText("48h")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a dash read as Não informado in every tile when the summary fails", async () => {
    server.use(myHoursSummaryHandler({ error: SERVER_ERROR }));
    await renderWithProviders(<MyHoursSummary />);

    await screen.findByRole("alert");
    for (const label of LABELS) {
      const tile = within(tileOf(label));
      expect(tile.getByText("—"), label).toHaveAttribute("aria-hidden", "true");
      expect(tile.getByText("Não informado"), label).toBeInTheDocument();
    }
  });

  it("says the summary could not be loaded and Tentar de novo asks it again", async () => {
    server.use(myHoursSummaryHandler({ error: SERVER_ERROR }));
    const user = userEvent.setup();
    await renderWithProviders(<MyHoursSummary />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as suas horas.",
    );

    server.use(myHoursSummaryHandler());
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await within(tileOf("Total de horas lançadas")).findByText("58h")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
  });

  it("keeps the numbers when a refetch fails", async () => {
    server.use(myHoursSummaryHandler());
    const { queryClient } = await renderWithProviders(<MyHoursSummary />);
    await within(tileOf("Total de horas lançadas")).findByText("58h");

    server.use(myHoursSummaryHandler({ error: SERVER_ERROR }));
    await queryClient.refetchQueries({ queryKey: getGetMyHoursSummaryQueryKey() });

    await waitFor(() =>
      expect(queryClient.getQueryState(getGetMyHoursSummaryQueryKey())?.status).toBe("error"),
    );
    expect(within(tileOf("Total de horas lançadas")).getByText("58h")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("asks nothing and draws nothing without account.manageOwn", async () => {
    const onCall = vi.fn<(call: SummaryCall) => void>();
    server.use(myHoursSummaryHandler({ onCall }));
    const { container, queryClient } = await renderWithProviders(<MyHoursSummary />, {
      user: sessionUserWith("account.manageOwn", "none"),
    });

    expect(container).toBeEmptyDOMElement();
    expect(onCall).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(getGetMyHoursSummaryQueryKey())?.fetchStatus).not.toBe(
      "fetching",
    );
  });

  it("drops the summary from the cache when it unmounts", async () => {
    server.use(myHoursSummaryHandler());
    const { unmount, queryClient } = await renderWithProviders(<MyHoursSummary />);
    await within(tileOf("Total de horas lançadas")).findByText("58h");
    expect(queryClient.getQueryState(getGetMyHoursSummaryQueryKey())).toBeDefined();

    unmount();

    await waitFor(() =>
      expect(queryClient.getQueryState(getGetMyHoursSummaryQueryKey())).toBeUndefined(),
    );
  });
});
