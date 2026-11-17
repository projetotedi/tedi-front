import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { buildEntry } from "./bank-fixtures";
import { createBankSpies, createBankStore, queueRequests } from "./bank-handlers";
import { renderBankRoutes, setupBankTestServer } from "./bank-test-utils";

setupBankTestServer();

describe("HoursReviewPage", () => {
  it("shows the whole queue, with no period, with selection and actions", async () => {
    const spies = createBankSpies();
    await renderBankRoutes({ route: "/hours/review", spies });

    expect(await screen.findByText("Lançamentos pendentes de validação (3)")).toBeInTheDocument();
    const [request] = queueRequests(spies);
    expect(request.url.searchParams.has("from")).toBe(false);
    expect(request.url.searchParams.has("to")).toBe(false);
    expect(request.url.searchParams.get("limit")).toBe("20");
    expect(
      screen.getByRole("checkbox", { name: "Selecionar todos os lançamentos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Validar lançamento de Rafael Souza em 12/03" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Buscar membro" })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Totais do período" })).not.toBeInTheDocument();
  });

  it("paginates the queue with Mostrando N de M lançamentos", async () => {
    const user = userEvent.setup();
    const store = createBankStore();
    store.entries.push(
      ...Array.from({ length: 22 }, (_, index) =>
        buildEntry({
          id: `0197a000-0000-7000-8000-0000000e${String(index).padStart(4, "0")}`,
          date: "2026-04-01",
          activity: `Atividade ${index + 1}`,
        }),
      ),
    );
    await renderBankRoutes({ route: "/hours/review", store });

    expect(await screen.findByText("Mostrando 20 de 25 lançamentos")).toBeInTheDocument();

    const pages = screen.getByRole("navigation", { name: "Páginas dos lançamentos pendentes" });
    await user.click(within(pages).getByRole("button", { name: "Página 2" }));

    expect(await screen.findByText("Mostrando 5 de 25 lançamentos")).toBeInTheDocument();
  });
});
