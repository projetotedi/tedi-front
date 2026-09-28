import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Navigate, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { MeResponseDto } from "@api/generated/model";
import { authProtectedRoutes, AuthProvider, RequireRole } from "@modules/auth";
import { buildMeUser, logoutHandler, meHandler } from "@modules/auth/__tests__/handlers";
import { server, setupAuthTestServer } from "@modules/auth/__tests__/test-utils";
import { peopleRoutes } from "@modules/people";
import i18n from "@shared/i18n";
import { Role } from "@shared/lib/role";

import { AppLayout } from "../layouts/AppLayout";
import { prototypeRoutes } from "../prototype-routes";

setupAuthTestServer();

async function renderApp(user: MeResponseDto, route = "/") {
  await i18n.changeLanguage("pt-BR");
  server.use(meHandler({ user }));

  const router = createMemoryRouter(
    [
      {
        element: <AuthProvider />,
        children: [
          { path: "login", element: <p>Tela de login</p> },
          {
            element: <RequireRole />,
            children: [
              {
                element: <AppLayout />,
                children: [
                  { index: true, element: <Navigate to="/profile" replace /> },
                  ...peopleRoutes,
                  ...prototypeRoutes,
                  ...authProtectedRoutes,
                ],
              },
            ],
          },
        ],
      },
    ],
    { initialEntries: [route] },
  );

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  // A sidebar fixa e o Drawer usam a mesma lista; a sidebar é a primeira navegação.
  const nav = await screen.findByRole("navigation", { name: "Menu principal" });
  return { router, nav };
}

describe("AppLayout", () => {
  it("shows Access to the coordinator", async () => {
    const { nav } = await renderApp(buildMeUser({ role: Role.coordinator }));

    expect(within(nav).getByRole("link", { name: "Acessos" })).toHaveAttribute("href", "/access");
    expect(within(nav).getByRole("link", { name: "Cursos" })).toBeInTheDocument();
  });

  it.each([Role.director, Role.member])("hides Access from the %s", async (role) => {
    const { nav } = await renderApp(buildMeUser({ role }));

    expect(within(nav).getByRole("link", { name: "Banco de Horas" })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Acessos" })).not.toBeInTheDocument();
  });

  it.each([
    [Role.member, "Membro"],
    [Role.director, "Diretor"],
    [Role.coordinator, "Coordenadora"],
  ])("renders the user name and the translated %s role", async (role, label) => {
    await renderApp(buildMeUser({ name: "Maria Souza", role }));

    const trigger = screen.getByRole("button", { name: "Menu do perfil de Maria Souza" });
    expect(trigger).toHaveTextContent(label);

    await userEvent.click(trigger);

    const menu = await screen.findByRole("menu");
    const popover = menu.parentElement as HTMLElement;
    expect(within(popover).getByText("Maria Souza")).toBeInTheDocument();
    expect(within(popover).getByText(label)).toBeInTheDocument();
  });

  it("lands on My profile after sign in and uses the route title in the topbar", async () => {
    const { router } = await renderApp(buildMeUser());

    await waitFor(() => expect(router.state.location.pathname).toBe("/profile"));
    expect(screen.getByRole("heading", { level: 1, name: "Meu perfil" })).toBeInTheDocument();
    expect(document.title).toBe("Meu perfil · TEDI");
  });

  it("reaches the sign out item with the keyboard", async () => {
    let calls = 0;
    const user = userEvent.setup();
    const { router } = await renderApp(buildMeUser({ name: "Maria Souza" }));
    server.use(
      logoutHandler(() => {
        calls += 1;
      }),
    );

    const trigger = screen.getByRole("button", { name: "Menu do perfil de Maria Souza" });
    while (document.activeElement !== trigger) {
      await user.tab();
    }
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");
    await user.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => expect(calls).toBe(1));
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  });

  it("opens the profile from the profile menu", async () => {
    const { router } = await renderApp(buildMeUser({ name: "Maria Souza" }), "/courses");

    await userEvent.click(screen.getByRole("button", { name: "Menu do perfil de Maria Souza" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Perfil" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/profile"));
  });

  it("collapses the menu behind an accessible button on small screens", async () => {
    await renderApp(buildMeUser({ role: Role.coordinator }));

    const button = screen.getByRole("button", { name: "Abrir menu" });
    expect(button).toHaveAttribute("aria-controls", "app-menu");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveClass("min-h-11", "min-w-11");

    fireEvent.click(button);

    const drawer = await screen.findByRole("dialog", { name: "Menu principal" });
    expect(drawer).toHaveAttribute("id", "app-menu");
    expect(button).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(within(drawer).getByRole("link", { name: "Acessos" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Menu principal" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("heading", { level: 1, name: "Acessos" })).toBeInTheDocument();
  });

  it("shows the coming soon page for prototype areas", async () => {
    await renderApp(buildMeUser(), "/students");

    expect(await screen.findByRole("heading", { level: 1, name: "Alunos" })).toBeInTheDocument();
    expect(screen.getByText(/ainda está em construção/)).toBeInTheDocument();
  });

  it("blocks Access for a member even through the URL", async () => {
    await renderApp(buildMeUser({ role: Role.member }), "/access");

    expect(await screen.findByText("Você não tem acesso a esta área")).toBeInTheDocument();
  });
});
