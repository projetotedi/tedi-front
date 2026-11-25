import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { createMemoryRouter, Navigate, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccessibilityNeed, type StudentDetailDto } from "@api/generated/model";
import { AuthProvider, RequireRole } from "@modules/auth";
import { buildMeUser, meHandler } from "@modules/auth/__tests__/handlers";
import { server, setupAuthTestServer } from "@modules/auth/__tests__/test-utils";
import {
  buildStudentDetail,
  getStudentHandler,
  STUDENT_ID,
  STUDENT_NAME,
} from "@modules/people/__tests__/handlers";
import { peopleRoutes } from "@modules/people/__tests__/test-routes";
import i18n from "@shared/i18n";
import { Role } from "@shared/lib/role";

import { AppLayout } from "../layouts/AppLayout";
import { prototypeRoutes } from "../prototype-routes";

setupAuthTestServer();

const STUDENT_ROUTE = `/students/${STUDENT_ID}`;

interface RenderAppOptions {
  student?: StudentDetailDto;
  /** Holds the answer of GET /students/:id until the promise settles. */
  delay?: Promise<void>;
  onGet?: (call: { id: string }) => void;
}

/** Renders the routes that matter here: the layout, `people` and the prototype areas. */
async function renderApp(route: string, { student, delay, onGet }: RenderAppOptions = {}) {
  await i18n.changeLanguage("pt-BR");
  server.use(
    meHandler({ user: buildMeUser({ role: Role.coordinator, name: "Ana Coordenadora" }) }),
    getStudentHandler({ student, delay, onCall: onGet }),
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

describe("The student detail inside the app layout", () => {
  // The groups that are open are kept in the session of the tab, and they would leak between tests.
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("uses the static title Aluno on the topbar and on the tab, before and after the student arrives", async () => {
    const deferred = createDeferred();
    await renderApp(STUDENT_ROUTE, { delay: deferred.promise });

    // The route gives the title: it does not wait for the student.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Aluno$/);
    expect(document.title).toBe("Aluno · TEDI");
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();

    deferred.resolve();
    expect(
      await screen.findByRole("heading", { level: 2, name: STUDENT_NAME }),
    ).toBeInTheDocument();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Aluno$/);
    expect(document.title).toBe("Aluno · TEDI");
  });

  it("keeps the name and the accessibility of the student out of the title of the tab and of the topbar", async () => {
    await renderApp(STUDENT_ROUTE);
    await screen.findByRole("heading", { level: 2, name: STUDENT_NAME });

    // The page does show them (the h2 of the header and the tag); the titles do not.
    expect(screen.getByText("Acessibilidade: visual")).toBeInTheDocument();
    for (const title of titles()) {
      expect(title).not.toMatch(/Maria|Silva|Santos/);
      expect(title).not.toMatch(/visual|acessibilidade/i);
    }
  });

  it("keeps the title just as static for an archived student with another category", async () => {
    await renderApp(STUDENT_ROUTE, {
      student: buildStudentDetail({
        accessibilityNeed: AccessibilityNeed.hearing,
        archivedAt: "2026-10-10T13:00:00.000Z",
        archiveReason: "Mudou de cidade",
      }),
    });
    await screen.findByRole("heading", { level: 2, name: STUDENT_NAME });

    expect(screen.getByText("Acessibilidade: auditiva")).toBeInTheDocument();
    expect(titles()).toEqual(["Aluno", "Aluno · TEDI"]);
  });

  it("marks Alunos as the current page in the sidebar, with no link of its own for the student", async () => {
    const { nav } = await renderApp(STUDENT_ROUTE);
    await screen.findByRole("heading", { level: 2, name: STUDENT_NAME });

    // The group of the current route (Pessoas) is already open.
    const current = within(nav).getAllByRole("link", { current: "page" });
    expect(current.map((link) => link.textContent)).toEqual(["Alunos"]);
    expect(current[0]).toHaveAttribute("href", "/students");
    // No item of the menu points at the student: there is no list of students to open it from yet.
    const hrefs = within(nav)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs.filter((href) => href?.includes(STUDENT_ID))).toEqual([]);
  });

  it("keeps /students as the Em breve page of the prototype, and does not ask for a student there", async () => {
    const onGet = vi.fn();
    const { nav } = await renderApp("/students", { onGet });

    expect(await screen.findByText(/chega em breve/)).toBeInTheDocument();
    expect(titles()).toEqual(["Alunos", "Alunos · TEDI"]);
    expect(
      within(nav)
        .getAllByRole("link", { current: "page" })
        .map((link) => link.textContent),
    ).toEqual(["Alunos"]);
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    expect(onGet).not.toHaveBeenCalled();
  });
});
