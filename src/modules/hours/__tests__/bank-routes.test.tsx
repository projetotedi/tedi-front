import { act, screen, waitFor, within } from "@testing-library/react";
import { isValidElement } from "react";
import { describe, expect, it } from "vitest";

import i18n from "@shared/i18n";

import { hoursMenuItems, hoursRoutes } from "../index";
import { director, member } from "./bank-fixtures";
import { createBankSpies } from "./bank-handlers";
import { expectNoRequestTo, renderBankRoutes, setupBankTestServer } from "./bank-test-utils";

setupBankTestServer();

function titleOf(handle: unknown): string | undefined {
  if (typeof handle !== "object" || handle === null || !("title" in handle)) return undefined;
  return typeof handle.title === "string" ? handle.title : undefined;
}

describe("hours routes", () => {
  it("declares the titles of the topbar: Banco de horas and Validação de horas", async () => {
    await i18n.changeLanguage("pt-BR");

    expect(hoursRoutes.map((route) => [route.path, i18n.t(titleOf(route.handle) ?? "")])).toEqual([
      ["hours", "Banco de horas"],
      ["hours/review", "Validação de horas"],
    ]);
  });

  it("asks for the same permission as the menu items", () => {
    const guards = hoursRoutes.map((route) => {
      const element = route.element;
      return [
        `/${route.path}`,
        isValidElement<{ permission?: string }>(element) ? element.props.permission : undefined,
      ];
    });

    expect(guards).toEqual(hoursMenuItems.map((item) => [item.path, item.permission]));
  });

  it("opens Banco de horas and Validação de horas for the coordination", async () => {
    const { router } = await renderBankRoutes({ route: "/hours?period=2026-03" });

    expect(await screen.findByRole("list", { name: "Totais do período" })).toBeInTheDocument();

    await act(() => router.navigate("/hours/review"));

    // The queue of the Banco de horas has the same title: the page is the one without the totals.
    await waitFor(() =>
      expect(screen.queryByRole("list", { name: "Totais do período" })).not.toBeInTheDocument(),
    );
    expect(await screen.findByText("Lançamentos pendentes de validação (3)")).toBeInTheDocument();
    expect(screen.queryByText("Você não tem acesso a esta tela")).not.toBeInTheDocument();
  });

  it("opens Banco de horas for the director", async () => {
    await renderBankRoutes({ route: "/hours?period=2026-03", user: director() });

    expect(await screen.findByRole("list", { name: "Totais do período" })).toBeInTheDocument();
    expect(
      await within(await screen.findByRole("table", { name: /^Horas por membro/ })).findByText(
        "Beatriz Nunes",
      ),
    ).toBeInTheDocument();
  });

  it("shows the forbidden page to the director on Validação de horas and asks nothing of the API", async () => {
    const spies = createBankSpies();
    const { queryClient } = await renderBankRoutes({
      route: "/hours/review",
      user: director(),
      spies,
    });

    expect(await screen.findByText("Você não tem acesso a esta tela")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Validar/ })).not.toBeInTheDocument();
    expectNoRequestTo(queryClient, "/hour-entries");
    expect(spies.requests).toEqual([]);
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
