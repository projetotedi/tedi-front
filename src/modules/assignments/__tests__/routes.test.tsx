import type { ReactElement } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { Role } from "@shared/lib/role";

import { assignmentsMenuItems } from "../menu";
import { assignmentsRoutes } from "../routes";
import {
  buildMeUser,
  buildMeUserWithoutManageOwn,
  listMyAssignmentsHandler,
  listOpenLessonsHandler,
  listPendingApplicationsHandler,
} from "./handlers";
import { expectNoRequestTo, renderRoutes, server, setupAssignmentsTestServer } from "./test-utils";

setupAssignmentsTestServer();

beforeEach(() => {
  server.use(
    listMyAssignmentsHandler(),
    listOpenLessonsHandler(),
    listPendingApplicationsHandler(),
  );
});

const myLessonsRoute = assignmentsRoutes.find((route) => route.path === "my-lessons");

describe("assignmentsRoutes", () => {
  it("declares the route title used by the topbar: Minhas aulas", () => {
    expect(myLessonsRoute?.handle).toEqual({ title: "common:nav.myLessons" });
  });

  it("asks for the same permission as the menu item (menu and guard go together)", () => {
    const guard = myLessonsRoute?.element as ReactElement<{ permission: string }> | undefined;

    expect(assignmentsMenuItems.length).toBeGreaterThan(0);
    for (const item of assignmentsMenuItems) {
      expect(item.permission).toBe("assignments.manageOwn");
      expect(item.permission).toBe(guard?.props.permission);
    }
  });

  it("has a route for every menu item, with the title the item shows", () => {
    expect(assignmentsMenuItems).toEqual([
      expect.objectContaining({
        path: "/my-lessons",
        label: "common:nav.myLessons",
        permission: "assignments.manageOwn",
        group: "lessons",
      }),
    ]);
    expect(myLessonsRoute?.path).toBe("my-lessons");
  });

  it.each([
    ["member", Role.member],
    ["director", Role.director],
    ["coordinator", Role.coordinator],
    ["superadmin", Role.superadmin],
  ])("opens Minhas aulas for the %s", async (_label, role) => {
    await renderRoutes(assignmentsRoutes, { route: "/my-lessons", user: buildMeUser(role) });

    expect(
      await screen.findByRole("heading", { name: "Minhas próximas aulas" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Aulas com vaga para candidatura (3)" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Você não tem acesso/)).not.toBeInTheDocument();
  });

  it("shows the queue button to who reviews, and not to the member", async () => {
    const reviewer = await renderRoutes(assignmentsRoutes, {
      route: "/my-lessons",
      user: buildMeUser(Role.coordinator),
    });
    expect(
      await screen.findByRole("button", { name: "Candidaturas pendentes (3)" }),
    ).toBeInTheDocument();
    reviewer.unmount();

    const member = await renderRoutes(assignmentsRoutes, {
      route: "/my-lessons",
      user: buildMeUser(Role.member),
    });
    await screen.findByRole("heading", { name: "Minhas próximas aulas" });
    expect(
      screen.queryByRole("button", { name: /Candidaturas pendentes/ }),
    ).not.toBeInTheDocument();
    expectNoRequestTo(member.queryClient, "/applications");
  });

  it("shows the forbidden page to someone without assignments.manageOwn, and asks nothing of the API", async () => {
    const { queryClient } = await renderRoutes(assignmentsRoutes, {
      route: "/my-lessons",
      user: buildMeUserWithoutManageOwn(),
    });

    expect(await screen.findByText(/Você não tem acesso/)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Minhas próximas aulas" }),
    ).not.toBeInTheDocument();
    expectNoRequestTo(queryClient, "/me/assignments");
    expectNoRequestTo(queryClient, "/me/open-lessons");
    expectNoRequestTo(queryClient, "/applications");
  });

  it("sends someone who is not logged in to the login", async () => {
    const { router } = await renderRoutes(assignmentsRoutes, { route: "/my-lessons", user: null });

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(router.state.location.search).toContain("returnTo=%2Fmy-lessons");
    expect(
      screen.queryByRole("heading", { name: "Minhas próximas aulas" }),
    ).not.toBeInTheDocument();
  });

  it("puts the agenda inside the tables of the page, not in the topbar", async () => {
    await renderRoutes(assignmentsRoutes, { route: "/my-lessons" });

    const upcoming = await screen.findByRole("table", {
      name: "Suas próximas aulas, com data, horário, turma, aula, papel e situação",
    });
    expect(within(upcoming).getAllByRole("row")).toHaveLength(4);
  });
});
