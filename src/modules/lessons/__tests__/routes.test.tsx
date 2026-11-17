import type { ReactElement } from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Role } from "@shared/lib/role";

import { lessonsMenuItems } from "../menu";
import { lessonsRoutes } from "../routes";
import { buildMeUser, buildMeUserWithoutLessons } from "./handlers";
import { renderRoutes, setupLessonsTestServer } from "./test-utils";

setupLessonsTestServer();

const lessonsRoute = lessonsRoutes.find((route) => route.path === "lessons");
const calendarRoute = lessonsRoute?.children?.find((child) => child.path === "calendar");

const COMING_SOON = /Esta área ainda está em construção/;

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

  it.each([
    ["member", Role.member],
    ["director", Role.director],
    ["coordinator", Role.coordinator],
  ])(
    "shows the coming soon page of /lessons and of /lessons/calendar to the %s",
    async (_label, role) => {
      for (const route of ["/lessons", "/lessons/calendar"]) {
        const { unmount } = await renderRoutes(lessonsRoutes, { route, user: buildMeUser(role) });

        expect(await screen.findByText(COMING_SOON), route).toBeInTheDocument();
        unmount();
      }
    },
  );

  it.each(["/lessons", "/lessons/calendar"])(
    "shows the forbidden page at %s to someone without lessons.view",
    async (route) => {
      await renderRoutes(lessonsRoutes, { route, user: buildMeUserWithoutLessons() });

      expect(await screen.findByText(/Você não tem acesso/)).toBeInTheDocument();
      expect(screen.queryByText(COMING_SOON)).not.toBeInTheDocument();
    },
  );
});
