import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CourseCategory } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { mockCourses } from "../mocks/classes.mock";
import { classesRoutes } from "../routes";
import { buildMeUser, buildMeUserWithoutClasses } from "./handlers";
import { expectNoRequestBesidesSession, renderRoutes, setupClassesTestServer } from "./test-utils";

setupClassesTestServer();

/** The card (the root with `data-slot="card"`) whose `<h2>` is `name`. */
function card(name: string): HTMLElement {
  const root = screen.getByRole("heading", { name }).closest("[data-slot='card']");
  if (!(root instanceof HTMLElement)) throw new Error(`No card titled "${name}"`);
  return root;
}

/** The value (`<dd>`) of the field `label` (`<dt>`) inside `scope`. */
function valueOf(scope: HTMLElement, label: string): HTMLElement {
  const value = within(scope).getByText(label, { selector: "dt" }).nextElementSibling;
  if (!(value instanceof HTMLElement)) throw new Error(`No value for "${label}"`);
  return value;
}

const header = (title: string) => card(title);
const tags = (scope: HTMLElement) =>
  within(scope)
    .getAllByRole("listitem")
    .map((tag) => tag.textContent);

async function renderClass(id: string, options: Parameters<typeof renderRoutes>[1] = {}) {
  const view = await renderRoutes(classesRoutes, { route: `/classes/${id}`, ...options });
  return view;
}

function mockCourse(id: string) {
  const course = mockCourses.find((candidate) => candidate.id === id);
  if (course === undefined) throw new Error(`No mock course "${id}"`);
  return course;
}

describe("ClassDetailPage", () => {
  describe("the header", () => {
    it("shows the name of the class, its status and the level inherited from the course", async () => {
      await renderClass("1");

      expect(
        await screen.findByRole("heading", { level: 2, name: "Turma 2026.2" }),
      ).toBeInTheDocument();
      expect(tags(header("Turma 2026.2"))).toEqual([
        "Em andamento",
        "Nível básico — herdado do curso",
      ]);
    });

    it("says the level of a class of an intermediate course is intermediate", async () => {
      await renderClass("2");

      await screen.findByRole("heading", { level: 2, name: "Turma 2025.2" });

      expect(tags(header("Turma 2025.2"))).toEqual([
        "Em andamento",
        "Nível intermediário — herdado do curso",
      ]);
    });

    it("has a way back to the list of classes", async () => {
      await renderClass("1");

      expect(await screen.findByRole("link", { name: "Voltar para turmas" })).toHaveAttribute(
        "href",
        "/classes",
      );
    });
  });

  describe("Dados da turma", () => {
    it("shows the data of the class, with the level labelled as the one of the course", async () => {
      await renderClass("1");
      await screen.findByRole("heading", { name: "Dados da turma" });

      const data = card("Dados da turma");

      expect(valueOf(data, "Código")).toHaveTextContent("TUR-2026.2");
      expect(valueOf(data, "Edição")).toHaveTextContent("1º semestre 2026");
      expect(valueOf(data, "Período")).toHaveTextContent("03/03/26 - 27/05/26");
      expect(valueOf(data, "Local")).toHaveTextContent("Não informado");
      expect(within(valueOf(data, "Vagas")).getByText("12/15")).toBeVisible();
      expect(valueOf(data, "Curso")).toHaveTextContent("Informática Básica");
      expect(valueOf(data, "Nível (do curso)")).toHaveTextContent("Básico");
    });
  });

  describe("Curso de origem", () => {
    it("is there, with the course, its level and the way to open it", async () => {
      await renderClass("1");
      await screen.findByRole("heading", { name: "Curso de origem" });

      const origin = card("Curso de origem");

      expect(valueOf(origin, "Curso")).toHaveTextContent("Informática Básica");
      expect(valueOf(origin, "Curso")).toHaveTextContent("Básico");
      expect(
        within(origin).getByRole("link", { name: "Abrir curso Informática Básica" }),
      ).toHaveAttribute("href", "/courses/computer");
    });

    it("asks the API nothing for a course of the prototype, whose id cannot exist there", async () => {
      const { queryClient } = await renderClass("1");

      await screen.findByText("Os dados deste curso não estão disponíveis.");

      // Read from the cache of the queries: nothing but the session ran.
      expectNoRequestBesidesSession(queryClient);
    });
  });

  describe("the level follows the course", () => {
    it("changes in the tag, in Dados da turma and in Curso de origem when the category of the course changes", async () => {
      const course = mockCourse("computer");
      const original = course.category;

      try {
        const { router } = await renderClass("1");
        await screen.findByRole("heading", { level: 2, name: "Turma 2026.2" });
        expect(screen.getByText("Nível básico — herdado do curso")).toBeInTheDocument();
        expect(valueOf(card("Dados da turma"), "Nível (do curso)")).toHaveTextContent("Básico");

        // The category is a data of the course: the class record is not touched. The page shows the
        // course again by going to the same screen, as it does after any navigation.
        course.category = CourseCategory.advanced;
        await act(async () => {
          await router.navigate("/classes/1?refresh=1");
        });

        expect(screen.getByText("Nível avançado — herdado do curso")).toBeInTheDocument();
        expect(screen.queryByText("Nível básico — herdado do curso")).not.toBeInTheDocument();
        expect(valueOf(card("Dados da turma"), "Nível (do curso)")).toHaveTextContent("Avançado");
        expect(
          within(valueOf(card("Curso de origem"), "Curso")).getByText("Avançado"),
        ).toBeVisible();
      } finally {
        course.category = original;
      }
    });
  });

  describe("a class that does not exist", () => {
    it("says Turma não encontrada, with a way back to the list", async () => {
      await renderClass("999");

      expect(
        await screen.findByRole("heading", { name: "Turma não encontrada" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Voltar para turmas" })).toHaveAttribute(
        "href",
        "/classes",
      );
      expect(screen.queryByRole("heading", { name: "Dados da turma" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Curso de origem" })).not.toBeInTheDocument();
    });
  });

  describe("who sees it", () => {
    it.each([
      ["member", Role.member],
      ["director", Role.director],
      ["coordinator", Role.coordinator],
    ])("the %s can open a class", async (_label, role) => {
      await renderClass("1", { user: buildMeUser(role) });

      expect(await screen.findByRole("heading", { name: "Dados da turma" })).toBeInTheDocument();
    });

    it("shows the page of no access to someone without classes.view", async () => {
      await renderClass("1", { user: buildMeUserWithoutClasses() });

      expect(await screen.findByText(/Você não tem acesso/)).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Dados da turma" })).not.toBeInTheDocument();
    });
  });
});
