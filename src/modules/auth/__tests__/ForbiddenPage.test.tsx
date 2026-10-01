import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { Permission } from "@shared/lib/permissions";
import { Role } from "@shared/lib/role";

import { AuthProvider } from "../AuthProvider";
import { RequirePermission } from "../components/RequirePermission";
import { buildMeUser, meHandler } from "./handlers";
import { renderWithProviders, server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

function renderForbidden(route: string, role: Role, permission: Permission = "access.manage") {
  server.use(meHandler({ user: buildMeUser({ role }) }));
  return renderWithProviders(
    <AuthProvider>
      <RequirePermission permission={permission}>
        <p>Conteúdo protegido</p>
      </RequirePermission>
    </AuthProvider>,
    { route },
  );
}

describe("ForbiddenPage (403 do Figma)", () => {
  it("shows the heading, the explanation and the help text", async () => {
    await renderForbidden("/members", Role.member);

    expect(
      await screen.findByRole("heading", { level: 2, name: "Você não tem acesso a esta tela" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Esta área é da coordenação\./)).toBeInTheDocument();
    expect(
      screen.getByText(/Precisa deste acesso para alguma tarefa do projeto\?/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Conteúdo protegido")).not.toBeInTheDocument();
  });

  it("hides the decorative 403 numeral from screen readers", async () => {
    await renderForbidden("/members", Role.member);

    await screen.findByRole("heading", { name: "Você não tem acesso a esta tela" });
    expect(screen.getByText("403")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows the current profile", async () => {
    await renderForbidden("/members", Role.member);

    expect(await screen.findByText("Seu perfil: Membro")).toBeInTheDocument();
    expect(screen.queryByText(/Perfil necessário/)).not.toBeInTheDocument();
  });

  it("goes back to the previous screen", async () => {
    const user = userEvent.setup();
    // Começa fora de "/" para que "voltar" e "sem tela anterior" (que vai a "/") tenham destinos diferentes.
    const { router } = await renderForbidden("/people", Role.member);
    await screen.findByRole("heading", { name: "Você não tem acesso a esta tela" });
    await router.navigate("/members");
    await user.click(await screen.findByRole("button", { name: "Voltar à tela anterior" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/people"));
  });

  it("goes to the home page when there is no previous screen", async () => {
    const user = userEvent.setup();
    const { router } = await renderForbidden("/members", Role.member);

    await user.click(await screen.findByRole("button", { name: "Voltar à tela anterior" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });

  it("goes to Meu perfil from Ir para Meu perfil", async () => {
    const user = userEvent.setup();
    const { router } = await renderForbidden("/members", Role.member);

    await user.click(await screen.findByRole("button", { name: "Ir para Meu perfil" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/profile"));
  });
});
