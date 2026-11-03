import type { ReactElement } from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import i18n from "@shared/i18n";
import { Role } from "@shared/lib/role";

import { catalogMenuItems } from "../menu";
import { catalogRoutes } from "../routes";
import { buildMeUser, getLessonPlanHandler, LESSON_PLAN_ID } from "./handlers";
import { renderRoutes, server, setupCatalogTestServer } from "./test-utils";

setupCatalogTestServer();

describe("catalogMenuItems", () => {
  it("has the Planos de aula item, which needs catalog.view", () => {
    expect(catalogMenuItems).toEqual([
      expect.objectContaining({
        label: "common:nav.lessonPlans",
        path: "/lesson-plans",
        permission: "catalog.view",
      }),
    ]);
  });

  it("points every item to a declared route", () => {
    const declared = catalogRoutes.map((route) => `/${route.path}`);

    for (const item of catalogMenuItems) {
      expect(declared).toContain(item.path);
    }
  });

  it("asks for the same permission as the route guard (menu and guard go together)", () => {
    const route = catalogRoutes.find((candidate) => candidate.path === "lesson-plans");
    const guard = route?.element as ReactElement<{ permission: string }> | undefined;

    expect(guard?.props.permission).toBe(catalogMenuItems[0]?.permission);
  });
});

describe("catalogRoutes", () => {
  it("declares the route title used by the topbar", () => {
    expect(catalogRoutes[0]?.handle).toEqual({ title: "common:nav.lessonPlans" });
  });

  it.each([
    ["member", Role.member],
    ["director", Role.director],
    ["coordinator", Role.coordinator],
  ])("the %s can open /lesson-plans", async (_label, role) => {
    await renderRoutes(catalogRoutes, { route: "/lesson-plans", user: buildMeUser(role) });

    expect(
      await screen.findByRole("heading", { name: /Planos de aula \(\d+\)/ }),
    ).toBeInTheDocument();
  });

  it("shows the forbidden page to someone without catalog.view", async () => {
    const user = buildMeUser(Role.member);
    await renderRoutes(catalogRoutes, {
      route: "/lesson-plans",
      user: { ...user, permissions: { ...user.permissions, "catalog.view": "none" } },
    });

    expect(await screen.findByText(/Você não tem acesso/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Planos de aula/ })).not.toBeInTheDocument();
  });
});

describe("catalogRoutes (lesson plan detail)", () => {
  const detailRoute = `/lesson-plans/${LESSON_PLAN_ID}`;

  it("declares the detail title used by the topbar, and it is translated", async () => {
    const detail = catalogRoutes[0]?.children?.find((child) => child.path === ":lessonPlanId");

    expect(detail?.handle).toEqual({ title: "catalog:detail.routeTitle" });
    expect(i18n.t("catalog:detail.routeTitle", { lng: "pt-BR" })).toBe("Plano de aula");
    expect(i18n.t("catalog:detail.routeTitle", { lng: "en-US" })).toBe("Lesson plan");
  });

  it.each([
    ["member", Role.member],
    ["director", Role.director],
    ["coordinator", Role.coordinator],
  ])("the %s can open /lesson-plans/:id", async (_label, role) => {
    server.use(getLessonPlanHandler());
    await renderRoutes(catalogRoutes, { route: detailRoute, user: buildMeUser(role) });

    expect(
      await screen.findByRole("heading", { name: "Dados do plano de aula" }),
    ).toBeInTheDocument();
  });

  it("shows the forbidden page at /lesson-plans/:id to someone without catalog.view", async () => {
    server.use(getLessonPlanHandler());
    const user = buildMeUser(Role.member);
    await renderRoutes(catalogRoutes, {
      route: detailRoute,
      user: { ...user, permissions: { ...user.permissions, "catalog.view": "none" } },
    });

    expect(await screen.findByText(/Você não tem acesso/)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Dados do plano de aula" }),
    ).not.toBeInTheDocument();
  });
});
