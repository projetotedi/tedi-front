import type { ReactElement } from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Role } from "@shared/lib/role";

import { lessonsMenuItems } from "../menu";
import { lessonsRoutes } from "../routes";
import {
  buildLessonListItem,
  buildLessonsPage,
  buildMeUser,
  buildMeUserWithoutLessons,
  LESSON_ID,
  listClassesHandler,
  listCoursesHandler,
  listLessonPlansHandler,
  listLessonsCalendarHandler,
  listLessonsHandler,
} from "./handlers";
import { renderRoutes, server, setupLessonsTestServer } from "./test-utils";

setupLessonsTestServer();

const lessonsRoute = lessonsRoutes.find((route) => route.path === "lessons");
const calendarRoute = lessonsRoute?.children?.find((child) => child.path === "calendar");
const detailRoute = lessonsRoute?.children?.find((child) => child.path === ":lessonId");

const COMING_SOON = /Esta área ainda está em construção/;

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

  it("has the route where a row and an event go, with no menu item and no title of its own", () => {
    expect(detailRoute).toBeDefined();
    expect(detailRoute?.handle).toBeUndefined();
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
    expect(screen.queryByText(COMING_SOON)).not.toBeInTheDocument();
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
    expect(screen.queryByText(COMING_SOON)).not.toBeInTheDocument();
  });

  it("/lessons/calendar is the calendar, not the lesson that has the id 'calendar'", async () => {
    useScreenHandlers();
    await renderRoutes(lessonsRoutes, { route: "/lessons/calendar" });

    expect(await screen.findByRole("group", { name: "Visualização" })).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Lista de aulas" })).not.toBeInTheDocument();
  });

  it("/lessons/:id shows the placeholder until the screen of the lesson exists (GUS-156)", async () => {
    await renderRoutes(lessonsRoutes, { route: `/lessons/${LESSON_ID}` });

    expect(await screen.findByText(COMING_SOON)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it.each(["/lessons", "/lessons/calendar", `/lessons/${LESSON_ID}`])(
    "shows the forbidden page at %s to someone without lessons.view",
    async (route) => {
      await renderRoutes(lessonsRoutes, { route, user: buildMeUserWithoutLessons() });

      expect(await screen.findByText(/Você não tem acesso/)).toBeInTheDocument();
      expect(screen.queryByText(COMING_SOON)).not.toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    },
  );
});
