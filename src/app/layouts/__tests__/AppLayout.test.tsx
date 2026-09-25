import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { AuthProvider } from "@modules/auth";
import i18n from "@shared/i18n";
import { Role } from "@shared/lib/role";

import { AppLayout } from "../AppLayout";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function meHandler(role: Role) {
  return http.get("*/auth/me", () =>
    HttpResponse.json({ id: "user-1", name: "Ana Torres", ra: null, email: null, role }),
  );
}

function logoutHandler(onCall: () => void) {
  return http.post("*/auth/logout", () => {
    onCall();
    return new HttpResponse(null, { status: 204 });
  });
}

/** O layout real, sob o `AuthProvider`, com duas rotas de teste (uma delas com título no handle). */
async function renderLayout(route: string) {
  await i18n.changeLanguage("pt-BR");

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        element: <AuthProvider />,
        children: [
          { path: "login", element: <p>Tela de login</p> },
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <p>Início</p> },
              {
                path: "access",
                handle: { headerTitle: { ns: "auth", key: "access.title" } },
                element: <p>Conteúdo de acessos</p>,
              },
            ],
          },
        ],
      },
    ],
    { initialEntries: [route] },
  );

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return router;
}

describe("AppLayout", () => {
  it("shows the brand and a single navigation item, active on /access, for a coordinator", async () => {
    server.use(meHandler(Role.coordinator));

    await renderLayout("/access");

    const nav = await screen.findByRole("navigation", { name: "Menu principal" });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName("Membros e Planejamento");
    expect(links[0]).toHaveAttribute("href", "/access");
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("TEDI")).toBeInTheDocument();
    expect(screen.getByText("Gestão do Projeto de Extensão")).toBeInTheDocument();
  });

  it("shows the navigation item to a superadmin", async () => {
    server.use(meHandler(Role.superadmin));

    await renderLayout("/access");

    const nav = await screen.findByRole("navigation", { name: "Menu principal" });
    expect(within(nav).getByRole("link", { name: "Membros e Planejamento" })).toBeInTheDocument();
  });

  it("hides the navigation item from a director", async () => {
    server.use(meHandler(Role.director));

    await renderLayout("/");

    // O menu de perfil só aparece com a sessão carregada: a partir daqui o perfil já é conhecido.
    await screen.findByRole("button", { name: /Menu do perfil/ });
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Membros e Planejamento" })).not.toBeInTheDocument();
  });

  it("does not mark the navigation item as current away from /access", async () => {
    server.use(meHandler(Role.coordinator));

    await renderLayout("/");

    const link = await screen.findByRole("link", { name: "Membros e Planejamento" });
    expect(link).not.toHaveAttribute("aria-current");
  });

  it("shows the route header title as the page heading", async () => {
    server.use(meHandler(Role.coordinator));

    await renderLayout("/access");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Membros e Alocações" }),
    ).toBeInTheDocument();
  });

  it("falls back to the application name when the route has no title", async () => {
    server.use(meHandler(Role.coordinator));

    await renderLayout("/");

    expect(await screen.findByRole("heading", { level: 1, name: "TEDI" })).toBeInTheDocument();
  });

  it("renders the route content in the main region", async () => {
    server.use(meHandler(Role.coordinator));

    await renderLayout("/access");

    expect(within(await screen.findByRole("main")).getByText("Conteúdo de acessos")).toBeVisible();
  });

  it("shows the profile menu in the header", async () => {
    server.use(meHandler(Role.coordinator));

    await renderLayout("/access");

    const banner = await screen.findByRole("banner");
    expect(
      await within(banner).findByRole("button", { name: "Menu do perfil (Coordenadora)" }),
    ).toBeInTheDocument();
  });

  it("signs out from the profile menu", async () => {
    let logoutCalls = 0;
    server.use(
      meHandler(Role.coordinator),
      logoutHandler(() => {
        logoutCalls += 1;
      }),
    );
    const user = userEvent.setup();

    const router = await renderLayout("/access");

    await user.click(await screen.findByRole("button", { name: /Menu do perfil/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Sair" }));

    await waitFor(() => expect(logoutCalls).toBe(1));
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(await screen.findByText("Tela de login")).toBeInTheDocument();
  });

  it("keeps the decorative sidebar images out of the accessibility tree", async () => {
    server.use(meHandler(Role.coordinator));

    await renderLayout("/access");

    await screen.findByRole("navigation", { name: "Menu principal" });
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });
});
