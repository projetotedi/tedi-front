import type { ReactElement } from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import i18n from "@shared/i18n";
import { Role } from "@shared/lib/role";

import { classesMenuItems } from "../menu";
import { classesRoutes } from "../routes";
import { buildMeUser, CLASS_ID, CLASS_NAME, getClassHandler } from "./handlers";
import { renderRoutes, server, setupClassesTestServer } from "./test-utils";

setupClassesTestServer();

const listRoute = classesRoutes.find((route) => route.path === "classes");
const detailRoute = listRoute?.children?.find((child) => child.path === ":classId");

describe("classesRoutes (list)", () => {
  it("declares the route title used by the topbar", () => {
    expect(listRoute?.handle).toEqual({ title: "common:nav.classes" });
  });

  it("asks for the same permission as the menu item (menu and guard go together)", () => {
    const guard = listRoute?.element as ReactElement<{ permission: string }> | undefined;

    expect(guard?.props.permission).toBe(classesMenuItems[0]?.permission);
  });
});

describe("classesRoutes (class detail)", () => {
  const route = `/classes/${CLASS_ID}`;

  it("declares the detail title used by the topbar, and it is translated", () => {
    expect(detailRoute?.handle).toEqual({ title: "classes:detail.routeTitle" });
    expect(i18n.t("classes:detail.routeTitle", { lng: "pt-BR" })).toBe("Turma");
    expect(i18n.t("classes:detail.routeTitle", { lng: "en-US" })).toBe("Class");
  });

  it("asks for classes.view, the permission of the whole module", () => {
    const guard = detailRoute?.element as ReactElement<{ permission: string }> | undefined;

    expect(guard?.props.permission).toBe("classes.view");
  });

  it.each([
    ["member", Role.member],
    ["director", Role.director],
    ["coordinator", Role.coordinator],
  ])("the %s can open /classes/:id", async (_label, role) => {
    server.use(getClassHandler());
    await renderRoutes(classesRoutes, { route, user: buildMeUser(role) });

    expect(await screen.findByRole("heading", { name: CLASS_NAME })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dados da turma" })).toBeInTheDocument();
  });

  it("shows the forbidden page at /classes/:id to someone without classes.view, with no request for the class", async () => {
    let requested = false;
    server.use(
      getClassHandler({
        onCall: () => {
          requested = true;
        },
      }),
    );
    const user = buildMeUser(Role.member);
    await renderRoutes(classesRoutes, {
      route,
      user: { ...user, permissions: { ...user.permissions, "classes.view": "none" } },
    });

    expect(await screen.findByText(/Você não tem acesso/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Dados da turma" })).not.toBeInTheDocument();
    expect(requested).toBe(false);
  });
});
