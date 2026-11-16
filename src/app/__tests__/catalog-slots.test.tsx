import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { MeResponseDto } from "@api/generated/model";
import { createCatalogRoutes } from "@modules/catalog";
import {
  buildCourseDetail,
  buildMeUser,
  COURSE_ID,
  COURSE_SMARTPHONES,
  COURSE_SOCIAL_NETWORKS,
  getCourseHandler,
} from "@modules/catalog/__tests__/handlers";
import {
  renderRoutes,
  server,
  setupCatalogTestServer,
} from "@modules/catalog/__tests__/test-utils";
import {
  buildCourseClassesPage,
  buildCourseClassItem,
  CLASS_ID,
  listCourseClassesHandler,
  type ListCourseClassesCall,
} from "@modules/classes/__tests__/handlers";

import { catalogRouteSlots } from "../catalog-slots";

setupCatalogTestServer();

const routes = createCatalogRoutes(catalogRouteSlots);
const COURSE_ROUTE = `/courses/${COURSE_ID}`;

/** The coordinator of the catalog tests, who can also see the classes (`classes.view`). */
function userWithClasses(): MeResponseDto {
  const user = buildMeUser();
  return { ...user, permissions: { ...user.permissions, "classes.view": "all" } };
}

describe("the slots of the catalog, filled by the app", () => {
  it("puts the card of the classes module into the course screen, for the course of the route", async () => {
    const onCall = vi.fn<(call: ListCourseClassesCall) => void>();
    server.use(
      getCourseHandler(),
      listCourseClassesHandler({
        onCall,
        response: buildCourseClassesPage([buildCourseClassItem()], 3),
      }),
    );
    await renderRoutes(routes, { route: COURSE_ROUTE, user: userWithClasses() });

    const table = await screen.findByRole("table", { name: "Turmas deste curso" });

    expect(within(table).getByRole("link", { name: "Turma 2026.1" })).toHaveAttribute(
      "href",
      `/classes/${CLASS_ID}`,
    );
    expect(onCall).toHaveBeenCalledExactlyOnceWith({
      id: COURSE_ID,
      page: null,
      limit: 5,
      status: null,
    });
  });

  it("sits among the cards of the course, after the plan and before the side cards", async () => {
    server.use(getCourseHandler(), listCourseClassesHandler());
    await renderRoutes(routes, { route: COURSE_ROUTE, user: userWithClasses() });
    await screen.findByRole("table", { name: "Turmas deste curso" });

    const titles = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);

    expect(titles.indexOf("Turmas deste curso")).toBe(titles.indexOf("Plano do curso") + 1);
  });

  it("takes 'Ver todas' to the list of classes filtered by the course of the screen", async () => {
    const user = userEvent.setup();
    server.use(
      getCourseHandler(),
      listCourseClassesHandler({
        response: buildCourseClassesPage([buildCourseClassItem()], 12),
      }),
    );
    const { router } = await renderRoutes(routes, { route: COURSE_ROUTE, user: userWithClasses() });

    await user.click(
      await screen.findByRole("link", { name: "Ver todas as 12 turmas deste curso" }),
    );

    await waitFor(() => expect(router.state.location.pathname).toBe("/classes"));
    expect(router.state.location.search).toBe(`?courseId=${COURSE_ID}`);
  });

  it("asks the classes of the course the person moved to, when a prerequisite opens another course", async () => {
    const user = userEvent.setup();
    const onCall = vi.fn<(call: ListCourseClassesCall) => void>();
    server.use(
      getCourseHandler({
        response: (id) =>
          id === COURSE_ID
            ? buildCourseDetail()
            : buildCourseDetail({ id, name: COURSE_SMARTPHONES.courseName, prerequisites: [] }),
      }),
      listCourseClassesHandler({ onCall }),
    );
    await renderRoutes(routes, { route: COURSE_ROUTE, user: userWithClasses() });
    await screen.findByRole("table", { name: "Turmas deste curso" });

    await user.click(screen.getByRole("link", { name: COURSE_SMARTPHONES.courseName }));

    await screen.findByRole("heading", { level: 2, name: COURSE_SMARTPHONES.courseName });
    await waitFor(() => expect(onCall).toHaveBeenCalledTimes(2));
    expect(onCall.mock.calls.map(([call]) => call.id)).toEqual([
      COURSE_ID,
      COURSE_SMARTPHONES.courseId,
    ]);
  });

  it("keeps the course on the screen when only the classes fail, and the card shows its own error", async () => {
    server.use(getCourseHandler(), listCourseClassesHandler({ networkError: true }));
    await renderRoutes(routes, { route: COURSE_ROUTE, user: userWithClasses() });

    expect(
      await screen.findByText("Não foi possível carregar as turmas deste curso."),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 2, name: COURSE_SOCIAL_NETWORKS.courseName }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Plano do curso" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pré-requisitos" })).toBeInTheDocument();
    // The error of the card is the card's: the one of the course screen did not appear.
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("shows the course without the card, and asks nothing, to who cannot see classes", async () => {
    const onCall = vi.fn<(call: ListCourseClassesCall) => void>();
    server.use(getCourseHandler(), listCourseClassesHandler({ onCall }));
    // The coordinator of the catalog tests has `catalog.view` and no `classes.view`.
    await renderRoutes(routes, { route: COURSE_ROUTE, user: buildMeUser() });

    expect(await screen.findByRole("heading", { name: "Plano do curso" })).toBeInTheDocument();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(screen.queryByRole("heading", { name: "Turmas deste curso" })).not.toBeInTheDocument();
    expect(onCall).not.toHaveBeenCalled();
  });
});
