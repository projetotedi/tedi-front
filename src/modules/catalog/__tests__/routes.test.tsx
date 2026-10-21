import type { ReactElement } from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Role } from "@shared/lib/role";

import { catalogMenuItems } from "../menu";
import { catalogRoutes } from "../routes";
import { buildMeUser } from "./handlers";
import { renderRoutes, setupCatalogTestServer } from "./test-utils";

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

    expect(await screen.findByRole("heading", { name: "Planos de aula" })).toBeInTheDocument();
  });

  it("shows the forbidden page to someone without catalog.view", async () => {
    const user = buildMeUser(Role.member);
    await renderRoutes(catalogRoutes, {
      route: "/lesson-plans",
      user: { ...user, permissions: { ...user.permissions, "catalog.view": "none" } },
    });

    expect(await screen.findByText(/Você não tem acesso/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Planos de aula" })).not.toBeInTheDocument();
  });
});
