import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { authProtectedRoutes, AuthProvider, RequireRole } from "@modules/auth";
import { buildMeUser, meHandler } from "@modules/auth/__tests__/handlers";
import { server, setupAuthTestServer } from "@modules/auth/__tests__/test-utils";
import i18n from "@shared/i18n";
import { Role } from "@shared/lib/role";

import { AppLayout } from "../layouts/AppLayout";
import { appMenuItems } from "../menu";
import { prototypeRoutes } from "../prototype-routes";

setupAuthTestServer();

/** Renderiza o AppLayout real com o perfil e devolve a sidebar fixa (primeira navegação). */
async function renderSidebar(role: Role) {
  await i18n.changeLanguage("pt-BR");
  server.use(meHandler({ user: buildMeUser({ role }) }));

  const router = createMemoryRouter(
    [
      {
        element: <AuthProvider />,
        children: [
          {
            element: <RequireRole />,
            children: [
              {
                element: <AppLayout />,
                children: [...prototypeRoutes, ...authProtectedRoutes],
              },
            ],
          },
        ],
      },
    ],
    { initialEntries: ["/courses"] },
  );

  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return within(await screen.findByRole("navigation", { name: "Menu principal" }));
}

const labels = (nav: Awaited<ReturnType<typeof renderSidebar>>) =>
  nav.getAllByRole("link").map((link: HTMLElement) => link.textContent);

describe("Sidebar by permission", () => {
  it("member sees only Cursos, Planos de aula, Turmas, Alunos and Aulas", async () => {
    const nav = await renderSidebar(Role.member);

    expect(labels(nav)).toEqual(["Cursos", "Planos de aula", "Turmas", "Alunos", "Aulas"]);
  });

  it("member does not see Membros e Planejamento, Matrículas nor Banco de Horas", async () => {
    const nav = await renderSidebar(Role.member);

    expect(nav.queryByRole("link", { name: "Membros e Planejamento" })).not.toBeInTheDocument();
    expect(nav.queryByRole("link", { name: "Matrículas" })).not.toBeInTheDocument();
    expect(nav.queryByRole("link", { name: "Banco de Horas" })).not.toBeInTheDocument();
  });

  it("director sees every item except Membros e Planejamento (until GUS-109)", async () => {
    const nav = await renderSidebar(Role.director);

    expect(labels(nav)).toEqual([
      "Cursos",
      "Planos de aula",
      "Turmas",
      "Alunos",
      "Aulas",
      "Matrículas",
      "Banco de Horas",
    ]);
  });

  it("coordinator sees every item", async () => {
    const nav = await renderSidebar(Role.coordinator);

    expect(nav.getAllByRole("link")).toHaveLength(appMenuItems.length);
    expect(nav.getByRole("link", { name: "Membros e Planejamento" })).toBeInTheDocument();
  });
});
