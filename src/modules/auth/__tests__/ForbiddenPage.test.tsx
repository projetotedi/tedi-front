import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Role } from "@shared/lib/role";

import { AuthProvider } from "../AuthProvider";
import { RequireRole } from "../components/RequireRole";
import { buildMeUser, meHandler } from "./handlers";
import { renderWithProviders, server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

function renderForbidden(route: string, role: Role, minRole: Role = Role.coordinator) {
  server.use(meHandler({ user: buildMeUser({ role }) }));
  return renderWithProviders(
    <AuthProvider>
      <RequireRole minRole={minRole}>
        <p>Conteúdo protegido</p>
      </RequireRole>
    </AuthProvider>,
    { route },
  );
}

describe("ForbiddenPage (403 do Figma)", () => {
  it("shows the heading, the explanation and the help text", async () => {
    await renderForbidden("/access", Role.member);

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
    await renderForbidden("/access", Role.member);

    await screen.findByRole("heading", { name: "Você não tem acesso a esta tela" });
    expect(screen.getByText("403")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows the required profile and the current profile", async () => {
    await renderForbidden("/access", Role.member);

    expect(
      await screen.findByText("Perfil necessário: Coordenadora · Seu perfil: Membro"),
    ).toBeInTheDocument();
  });

  it("names the director when that is the required profile", async () => {
    await renderForbidden("/people", Role.member, Role.director);

    expect(
      await screen.findByText("Perfil necessário: Diretor(a) · Seu perfil: Membro"),
    ).toBeInTheDocument();
  });

  it("goes back to the previous screen", async () => {
    const user = userEvent.setup();
    // Começa fora de "/" para que "voltar" e "sem tela anterior" (que vai a "/") tenham destinos diferentes.
    const { router } = await renderForbidden("/people", Role.member);
    await screen.findByRole("heading", { name: "Você não tem acesso a esta tela" });
    await router.navigate("/access");
    await user.click(await screen.findByRole("button", { name: "Voltar à tela anterior" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/people"));
  });

  it("goes to the home page when there is no previous screen", async () => {
    const user = userEvent.setup();
    const { router } = await renderForbidden("/access", Role.member);

    await user.click(await screen.findByRole("button", { name: "Voltar à tela anterior" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });

  it("goes to the home page from Ir para Meu perfil (there is no profile screen yet)", async () => {
    const user = userEvent.setup();
    const { router } = await renderForbidden("/access", Role.member);

    await user.click(await screen.findByRole("button", { name: "Ir para Meu perfil" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });
});
