import type { ReactElement } from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buildMeUser, meHandler } from "@modules/auth/__tests__/handlers";
import { renderRoutes, server, setupAuthTestServer } from "@modules/auth/__tests__/test-utils";
import i18n from "@shared/i18n";
import { Role } from "@shared/lib/role";

// Registers the "people" namespace.
import "../index";
import { peopleRoutes } from "../routes";
import { buildStudentDetail, getStudentHandler, myProfileHandler, STUDENT_ID } from "./handlers";

setupAuthTestServer();

const studentRoute = peopleRoutes.find((route) => route.path === "students/:studentId");

describe("peopleRoutes", () => {
  it("keeps My profile at /profile, with its own title", async () => {
    const profile = peopleRoutes.find((route) => route.path === "profile");
    expect(profile?.handle).toEqual({ title: "people:profile.title" });

    server.use(meHandler(), myProfileHandler());
    await renderRoutes(peopleRoutes, { route: "/profile" });

    expect(await screen.findByText("Ana Torres", { selector: "p" })).toBeInTheDocument();
  });
});

describe("peopleRoutes (student detail)", () => {
  it("declares the static title used by the topbar, and it is translated", () => {
    expect(studentRoute?.handle).toEqual({ title: "people:student.routeTitle" });
    expect(i18n.t("people:student.routeTitle", { lng: "pt-BR" })).toBe("Aluno");
    expect(i18n.t("people:student.routeTitle", { lng: "en-US" })).toBe("Student");
  });

  it("asks for students.view, the permission of the Alunos item of the menu", () => {
    const guard = studentRoute?.element as ReactElement<{ permission: string }> | undefined;

    expect(guard?.props.permission).toBe("students.view");
  });

  it.each([
    ["member", Role.member],
    ["director", Role.director],
    ["coordinator", Role.coordinator],
  ])("the %s can open /students/:id", async (_label, role) => {
    server.use(meHandler({ user: buildMeUser({ role }) }), getStudentHandler());
    await renderRoutes(peopleRoutes, { route: `/students/${STUDENT_ID}` });

    expect(
      await screen.findByRole("heading", { level: 2, name: buildStudentDetail().name }),
    ).toBeInTheDocument();
  });

  it("shows the forbidden page to someone without students.view, and never asks for the student", async () => {
    const onGet = vi.fn();
    const member = buildMeUser({ role: Role.member });
    server.use(
      meHandler({
        user: { ...member, permissions: { ...member.permissions, "students.view": "none" } },
      }),
      getStudentHandler({ onCall: onGet }),
    );
    await renderRoutes(peopleRoutes, { route: `/students/${STUDENT_ID}` });

    expect(await screen.findByText(/Você não tem acesso/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: buildStudentDetail().name })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Dados pessoais" })).toBeNull();
    expect(onGet).not.toHaveBeenCalled();
  });
});
