import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthProvider } from "../AuthProvider";
import { LoginPage } from "../pages/LoginPage";
import { buildMeUser, meHandler } from "./handlers";
import { renderWithProviders, server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

function renderLoginPage(route: string) {
  return renderWithProviders(
    <AuthProvider>
      <LoginPage />
    </AuthProvider>,
    { route },
  );
}

describe("LoginPage", () => {
  it("shows the expired session message when reason=expired", async () => {
    server.use(meHandler({ user: null }));
    await renderLoginPage("/login?reason=expired");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sua sessão expirou. Entre novamente.",
    );
  });

  it("does not show the expired session message without reason", async () => {
    server.use(meHandler({ user: null }));
    await renderLoginPage("/login");

    await screen.findByRole("heading", { name: "Entrar" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("redirects to returnTo when the session becomes authenticated", async () => {
    server.use(meHandler({ user: buildMeUser() }));
    const { router } = await renderLoginPage("/login?returnTo=%2Fpeople");

    await waitFor(() => expect(router.state.location.pathname).toBe("/people"));
  });

  it("redirects to / when returnTo is an external target", async () => {
    server.use(meHandler({ user: buildMeUser() }));
    const { router } = await renderLoginPage(`/login?returnTo=${encodeURIComponent("//evil.com")}`);

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });
});
