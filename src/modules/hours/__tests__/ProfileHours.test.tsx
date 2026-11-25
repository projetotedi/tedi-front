import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  getGetMyHoursSummaryQueryKey,
  getListMyHourEntriesQueryKey,
} from "@api/generated/hours/hours";

import { LogHoursButton } from "../components/LogHoursButton";
import { MyCategoryHoursCard } from "../components/MyCategoryHoursCard";
import { MyEntriesCard } from "../components/MyEntriesCard";
import { MyHoursSummary } from "../components/MyHoursSummary";
import { createHoursStore } from "./entries-handlers";
import {
  freezeToday,
  renderWithProviders,
  server,
  setupHoursEntriesTestServer,
} from "./entries-test-utils";

setupHoursEntriesTestServer();

/** The hours of "Meu perfil" together, on one query client, as the slots of `app/` put them. */
function ProfileHours() {
  return (
    <>
      <LogHoursButton />
      <MyHoursSummary />
      <MyEntriesCard />
      <MyCategoryHoursCard />
    </>
  );
}

const summaryRegion = () => screen.getByRole("region", { name: "Resumo de horas" });
const recentTable = () => screen.getByRole("table", { name: "Meus lançamentos" });
const categoryTable = () => screen.getByRole("table", { name: "Horas por categoria" });

/** The number of the tile named `label`. */
function tileValue(label: string): string | null | undefined {
  return within(summaryRegion()).getByText(label).closest("li")?.lastElementChild?.textContent;
}

/** The cells of the row of `table` whose accessible name matches `name`. */
function cellsOfRow(table: HTMLElement, name: RegExp): HTMLElement[] {
  return within(within(table).getByRole("row", { name })).getAllByRole("cell");
}

