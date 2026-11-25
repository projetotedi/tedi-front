import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Role } from "@shared/lib/role";

import { LogHoursForMemberButton } from "../components/LogHoursForMemberButton";
import { BEATRIZ_ID, BEATRIZ_NAME } from "./entries-handlers";
import {
  freezeToday,
  renderWithProviders,
  sessionUser,
  setupHoursEntriesTestServer,
} from "./entries-test-utils";

setupHoursEntriesTestServer();

const BEATRIZ = { id: BEATRIZ_ID, name: BEATRIZ_NAME };

describe("LogHoursForMemberButton", () => {
  freezeToday();

  it.each([
    { role: Role.director, drawn: true },
    { role: Role.coordinator, drawn: true },
    { role: Role.member, drawn: false },
  ])(
    "draws + Lançar horas for a member only with hours.logForOthers ($role: $drawn)",
    async ({ role, drawn }) => {
      await renderWithProviders(<LogHoursForMemberButton member={BEATRIZ} />, {
        user: sessionUser(role),
      });

      const button = screen.queryByRole("button", { name: "Lançar horas" });
      if (drawn) {
        expect(button).toBeEnabled();
        expect(button).toHaveTextContent("+ Lançar horas");
      } else {
        expect(button).not.toBeInTheDocument();
        expect(screen.queryByText(/Lançar horas/)).not.toBeInTheDocument();
      }
    },
  );

  it("opens Lançar horas for the member and gives the focus back to the button on Cancelar", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<LogHoursForMemberButton member={BEATRIZ} />, {
      user: sessionUser(Role.director),
    });

    const button = screen.getByRole("button", { name: "Lançar horas" });
    await user.click(button);

    const dialog = await screen.findByRole("dialog", {
      name: "Lançar horas para Beatriz Nunes Carvalho",
    });
    expect(dialog).toHaveAccessibleDescription(/Você está lançando em nome de Beatriz/);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
  });
});
