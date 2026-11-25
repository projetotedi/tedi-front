import type { ReactElement } from "react";
import { screen } from "@testing-library/react";
import { matchRoutes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import i18n from "@shared/i18n";
import { Role } from "@shared/lib/role";
import { findRouteTitle } from "@shared/lib/route-handle";

import { lessonsMenuItems } from "../menu";
import { lessonsRoutes } from "../routes";
import {
  buildLessonListItem,
  buildLessonsPage,
  buildMeUser,
  buildMeUserWithoutLessons,
  getLessonHandler,
  LESSON_ID,
  listClassesHandler,
  listCoursesHandler,
  listLessonPlansHandler,
  listLessonsCalendarHandler,
  listLessonsHandler,
} from "./handlers";
import {
  expectNoRequestBesidesSession,
  renderRoutes,
  server,
  setupLessonsTestServer,
} from "./test-utils";

setupLessonsTestServer();

const lessonsRoute = lessonsRoutes.find((route) => route.path === "lessons");
const calendarRoute = lessonsRoute?.children?.find((child) => child.path === "calendar");
const detailRoute = lessonsRoute?.children?.find((child) => child.path === ":lessonId");

const LESSON_TITLE = "Teclado, mouse e janelas";

/** What the two screens read when they open: the lessons and the options of the filters. */
function useScreenHandlers() {
  server.use(
    listLessonsHandler({ response: buildLessonsPage([buildLessonListItem()]) }),
    listLessonsCalendarHandler({ response: [buildLessonListItem()] }),
    listClassesHandler(),
    listCoursesHandler(),
    listLessonPlansHandler(),
  );
}

describe("lessonsRoutes", () => {
  it("declares the route titles used by the topbar", () => {
    expect(lessonsRoute?.handle).toEqual({ title: "common:nav.lessons" });
    expect(calendarRoute?.handle).toEqual({ title: "common:nav.calendar" });
  });

  it("declares the title Aula for the lesson screen", async () => {
    await i18n.changeLanguage("pt-BR");

    expect(detailRoute?.handle).toEqual({ title: "lessons:detail.routeTitle" });
    expect(i18n.t("lessons:detail.routeTitle")).toBe("Aula");
  });

  it("gives the topbar the title of the innermost route that declares one", () => {
    const titleAt = (path: string) =>
      findRouteTitle(
        (matchRoutes(lessonsRoutes, path) ?? []).map((match) => ({ handle: match.route.handle })),
      );

    expect(titleAt(`/lessons/${LESSON_ID}`)).toBe("lessons:detail.routeTitle");
    expect(titleAt("/lessons")).toBe("common:nav.lessons");
    expect(titleAt("/lessons/calendar")).toBe("common:nav.calendar");
  });

  it("asks for the same permission as the menu items (menu and guard go together)", () => {
    const guard = lessonsRoute?.element as ReactElement<{ permission: string }> | undefined;

    expect(lessonsMenuItems.length).toBeGreaterThan(0);
    for (const item of lessonsMenuItems) {
      expect(item.permission).toBe(guard?.props.permission);
    }
  });

  it("has a route for every menu item, with the title the item shows", () => {
    expect(lessonsMenuItems).toEqual([
      expect.objectContaining({ path: "/lessons", label: "common:nav.lessons", group: "lessons" }),
      expect.objectContaining({
        path: "/lessons/calendar",
        label: "common:nav.calendar",
        group: "lessons",
      }),
    ]);
    expect(lessonsRoute?.children?.some((child) => child.index === true)).toBe(true);
    expect(calendarRoute).toBeDefined();
  });

  it("has the route where a row and an event go, with no menu item", () => {
    expect(detailRoute).toBeDefined();
    expect(lessonsMenuItems.some((item) => item.path.includes(":"))).toBe(false);
  });

  it.each([
    ["member", Role.member],
    ["director", Role.director],
    ["coordinator", Role.coordinator],
  ])("/lessons shows the list of lessons to the %s", async (_label, role) => {
    useScreenHandlers();
    await renderRoutes(lessonsRoutes, { route: "/lessons", user: buildMeUser(role) });

    expect(await screen.findByRole("table", { name: "Lista de aulas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Aulas (1)" })).toBeInTheDocument();
  });

  it.each([
    ["member", Role.member],
    ["director", Role.director],
    ["coordinator", Role.coordinator],
  ])("/lessons/calendar shows the calendar to the %s", async (_label, role) => {
    useScreenHandlers();
    // The month of the lesson is in the URL, so the test does not depend on today's date.
    await renderRoutes(lessonsRoutes, {
      route: "/lessons/calendar?date=2026-03-10",
      user: buildMeUser(role),
    });

    expect(await screen.findByRole("group", { name: "Visualização" })).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: /Teclado, mouse e janelas/ }),
    ).toBeInTheDocument();
  });

  it("/lessons/calendar is the calendar, not the lesson that has the id 'calendar'", async () => {
    const onGet = vi.fn();
    useScreenHandlers();
    server.use(getLessonHandler({ onCall: onGet }));
    await renderRoutes(lessonsRoutes, { route: "/lessons/calendar" });

    expect(await screen.findByRole("group", { name: "Visualização" })).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Lista de aulas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Aula não encontrada" })).not.toBeInTheDocument();
    expect(onGet).not.toHaveBeenCalled();
  });

  it.each(["/lessons", "/lessons/calendar", `/lessons/${LESSON_ID}`])(
    "shows the forbidden page at %s to someone without lessons.view",
    async (route) => {
      await renderRoutes(lessonsRoutes, { route, user: buildMeUserWithoutLessons() });

      expect(await screen.findByText(/Você não tem acesso/)).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    },
  );

  describe("/lessons/:lessonId", () => {
    it("is a child of the guarded route, so it asks for lessons.view like the other two", () => {
      expect(detailRoute).toBeDefined();
      expect(lessonsRoute?.children?.map((child) => child.path ?? "index")).toEqual([
        "index",
        "calendar",
        ":lessonId",
      ]);
    });

    it.each([
      ["member", Role.member],
      ["director", Role.director],
      ["coordinator", Role.coordinator],
    ])("shows the screen of a lesson to the %s", async (_label, role) => {
      server.use(getLessonHandler());
      await renderRoutes(lessonsRoutes, {
        route: `/lessons/${LESSON_ID}`,
        user: buildMeUser(role),
      });

      expect(
        await screen.findByRole("heading", { level: 2, name: LESSON_TITLE }),
      ).toBeInTheDocument();
    });

    it("shows the forbidden page at /lessons/:id to someone without lessons.view", async () => {
      const onGet = vi.fn();
      server.use(getLessonHandler({ onCall: onGet }));
      const { queryClient } = await renderRoutes(lessonsRoutes, {
        route: `/lessons/${LESSON_ID}`,
        user: buildMeUserWithoutLessons(),
      });

      expect(await screen.findByText(/Você não tem acesso/)).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: LESSON_TITLE })).not.toBeInTheDocument();
      expect(onGet).not.toHaveBeenCalled();
      expectNoRequestBesidesSession(queryClient);
    });
  });
});
