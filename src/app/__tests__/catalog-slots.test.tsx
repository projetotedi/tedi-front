import { screen, waitFor, within } from "@testing-library/react";
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
  buildArchivedCourseDetail,
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
  listCoursesHandler,
  listEditionsHandler,
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

/** The same coordinator, who can also create classes (`classes.manage`). */
function userWithClassesManage(): MeResponseDto {
  const user = userWithClasses();
  return { ...user, permissions: { ...user.permissions, "classes.manage": "all" } };
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
    server.use(getCourseHandler(), listCourseClassesHandler());
    // The coordinator of the catalog tests has `catalog.view` and no `classes.view`.
    const { queryClient } = await renderRoutes(routes, {
      route: COURSE_ROUTE,
      user: buildMeUser(),
    });

    // The cards of the screen are drawn together, so once the plan is there the card of the
    // classes would be too.
    expect(await screen.findByRole("heading", { name: "Plano do curso" })).toBeInTheDocument();

    expect(screen.queryByRole("heading", { name: "Turmas deste curso" })).not.toBeInTheDocument();
    // Read from the cache of the queries: the classes of the course never ran.
    const classQueries = queryClient
      .getQueryCache()
      .findAll({ queryKey: [`/courses/${COURSE_ID}/classes`] });
    for (const query of classQueries) {
      expect(query.state.fetchStatus).toBe("idle");
      expect(query.state.dataUpdateCount + query.state.errorUpdateCount).toBe(0);
    }
  });

  it("puts + Nova turma last in the header, and it opens the form with the course of the screen", async () => {
    server.use(
      getCourseHandler(),
      listCourseClassesHandler(),
      listCoursesHandler(),
      listEditionsHandler(),
    );
    const user = userEvent.setup();
    await renderRoutes(routes, { route: COURSE_ROUTE, user: userWithClassesManage() });
    const header = (
      await screen.findByRole("heading", { level: 2, name: buildCourseDetail().name })
    ).closest("[data-slot='card']") as HTMLElement;

    const buttons = within(header).getAllByRole("button");
    expect(buttons.at(-1)).toHaveTextContent("+ Nova turma");
    await user.click(within(header).getByRole("button", { name: "+ Nova turma" }));

    const dialog = await screen.findByRole("dialog", { name: "Nova turma" });
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: /Curso/ })).toHaveTextContent(
        "Informática Básica",
      ),
    );
  });

  it("turns + Nova turma off on an archived course", async () => {
    server.use(
      getCourseHandler({ response: buildArchivedCourseDetail() }),
      listCourseClassesHandler(),
    );
    await renderRoutes(routes, { route: COURSE_ROUTE, user: userWithClassesManage() });

    expect(await screen.findByRole("button", { name: "+ Nova turma" })).toBeDisabled();
  });

  it("has no + Nova turma for who cannot manage classes", async () => {
    server.use(getCourseHandler(), listCourseClassesHandler());
    await renderRoutes(routes, { route: COURSE_ROUTE, user: userWithClasses() });
    await screen.findByRole("table", { name: "Turmas deste curso" });

    expect(screen.queryByRole("button", { name: "+ Nova turma" })).not.toBeInTheDocument();
  });
});
