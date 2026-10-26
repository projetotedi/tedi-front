import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

type SidebarNav = Awaited<ReturnType<typeof renderSidebar>>;

/** Os links dos grupos fechados ficam fora da árvore de acessibilidade: abre todos antes de ler. */
async function openAllGroups(nav: SidebarNav) {
  for (const button of nav.getAllByRole("button")) {
    if (button.getAttribute("aria-expanded") === "false") await userEvent.click(button);
  }
}

const groupNames = (nav: SidebarNav) =>
  nav.getAllByRole("button").map((button) => button.textContent);

const linkNames = (nav: SidebarNav) => nav.getAllByRole("link").map((link) => link.textContent);

/** Os itens de um grupo, lidos dentro do painel que o botão dele controla. */
const itemsOf = (nav: SidebarNav, group: string) =>
  within(nav.getByRole("group", { name: group }))
    .getAllByRole("link")
    .map((link) => link.textContent);

describe("Sidebar by permission", () => {
  it("member sees Catálogo, Turmas, Aulas and Pessoas with their items", async () => {
    const nav = await renderSidebar(Role.member);

    expect(groupNames(nav)).toEqual(["Catálogo", "Turmas", "Aulas", "Pessoas"]);

    await openAllGroups(nav);

    expect(itemsOf(nav, "Catálogo")).toEqual(["Cursos", "Planos de aula"]);
    expect(itemsOf(nav, "Turmas")).toEqual(["Turmas"]);
    expect(itemsOf(nav, "Aulas")).toEqual(["Aulas", "Calendário"]);
    expect(itemsOf(nav, "Pessoas")).toEqual(["Alunos"]);
    expect(linkNames(nav)).toEqual([
      "Cursos",
      "Planos de aula",
      "Turmas",
      "Aulas",
      "Calendário",
      "Alunos",
    ]);
  });

  it("member does not see the Horas group, Matrículas nor Membros", async () => {
    const nav = await renderSidebar(Role.member);
    await openAllGroups(nav);

    expect(nav.queryByRole("button", { name: "Horas" })).not.toBeInTheDocument();
    expect(nav.queryByRole("link", { name: "Matrículas" })).not.toBeInTheDocument();
    expect(nav.queryByRole("link", { name: "Membros" })).not.toBeInTheDocument();
    expect(nav.queryByRole("link", { name: "Banco de horas" })).not.toBeInTheDocument();
    expect(nav.queryByRole("link", { name: "Validação de horas" })).not.toBeInTheDocument();
  });

  it("director sees Horas with Banco de horas only", async () => {
    const nav = await renderSidebar(Role.director);

    expect(groupNames(nav)).toEqual(["Catálogo", "Turmas", "Aulas", "Pessoas", "Horas"]);

    await openAllGroups(nav);

    expect(itemsOf(nav, "Horas")).toEqual(["Banco de horas"]);
    expect(itemsOf(nav, "Turmas")).toEqual(["Turmas", "Matrículas"]);
    expect(itemsOf(nav, "Pessoas")).toEqual(["Alunos"]);
    expect(nav.queryByRole("link", { name: "Validação de horas" })).not.toBeInTheDocument();
    expect(nav.queryByRole("link", { name: "Membros" })).not.toBeInTheDocument();
  });

  it("coordinator sees the 5 groups with the 10 Figma items", async () => {
    const nav = await renderSidebar(Role.coordinator);

    expect(groupNames(nav)).toEqual(["Catálogo", "Turmas", "Aulas", "Pessoas", "Horas"]);

    await openAllGroups(nav);

    expect(nav.getAllByRole("link")).toHaveLength(appMenuItems.length);
    expect(itemsOf(nav, "Catálogo")).toEqual(["Cursos", "Planos de aula"]);
    expect(itemsOf(nav, "Turmas")).toEqual(["Turmas", "Matrículas"]);
    expect(itemsOf(nav, "Aulas")).toEqual(["Aulas", "Calendário"]);
    expect(itemsOf(nav, "Pessoas")).toEqual(["Alunos", "Membros"]);
    expect(itemsOf(nav, "Horas")).toEqual(["Banco de horas", "Validação de horas"]);
  });
});
