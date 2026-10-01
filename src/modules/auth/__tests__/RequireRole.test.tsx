import { screen, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { Role } from "@shared/lib/role";

import { AuthProvider } from "../AuthProvider";
import { useAuth } from "../hooks/useAuth";
import { buildMeUser, meHandler } from "./handlers";
import { RequireRole } from "../components/RequireRole";
import { renderWithProviders, server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

function Protected() {
  return <p>Conteúdo protegido</p>;
}

function StatusProbe() {
  const { status } = useAuth();
  return <p data-testid="status">{status}</p>;
}

function renderProtected(route: string) {
  return renderWithProviders(
    <AuthProvider>
      <RequireRole>
        <Protected />
      </RequireRole>
      <StatusProbe />
    </AuthProvider>,
    { route },
  );
}

describe("anonymous", () => {
  it("redirects an anonymous user to /login?returnTo=%2Fpeople", async () => {
    server.use(meHandler({ user: null }));
    const { router } = await renderProtected("/people");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
      expect(router.state.location.search).toBe("?returnTo=%2Fpeople");
    });
  });
});

it("requires only an active session", async () => {
  server.use(meHandler({ user: buildMeUser({ role: Role.member }) }));
  await renderProtected("/");
  expect(await screen.findByText("Conteúdo protegido")).toBeInTheDocument();
});

it("does not redirect nor render children while loading", async () => {
  server.use(
    http.get("*/auth/me", async () => {
      await delay("infinite");
      return HttpResponse.json(buildMeUser());
    }),
  );

  const { router } = await renderProtected("/people");

  expect(screen.getByRole("status")).toHaveTextContent("Carregando sua sessão...");
  expect(screen.queryByText("Conteúdo protegido")).not.toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/people");
});
