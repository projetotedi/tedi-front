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

function renderProtected(minRole: Role | undefined, route: string) {
  return renderWithProviders(
    <AuthProvider>
      <RequireRole minRole={minRole}>
        <Protected />
      </RequireRole>
      <StatusProbe />
    </AuthProvider>,
    { route },
  );
}

describe("role hierarchy", () => {
  it("renders the child for director and coordinator", async () => {
    server.use(meHandler({ user: buildMeUser({ role: Role.director }) }));
    await renderProtected(Role.director, "/people");
    expect(await screen.findByText("Conteúdo protegido")).toBeInTheDocument();
  });

  it("renders the child for coordinator", async () => {
    server.use(meHandler({ user: buildMeUser({ role: Role.coordinator }) }));
    await renderProtected(Role.director, "/people");
    expect(await screen.findByText("Conteúdo protegido")).toBeInTheDocument();
  });

  it("renders the forbidden page for member and keeps the session", async () => {
    server.use(meHandler({ user: buildMeUser({ role: Role.member }) }));
    await renderProtected(Role.director, "/people");

    expect(await screen.findByText("Você não tem acesso a esta área")).toBeInTheDocument();
    expect(screen.queryByText("Conteúdo protegido")).not.toBeInTheDocument();
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
  });
});

describe("anonymous", () => {
  it("redirects an anonymous user to /login?returnTo=%2Fpeople", async () => {
    server.use(meHandler({ user: null }));
    const { router } = await renderProtected(Role.director, "/people");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
      expect(router.state.location.search).toBe("?returnTo=%2Fpeople");
    });
  });
});

it("requires only an active session when minRole is omitted", async () => {
  server.use(meHandler({ user: buildMeUser({ role: Role.member }) }));
  await renderProtected(undefined, "/");
  expect(await screen.findByText("Conteúdo protegido")).toBeInTheDocument();
});

it("does not redirect nor render children while loading", async () => {
  server.use(
    http.get("*/auth/me", async () => {
      await delay("infinite");
      return HttpResponse.json(buildMeUser());
    }),
  );

  const { router } = await renderProtected(Role.director, "/people");

  expect(screen.getByRole("status")).toHaveTextContent("Carregando sua sessão...");
  expect(screen.queryByText("Conteúdo protegido")).not.toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/people");
});
