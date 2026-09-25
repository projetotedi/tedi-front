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
  it("shows the role label and its initials for a coordinator", async () => {
    server.use(meHandler({ user: buildMeUser({ role: Role.coordinator }) }));

    await renderUserMenu();

    const trigger = await screen.findByRole("button", { name: "Menu do perfil (Coordenadora)" });
    expect(within(trigger).getByText("Coordenadora")).toBeInTheDocument();
    expect(within(trigger).getByText("CO")).toBeInTheDocument();
  });

  it("shows a superadmin as Coordenadora", async () => {
    server.use(meHandler({ user: buildMeUser({ role: Role.superadmin }) }));

    await renderUserMenu();

    const trigger = await screen.findByRole("button", { name: "Menu do perfil (Coordenadora)" });
    expect(within(trigger).getByText("CO")).toBeInTheDocument();
    expect(screen.queryByText(/superadmin/i)).not.toBeInTheDocument();
  });

  it("shows Diretor(a) for a director", async () => {
    server.use(meHandler({ user: buildMeUser({ role: Role.director }) }));

    await renderUserMenu();

    const trigger = await screen.findByRole("button", { name: "Menu do perfil (Diretor(a))" });
    expect(within(trigger).getByText("Diretor(a)")).toBeInTheDocument();
    expect(within(trigger).getByText("DI")).toBeInTheDocument();
  });

  it("shows Membro for a member", async () => {
    server.use(meHandler({ user: buildMeUser({ role: Role.member }) }));

    await renderUserMenu();

    const trigger = await screen.findByRole("button", { name: "Menu do perfil (Membro)" });
    expect(within(trigger).getByText("Membro")).toBeInTheDocument();
    expect(within(trigger).getByText("ME")).toBeInTheDocument();
  });

  it("hides the avatar initials from screen readers", async () => {
    server.use(meHandler({ user: buildMeUser({ role: Role.coordinator }) }));

    await renderUserMenu();

    const trigger = await screen.findByRole("button", { name: /Menu do perfil/ });
    expect(within(trigger).getByText("CO")).toHaveAttribute("aria-hidden", "true");
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
