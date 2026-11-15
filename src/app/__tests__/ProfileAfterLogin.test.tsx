import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Navigate, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { authProtectedRoutes, authRoutes, AuthProvider, RequireRole } from "@modules/auth";
import { buildMeUser, loginHandler, meHandler } from "@modules/auth/__tests__/handlers";
import { server, setupAuthTestServer } from "@modules/auth/__tests__/test-utils";
import { peopleRoutes } from "@modules/people";
import { myProfileHandler } from "@modules/people/__tests__/handlers";
import i18n from "@shared/i18n";
import { Role } from "@shared/lib/role";

import { AppLayout } from "../layouts/AppLayout";
import { prototypeRoutes } from "../prototype-routes";

setupAuthTestServer();

describe("My profile right after signing in", () => {
  it("member signs in and lands on My profile with the registration data", async () => {
    await i18n.changeLanguage("pt-BR");
    server.use(
      meHandler({ user: null }),
      loginHandler({ user: buildMeUser({ role: Role.member, name: "Ana Torres" }) }),
      myProfileHandler(),
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

    await waitFor(() => expect(router.state.location.pathname).toBe("/profile"));

    // The registration of the member, as GET /members/me returns it.
    expect(await screen.findByText("Monitora de informática")).toBeInTheDocument();
    const chips = screen.getByText("RA a2210001").closest("ul");
    if (!(chips instanceof HTMLElement)) throw new Error("No chip list in the header");
    expect(within(chips).getByText("Tecnologia")).toBeInTheDocument();
    expect(within(chips).getByText("Desde 01/10/2026")).toBeInTheDocument();
    expect(screen.getByText("Sistemas de Informação")).toBeInTheDocument();
  });
});
