import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Navigate, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import type { MemberDetailResponseDto } from "@api/generated/model";
import { AuthProvider, RequireRole } from "@modules/auth";
import {
  buildMember,
  buildMeUser,
  listInvitesHandler,
  listMembersHandler,
  meHandler,
} from "@modules/auth/__tests__/handlers";
import { server, setupAuthTestServer } from "@modules/auth/__tests__/test-utils";
import { authProtectedRoutes } from "@modules/auth/__tests__/test-routes";
import { getMemberHandler, MEMBER_ID, MEMBER_NAME } from "@modules/people/__tests__/handlers";
import { peopleRoutes } from "@modules/people/__tests__/test-routes";
import i18n from "@shared/i18n";
import { Role } from "@shared/lib/role";

import { AppLayout } from "../layouts/AppLayout";
import { prototypeRoutes } from "../prototype-routes";

setupAuthTestServer();

const MEMBER_ROUTE = `/members/${MEMBER_ID}`;

interface RenderAppOptions {
  member?: MemberDetailResponseDto;
  role?: Role;
  /** Holds the answer of GET /members/:id until the promise settles. */
  delay?: Promise<void>;
}

/**
 * Renders the routes that matter here, in the order of `router.tsx`: the layout, `people`, the
 * prototype areas and the list of members of `auth`. The list has one person, the same as the member.
 */
async function renderApp(
  route: string,
  { member, role = Role.coordinator, delay }: RenderAppOptions = {},
) {
  await i18n.changeLanguage("pt-BR");
  server.use(
    meHandler({ user: buildMeUser({ role, name: "Ana Coordenadora" }) }),
    getMemberHandler({ member, delay }),
    listMembersHandler({ data: [buildMember({ id: MEMBER_ID, name: MEMBER_NAME })] }),
    listInvitesHandler(),
  );

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

  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  // The fixed sidebar is the first navigation; the Drawer is closed.
  const nav = await screen.findByRole("navigation", { name: "Menu principal" });
  return { router, nav };
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** The title of the topbar (the `<h1>`) and the title of the tab. */
function titles(): string[] {
  return [screen.getByRole("heading", { level: 1 }).textContent ?? "", document.title];
}

describe("The member detail inside the app layout", () => {
  // The groups that are open are kept in the session of the tab, and they would leak between tests.
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("uses the static title Membro on the topbar and on the tab, before and after the member arrives", async () => {
    const deferred = createDeferred();
    await renderApp(MEMBER_ROUTE, { delay: deferred.promise });

    // The route gives the title: it does not wait for the member.
    expect(titles()).toEqual(["Membro", "Membro · TEDI"]);
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();

    deferred.resolve();
    expect(await screen.findByRole("heading", { level: 2, name: MEMBER_NAME })).toBeInTheDocument();

    expect(titles()).toEqual(["Membro", "Membro · TEDI"]);
  });

  it("keeps the name of the member out of the title of the tab and of the topbar, and puts it in the trail of the page", async () => {
    await renderApp(MEMBER_ROUTE);
    await screen.findByRole("heading", { level: 2, name: MEMBER_NAME });

    for (const title of titles()) {
      expect(title).not.toMatch(/Beatriz|Nunes|Carvalho/);
    }
    const trail = screen.getByRole("navigation", { name: "Trilha de navegação" });
    expect(within(trail).getByText(MEMBER_NAME)).toHaveAttribute("aria-current", "page");
  });

  it("marks Membros as the current page in the sidebar for the coordinator, with no link of its own for the member", async () => {
    const { nav } = await renderApp(MEMBER_ROUTE);
    await screen.findByRole("heading", { level: 2, name: MEMBER_NAME });

    // The group of the current route (Pessoas) is already open.
    const current = within(nav).getAllByRole("link", { current: "page" });
    expect(current.map((link) => link.textContent)).toEqual(["Membros"]);
    expect(current[0]).toHaveAttribute("href", "/members");
    // No item of the menu points at the member: the way to it is the row of the list.
    const hrefs = within(nav)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs.filter((href) => href?.includes(MEMBER_ID))).toEqual([]);
  });

  it("opens the member from a row of /members", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp("/members");

    // The status cell is neither the link of the name nor a control: the row receives the click.
    const row = await screen.findByRole("row", { name: new RegExp(MEMBER_NAME) });
    await user.click(within(row).getByText("Ativo"));

    // The path that `auth` builds and the route that `people` declares are the same one.
    expect(await screen.findByRole("heading", { level: 2, name: MEMBER_NAME })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(MEMBER_ROUTE);
    expect(titles()).toEqual(["Membro", "Membro · TEDI"]);
  });

  it("opens the member from the link of the name in the row, and the trail leads back to the list", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp("/members");

    await user.click(await screen.findByRole("link", { name: MEMBER_NAME }));
    await screen.findByRole("heading", { level: 2, name: MEMBER_NAME });
    expect(router.state.location.pathname).toBe(MEMBER_ROUTE);

    const trail = screen.getByRole("navigation", { name: "Trilha de navegação" });
    await user.click(within(trail).getByRole("link", { name: "Membros" }));

    expect(await screen.findByRole("heading", { level: 2, name: /^Membros/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/members");
    expect(titles()).toEqual(["Membros", "Membros · TEDI"]);
  });
});
