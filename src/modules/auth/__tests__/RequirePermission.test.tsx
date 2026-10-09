import { screen, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import type { Permission } from "@shared/lib/permissions";
import { Role } from "@shared/lib/role";

import { AuthProvider } from "../AuthProvider";
import { RequirePermission } from "../components/RequirePermission";
import { buildMeUser, meHandler } from "./handlers";
import { renderWithProviders, server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

function renderProtected(permission: Permission, route: string) {
  return renderWithProviders(
    <AuthProvider>
      <RequirePermission permission={permission}>
        <p>Conteúdo protegido</p>
      </RequirePermission>
    </AuthProvider>,
    { route },
  );
}

describe("RequirePermission", () => {
  it("renders the content when the role has the permission", async () => {
    server.use(meHandler({ user: buildMeUser({ role: Role.coordinator }) }));
    await renderProtected("access.manage", "/members");

    expect(await screen.findByText("Conteúdo protegido")).toBeInTheDocument();
  });

  it("renders the forbidden page without changing the URL when the scope is none", async () => {
    server.use(meHandler({ user: buildMeUser({ role: Role.member }) }));
    const { router } = await renderProtected("hours.viewOthers", "/hours");

    expect(await screen.findByText("Você não tem acesso a esta tela")).toBeInTheDocument();
    expect(screen.queryByText("Conteúdo protegido")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/hours");
  });

  it("renders the content for a department-scoped permission (director on hours.viewOthers)", async () => {
    server.use(meHandler({ user: buildMeUser({ role: Role.director }) }));
    await renderProtected("hours.viewOthers", "/hours");

    expect(await screen.findByText("Conteúdo protegido")).toBeInTheDocument();
  });

  it("redirects an anonymous user to /login with returnTo", async () => {
    server.use(meHandler({ user: null }));
    const { router } = await renderProtected("hours.viewOthers", "/hours");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
      expect(router.state.location.search).toBe("?returnTo=%2Fhours");
    });
  });

  it("shows the loading status while the session loads", async () => {
    server.use(
      http.get("*/auth/me", async () => {
        await delay("infinite");
        return HttpResponse.json(buildMeUser());
      }),
    );

    const { router } = await renderProtected("hours.viewOthers", "/hours");

    expect(screen.getByRole("status")).toHaveTextContent("Carregando sua sessão...");
    expect(screen.queryByText("Conteúdo protegido")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/hours");
  });
});
