import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Navigate, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { authProtectedRoutes, authRoutes, AuthProvider, RequireRole } from "@modules/auth";
import { buildMeUser, loginHandler, meHandler } from "@modules/auth/__tests__/handlers";
import { server, setupAuthTestServer } from "@modules/auth/__tests__/test-utils";
import { peopleRoutes } from "@modules/people";
import i18n from "@shared/i18n";
import { Role } from "@shared/lib/role";

import { AppLayout } from "../layouts/AppLayout";
import { prototypeRoutes } from "../prototype-routes";

setupAuthTestServer();

describe("login writes the permissions to the session cache", () => {
  it("member signs in, the sidebar hides the Horas group and /auth/me is not requested again", async () => {
    await i18n.changeLanguage("pt-BR");
    let meCalls = 0;
    server.use(
      meHandler({
        user: null,
        onCall: () => {
          meCalls += 1;
        },
      }),
      loginHandler({ user: buildMeUser({ role: Role.member, name: "Maria Souza" }) }),
    );

    const router = createMemoryRouter(
      [
        {
          element: <AuthProvider />,
          children: [
            ...authRoutes,
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
      { initialEntries: ["/login"] },
    );
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Matrícula (RA)"), "202400001");
    await user.type(screen.getByLabelText("Senha"), "senha-segura-1");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    const nav = await screen.findByRole("navigation", { name: "Menu principal" });
    await waitFor(() => expect(router.state.location.pathname).toBe("/profile"));
    expect(within(nav).queryByRole("button", { name: "Horas" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Banco de horas" })).not.toBeInTheDocument();

    // /profile não pertence a nenhum grupo: Cursos só aparece depois de abrir Catálogo.
    expect(within(nav).queryByRole("link", { name: "Cursos" })).not.toBeInTheDocument();
    await user.click(within(nav).getByRole("button", { name: "Catálogo" }));
    expect(within(nav).getByRole("link", { name: "Cursos" })).toBeInTheDocument();
    expect(meCalls).toBe(1);
  });
});
