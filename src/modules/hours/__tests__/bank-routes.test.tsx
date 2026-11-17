import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { director, member } from "./bank-fixtures";
import { createBankSpies } from "./bank-handlers";
import { expectNoRequestTo, renderBankRoutes, setupBankTestServer } from "./bank-test-utils";

setupBankTestServer();

describe("hours routes", () => {
  it("opens Banco de horas for the director", async () => {
    await renderBankRoutes({ route: "/hours?period=2026-03", user: director() });

    expect(await screen.findByRole("list", { name: "Totais do período" })).toBeInTheDocument();
    expect(
      await within(await screen.findByRole("table", { name: /^Horas por membro/ })).findByText(
        "Beatriz Nunes",
      ),
    ).toBeInTheDocument();
  });

  it("shows the forbidden page to the member on Banco de horas and asks nothing of the API", async () => {
    const spies = createBankSpies();
    const { queryClient } = await renderBankRoutes({
      route: "/hours?period=2026-03",
      user: member(),
      spies,
    });

    expect(await screen.findByText("Você não tem acesso a esta tela")).toBeInTheDocument();
    expectNoRequestTo(queryClient, "/hours/overview");
    expectNoRequestTo(queryClient, "/hour-entries");
    expect(spies.requests).toEqual([]);
  });
});