/** Opens "+ Lançar horas" and logs 2h30 of Planejamento on 10/03, as in the Figma. */
async function logPlanning(user: UserEvent) {
  await user.click(screen.getByRole("button", { name: "Lançar horas" }));
  const dialog = await screen.findByRole("dialog", { name: "Lançar horas" });
  await user.type(
    within(dialog).getByRole("textbox", { name: /^Atividade/ }),
    "Preparação de material da aula 12",
  );
  await user.click(within(dialog).getByRole("button", { name: /Categoria/ }));
  await user.click(await screen.findByRole("option", { name: "Planejamento" }));
  fireEvent.change(within(dialog).getByLabelText(/^Data/), { target: { value: "2026-03-10" } });
  await user.type(within(dialog).getByRole("textbox", { name: /^Horas/ }), "2h30");
  await user.click(within(dialog).getByRole("button", { name: "Lançar horas" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
}

describe("the hours of My profile", () => {
  freezeToday();

  it("logging hours updates the summary, the recent entries and the hours by category without a reload", async () => {
    const store = createHoursStore();
    server.use(...store.handlers);
    const user = userEvent.setup();
    await renderWithProviders(<ProfileHours />);

    await waitFor(() => expect(tileValue("Total de horas lançadas")).toBe("58h"));
    await screen.findByRole("table", { name: "Horas por categoria" });
    const region = summaryRegion();
    expect(tileValue("Pendentes de validação")).toBe("8h");
    expect(cellsOfRow(categoryTable(), /^Planejamento/)[1]).toHaveTextContent(/^8h$/);

    await logPlanning(user);

    await waitFor(() => expect(tileValue("Total de horas lançadas")).toBe("60h30"));
    expect(tileValue("Pendentes de validação")).toBe("10h30");
    expect(tileValue("Horas validadas")).toBe("48h");
    expect(tileValue("Ajustadas / rejeitadas")).toBe("2h");
    // The tiles were not mounted again: the same region was updated.
    expect(summaryRegion()).toBe(region);

    await waitFor(() =>
      expect(within(recentTable()).getByText("Preparação de material da aula 12")).toBeVisible(),
    );
    const logged = cellsOfRow(recentTable(), /Preparação de material da aula 12/);
    expect(logged[0]).toHaveTextContent(/^10\/03$/);
    expect(logged[2]).toHaveTextContent(/^Planejamento$/);
    expect(logged[3]).toHaveTextContent(/^2h30$/);
    expect(within(logged[4]).getByText("—")).toHaveAttribute("aria-hidden", "true");
    expect(logged[5]).toHaveTextContent(/^Pendente$/);
    // In the order of the API, the newest day first: after the 14/03 and the 12/03.
    const rows = within(recentTable()).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual([
      "14/03",
      "12/03",
      "10/03",
      "10/03",
      "08/03",
    ]);
    expect(rows[2]).toHaveTextContent("Preparação de material da aula 12");

    await waitFor(() =>
      expect(cellsOfRow(categoryTable(), /^Planejamento/)[1]).toHaveTextContent(/^10h30$/),
    );
    const planningPending = cellsOfRow(categoryTable(), /^Planejamento/)[2];
    expect(within(planningPending).getByText("10h30")).toHaveAttribute("aria-hidden", "true");
    expect(
      within(planningPending).getByText("10 horas e 30 minutos pendentes"),
    ).toBeInTheDocument();
  });

  it("the full statement shows the new entry right after logging", async () => {
    const store = createHoursStore();
    server.use(...store.handlers);
    const user = userEvent.setup();
    await renderWithProviders(<ProfileHours />);
    await screen.findByRole("table", { name: "Meus lançamentos" });

    await logPlanning(user);
    await user.click(screen.getByRole("button", { name: "Ver extrato completo" }));

    const statement = await screen.findByRole("dialog", { name: "Meus lançamentos" });
    const row = await within(statement).findByRole("row", {
      name: /Preparação de material da aula 12/,
    });
    const cells = within(row).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent(/^10\/03$/);
    expect(cells[5]).toHaveTextContent(/^Pendente$/);
    expect(
      within(row).getByRole("button", {
        name: "Remover o lançamento de 10/03: Preparação de material da aula 12",
      }),
    ).toBeInTheDocument();
  });

  it("removing a pending entry from the statement updates the summary and the recent entries without a reload", async () => {
    const store = createHoursStore();
    server.use(...store.handlers);
    const user = userEvent.setup();
    await renderWithProviders(<ProfileHours />);
    await waitFor(() => expect(tileValue("Total de horas lançadas")).toBe("58h"));
    await within(recentTable()).findByText("Feira de tecnologia (evento externo)");

    await user.click(screen.getByRole("button", { name: "Ver extrato completo" }));
    const statement = await screen.findByRole("dialog", { name: "Meus lançamentos" });
    await user.click(
      await within(statement).findByRole("button", {
        name: "Remover o lançamento de 08/03: Feira de tecnologia (evento externo)",
      }),
    );
    const confirm = await screen.findByRole("dialog", { name: "Remover lançamento" });
    await user.click(within(confirm).getByRole("button", { name: "Remover lançamento" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Remover lançamento" })).not.toBeInTheDocument(),
    );
    await user.click(within(statement).getAllByRole("button", { name: "Fechar" })[1]);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    expect(tileValue("Total de horas lançadas")).toBe("54h");
    expect(tileValue("Pendentes de validação")).toBe("4h");
    expect(tileValue("Horas validadas")).toBe("48h");
    expect(
      within(recentTable()).queryByText("Feira de tecnologia (evento externo)"),
    ).not.toBeInTheDocument();
    expect(within(recentTable()).getByText("Atendimento a membro novo")).toBeInTheDocument();
  });

  it("shows the entries of the person signed in only, and drops them when the cards unmount", async () => {
    const store = createHoursStore();
    server.use(...store.handlers);
    const paths: string[] = [];
    const onRequest = ({ request }: { request: Request }) => {
      paths.push(new URL(request.url).pathname);
    };
    server.events.on("request:start", onRequest);
    const { unmount, queryClient } = await renderWithProviders(<ProfileHours />);
    await screen.findByRole("table", { name: "Meus lançamentos" });
    await screen.findByRole("table", { name: "Horas por categoria" });
    server.events.removeListener("request:start", onRequest);

    // Every read is of the person signed in (`/me`): none asks for a member by id.
    expect(paths.filter((path) => !path.endsWith("/auth/me"))).not.toHaveLength(0);
    for (const path of paths) {
      expect(path).toMatch(/\/(auth\/me|me\/hours\/summary|me\/hour-entries)$/);
    }

    unmount();

    await waitFor(() => {
      expect(
        queryClient.getQueryCache().findAll({ queryKey: getGetMyHoursSummaryQueryKey() }),
      ).toEqual([]);
      expect(
        queryClient.getQueryCache().findAll({ queryKey: getListMyHourEntriesQueryKey() }),
      ).toEqual([]);
    });
  });
});
