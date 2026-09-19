import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Role } from "@shared/lib/role";
import { UNAUTHORIZED_EVENT } from "@shared/lib/session-events";

import { AuthProvider } from "../AuthProvider";
import { useAuth } from "../hooks/useAuth";
import { buildMeUser, meHandler } from "./handlers";
import { renderWithProviders, server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

function AuthProbe() {
  const { status, user } = useAuth();
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="user-name">{user?.name ?? ""}</p>
    </div>
  );
}

describe("useAuth", () => {
  it("calls GET /auth/me once and exposes the user", async () => {
    let calls = 0;
    server.use(
      meHandler({
        user: buildMeUser({ name: "Ana Coordenadora", role: Role.coordinator }),
        onCall: () => {
          calls += 1;
        },
      }),
    );

    await renderWithProviders(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("user-name")).toHaveTextContent("Ana Coordenadora");
    expect(calls).toBe(1);
  });

  it("treats an initial 401 as anonymous without redirecting", async () => {
    server.use(meHandler({ user: null }));

    const { router } = await renderWithProviders(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
      { route: "/" },
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    expect(router.state.location.pathname).toBe("/");
  });

  it("clears the session and redirects to /login?returnTo=...&reason=expired on tedi:unauthorized", async () => {
    server.use(meHandler({ user: buildMeUser({ role: Role.director }) }));

    const { router } = await renderWithProviders(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
      { route: "/people" },
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(router.state.location.search).toBe("?returnTo=%2Fpeople&reason=expired");
  });
});
