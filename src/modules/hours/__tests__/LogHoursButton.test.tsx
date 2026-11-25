import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Role } from "@shared/lib/role";

import { LogHoursButton } from "../components/LogHoursButton";
import {
  freezeToday,
  renderWithProviders,
  sessionUser,
  sessionUserWith,
  setupHoursEntriesTestServer,
} from "./entries-test-utils";

setupHoursEntriesTestServer();

describe("LogHoursButton", () => {
  freezeToday();

  it.each([Role.member, Role.director, Role.coordinator])(
    "shows + Lançar horas to a member, a director and the coordination, named Lançar horas (%s)",
    async (role) => {
      await renderWithProviders(<LogHoursButton />, { user: sessionUser(role) });

      const button = screen.getByRole("button", { name: "Lançar horas" });
      expect(button).toHaveTextContent("+ Lançar horas");
      expect(button).toBeEnabled();
      expect(screen.getByText("+")).toHaveAttribute("aria-hidden", "true");
    },
  );

  it("opens Lançar horas and gives the focus back to the button on Cancelar", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<LogHoursButton />);

    const button = screen.getByRole("button", { name: "Lançar horas" });
    await user.click(button);

    expect(await screen.findByRole("dialog", { name: "Lançar horas" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
  });

  it("is not drawn without account.manageOwn", async () => {
    await renderWithProviders(<LogHoursButton />, {
      user: sessionUserWith("account.manageOwn", "none"),
    });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/Lançar horas/)).not.toBeInTheDocument();
  });
});
