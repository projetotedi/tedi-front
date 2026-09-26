import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { Role } from "@shared/lib/role";

import { AuthProvider } from "../AuthProvider";
import { UserMenu } from "../components/UserMenu";
import { buildMeUser, logoutHandler, meHandler } from "./handlers";
import { renderWithProviders, server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

function renderUserMenu() {
  return renderWithProviders(
    <AuthProvider>
      <UserMenu />
    </AuthProvider>,
  );
}

describe("UserMenu", () => {
  it("shows the user name and the initials of the name", async () => {
    server.use(meHandler({ user: buildMeUser({ name: "Beatriz Nunes", role: Role.member }) }));

    await renderUserMenu();

    const trigger = await screen.findByRole("button", { name: "Menu do perfil (Beatriz Nunes)" });
    expect(within(trigger).getByText("Beatriz Nunes")).toBeInTheDocument();
    expect(within(trigger).getByText("BN")).toBeInTheDocument();
  });

  it("shows the same name and initials whatever the role, without exposing the superadmin", async () => {
    server.use(
      meHandler({ user: buildMeUser({ name: "Ana Coordenadora", role: Role.superadmin }) }),
    );

    await renderUserMenu();

    const trigger = await screen.findByRole("button", {
      name: "Menu do perfil (Ana Coordenadora)",
    });
    expect(within(trigger).getByText("AC")).toBeInTheDocument();
    expect(screen.queryByText(/superadmin/i)).not.toBeInTheDocument();
  });

  it("hides the avatar initials from screen readers", async () => {
    server.use(meHandler({ user: buildMeUser({ role: Role.coordinator }) }));

    await renderUserMenu();

    const trigger = await screen.findByRole("button", { name: /Menu do perfil/ });
    expect(within(trigger).getByText("AC")).toHaveAttribute("aria-hidden", "true");
  });

  it("offers Sair in the menu, calls POST /auth/logout and goes to the login page", async () => {
    let calls = 0;
    server.use(
      meHandler({ user: buildMeUser({ role: Role.coordinator }) }),
      logoutHandler(() => {
        calls += 1;
      }),
    );
    const user = userEvent.setup();

    const { router } = await renderUserMenu();

    await user.click(await screen.findByRole("button", { name: /Menu do perfil/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Sair" }));

    await waitFor(() => expect(calls).toBe(1));
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  });

  it("renders nothing while the session is loading", async () => {
    server.use(
      http.get("*/auth/me", async () => {
        await delay("infinite");
        return HttpResponse.json(buildMeUser());
      }),
    );

    await renderUserMenu();

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders nothing when there is no active session", async () => {
    let called = false;
    server.use(
      meHandler({
        user: null,
        onCall: () => {
          called = true;
        },
      }),
    );

    await renderUserMenu();

    await waitFor(() => expect(called).toBe(true));
    await waitFor(() => expect(screen.queryByRole("button")).not.toBeInTheDocument());
  });
});
