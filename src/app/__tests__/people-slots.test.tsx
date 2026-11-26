import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { meHandler } from "@modules/auth/__tests__/handlers";
import { renderRoutes, server, setupAuthTestServer } from "@modules/auth/__tests__/test-utils";
import {
  linkOptionsHandlers,
  myHourEntriesHandler,
  myHoursSummaryHandler,
} from "@modules/hours/__tests__/entries-handlers";
import { createPeopleRoutes } from "@modules/people";
import { myProfileHandler } from "@modules/people/__tests__/handlers";

import { peopleRouteSlots } from "../people-slots";

setupAuthTestServer();

const routes = createPeopleRoutes(peopleRouteSlots);

/** "Meu perfil" with the real slots, the registration and the hours of the API. */
async function renderProfile() {
  server.use(
    meHandler(),
    myProfileHandler(),
    myHoursSummaryHandler(),
    myHourEntriesHandler(),
    ...linkOptionsHandlers(),
  );
  await renderRoutes(routes, { route: "/profile" });
  await screen.findByText("Ana Torres", { selector: "p" });
}

describe("the slots of My profile, filled by the app", () => {
  it("puts + Lançar horas of the hours module after Editar meus dados in the header of My profile", async () => {
    await renderProfile();

    const editData = screen.getByRole("button", { name: "Editar meus dados" });
    const logHours = screen.getByRole("button", { name: "Lançar horas" });
    expect(logHours).toBeEnabled();
    expect(logHours).toHaveTextContent("+ Lançar horas");
    expect(logHours.parentElement).toBe(editData.parentElement);
    expect(
      editData.compareDocumentPosition(logHours) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows the hours summary and the two hours cards of the hours module with the data of the API", async () => {
    await renderProfile();

    const summary = screen.getByRole("region", { name: "Resumo de horas" });
    expect(await within(summary).findByText("58h")).toBeInTheDocument();
    const entries = await screen.findByRole("table", { name: "Meus lançamentos" });
    expect(within(entries).getByText("Reunião de coordenação")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Horas por categoria" })).toBeInTheDocument();
    expect(await screen.findByRole("table", { name: "Horas por categoria" })).toBeInTheDocument();
    expect(
      screen.queryByText("O banco de horas chega com o módulo de horas."),
    ).not.toBeInTheDocument();
  });

  it("opens Lançar horas from the header", async () => {
    const user = userEvent.setup();
    await renderProfile();

    await user.click(screen.getByRole("button", { name: "Lançar horas" }));

    expect(await screen.findByRole("dialog", { name: "Lançar horas" })).toBeInTheDocument();
  });
});
