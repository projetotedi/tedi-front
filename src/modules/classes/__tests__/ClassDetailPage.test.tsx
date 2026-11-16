import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { type ClassDetailDto } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { classesRoutes } from "../routes";
import {
  buildArchivedClassDetail,
  buildClassCourse,
  buildClassDetail,
  buildClassSummary,
  buildMeUser,
  CLASS_ID,
  CLASS_NAME,
  CLASS_NOT_FOUND_ERROR,
  COURSE_ID,
  getClassHandler,
  STUDENT_NAMES,
} from "./handlers";
import { createDeferred, renderRoutes, server, setupClassesTestServer } from "./test-utils";

setupClassesTestServer();

const CLASS_ROUTE = `/classes/${CLASS_ID}`;

interface RenderOptions {
  classDetail?: ClassDetailDto;
  role?: Role;
  onGet?: (call: { id: string }) => void;
}

async function renderPage({
  classDetail = buildClassDetail(),
  role = Role.coordinator,
  onGet,
}: RenderOptions = {}) {
  server.use(getClassHandler({ response: classDetail, onCall: onGet }));
  const view = await renderRoutes(classesRoutes, { route: CLASS_ROUTE, user: buildMeUser(role) });
  await screen.findByRole("heading", { name: classDetail.name ?? classDetail.code });
  return view;
}

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

/** The header is the card whose heading is the name of the class. */
const header = (name: string = CLASS_NAME) => card(name);

const tags = (scope: HTMLElement) =>
  within(scope)
    .getAllByRole("listitem")
    .map((tag) => tag.textContent);

const labelsOf = (scope: HTMLElement) =>
  within(scope)
    .getAllByRole("term")
    .map((label) => label.textContent);

/** The two things the API has not got yet, which the screen shows as a dash. */
function expectDash(value: HTMLElement) {
  expect(within(value).getByText("—")).toHaveAttribute("aria-hidden", "true");
  expect(within(value).getByText("Não informado")).toHaveClass("sr-only");
}

describe("ClassDetailPage", () => {
  describe("loading the class", () => {
    it("shows a loading state while the class is on its way", async () => {
      const deferred = createDeferred();
      server.use(getClassHandler({ delay: deferred.promise }));
      await renderRoutes(classesRoutes, { route: CLASS_ROUTE });

      expect(await screen.findByRole("status")).toHaveTextContent("Carregando a turma…");
      expect(screen.queryByRole("heading", { name: CLASS_NAME })).not.toBeInTheDocument();

      deferred.resolve();
      expect(await screen.findByRole("heading", { name: CLASS_NAME })).toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("asks GET /classes/:id once, by the id of the route, and nothing else", async () => {
      const onGet = vi.fn();
      const requests: string[] = [];
      server.events.on("request:start", ({ request }) => {
        requests.push(`${request.method} ${new URL(request.url).pathname}`);
      });

      try {
        await renderPage({ onGet });

        expect(onGet).toHaveBeenCalledExactlyOnceWith({ id: CLASS_ID });
        expect(requests.filter((request) => !request.endsWith("/auth/me"))).toEqual([
          `GET /classes/${CLASS_ID}`,
        ]);
      } finally {
        server.events.removeAllListeners("request:start");
      }
    });

    it("shows the name and the tags: status, edition, level inherited from the course and seats", async () => {
      await renderPage();

      expect(
        within(header()).getByRole("heading", { level: 2, name: CLASS_NAME }),
      ).toBeInTheDocument();
      expect(tags(header())).toEqual([
        "Em andamento",
        "Edição 2026.1",
        "Nível básico — herdado do curso",
        "12 de 15 vagas",
      ]);
    });

    it("shows the tag Arquivada for an archived class, which keeps its status", async () => {
      await renderPage({ classDetail: buildArchivedClassDetail() });

      expect(tags(header())).toEqual([
        "Em andamento",
        "Arquivada",
        "Edição 2026.1",
        "Nível básico — herdado do curso",
        "12 de 15 vagas",
      ]);
      // The whole class is still on the screen, read-only: nothing here edits it anyway.
      expect(card("Dados da turma")).toBeInTheDocument();
      expect(card("Alunos matriculados")).toBeInTheDocument();
    });

    it("shows the eleven fields of Dados da turma, in the order of the Figma", async () => {
      await renderPage();

      const data = card("Dados da turma");
      expect(labelsOf(data)).toEqual([
        "Código",
        "Curso",
        "Nível (do curso)",
        "Edição",
        "Início",
        "Término",
        "Local",
        "Status",
        "Vagas totais",
        "Matriculados",
        "Criada em",
      ]);
      expect(valueOf(data, "Código")).toHaveTextContent(/^INFO-A$/);
      expect(valueOf(data, "Curso")).toHaveTextContent(/^Informática Básica$/);
      expect(valueOf(data, "Nível (do curso)")).toHaveTextContent(/^Básico$/);
      expect(valueOf(data, "Edição")).toHaveTextContent(/^2026\.1$/);
      expect(valueOf(data, "Início")).toHaveTextContent(/^03\/03\/2026$/);
      expect(valueOf(data, "Término")).toHaveTextContent(/^27\/06\/2026$/);
      expect(valueOf(data, "Local")).toHaveTextContent(/^Laboratório 3, bloco B$/);
      expect(valueOf(data, "Status")).toHaveTextContent(/^Em andamento$/);
      expect(valueOf(data, "Vagas totais")).toHaveTextContent(/^15$/);
      expect(valueOf(data, "Matriculados")).toHaveTextContent(/^12 ativos$/);
      expect(valueOf(data, "Criada em")).toHaveTextContent(/^12\/02\/2026$/);
    });

    it("shows the summary: workload, a dash for the lessons, students out of the seats, a dash for the attendance", async () => {
      await renderPage();

      const summary = card("Resumo");
      expect(labelsOf(summary)).toEqual([
        "Carga horária",
        "Aulas realizadas",
        "Alunos",
        "Frequência média",
      ]);
      expect(valueOf(summary, "Carga horária")).toHaveTextContent(/^7h30$/);
      expectDash(valueOf(summary, "Aulas realizadas"));
      expect(valueOf(summary, "Alunos")).toHaveTextContent(/^12 de 15$/);
      expectDash(valueOf(summary, "Frequência média"));
    });

    it("shows the lessons and the attendance as numbers once the API has them", async () => {
      await renderPage({
        classDetail: buildClassDetail({
          summary: buildClassSummary({
            lessonsDone: 2,
            lessonsTotal: 12,
            averageAttendance: 0.89,
          }),
        }),
      });

      const summary = card("Resumo");
      expect(valueOf(summary, "Aulas realizadas")).toHaveTextContent(/^2 de 12$/);
      expect(valueOf(summary, "Frequência média")).toHaveTextContent(/^89%$/);
      expect(within(summary).queryByText("—")).not.toBeInTheDocument();
    });

    it("shows the first five students enrolled, with the day they enrolled, and Ver todos os 12", async () => {
      await renderPage();

      const students = card("Alunos matriculados");
      const rows = within(students).getAllByRole("row").slice(1);
      expect(rows.map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual(
        STUDENT_NAMES.slice(0, 5),
      );
      expect(within(rows[0]).getAllByRole("cell")[1]).toHaveTextContent("20/02/2026");
      expect(within(students).getByRole("link", { name: "Ver todos os 12" })).toHaveAttribute(
        "href",
        `/enrollments?classId=${CLASS_ID}`,
      );
    });

    it("hides Ver todos from the member, who sees the students but cannot open the enrollments", async () => {
      await renderPage({ role: Role.member });

      expect(within(card("Alunos matriculados")).getAllByRole("row")).toHaveLength(1 + 5);
      expect(screen.queryByRole("link", { name: /Ver todos/ })).not.toBeInTheDocument();
    });

    it("links to the course of origin and shows its name and how many lesson plans it has", async () => {
      await renderPage();

      const course = card("Curso de origem");
      expect(valueOf(course, "Curso")).toHaveTextContent(/^Informática Básica$/);
      expect(valueOf(course, "Planos de aula")).toHaveTextContent(/^4$/);
      expect(within(course).getByRole("link", { name: "Abrir curso" })).toHaveAttribute(
        "href",
        `/courses/${COURSE_ID}`,
      );
    });

    it("keeps the place of Aulas da turma and Membros alocados, which say Em breve", async () => {
      await renderPage();

      for (const title of ["Aulas da turma", "Membros alocados"]) {
        const soon = card(title);
        expect(within(soon).getByText("Em breve")).toBeInTheDocument();
        expect(within(soon).queryByRole("table")).not.toBeInTheDocument();
        expect(within(soon).queryByRole("link")).not.toBeInTheDocument();
      }
    });

    it("has no actions yet: Editar turma, Gerar aulas and + Nova aula are hidden", async () => {
      await renderPage({ role: Role.coordinator });

      for (const name of ["Editar turma", "Gerar aulas", "+ Nova aula"]) {
        expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
      }
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("keeps the cards of the side column to labels and short values", async () => {
      await renderPage();

      for (const title of ["Resumo", "Curso de origem"]) {
        const side = card(title);
        const labels = within(side).getAllByRole("term");
        const values = within(side).getAllByRole("definition");

        expect(values).toHaveLength(labels.length);
        // Short: a number, a time or a name, never a sentence that explains a rule.
        for (const value of values) expect(value.textContent?.length).toBeLessThanOrEqual(30);
        expect(side.querySelector("p")).toBeNull();
        expect(within(side).queryByRole("table")).not.toBeInTheDocument();
        expect(within(side).queryByRole("list")).not.toBeInTheDocument();
      }
    });
  });

  describe("fields that come as null", () => {
    it("shows a dash for each of them and keeps the layout whole", async () => {
      await renderPage({
        classDetail: buildClassDetail({ name: null, location: null, createdBy: null }),
      });

      // With no name, the code is the title.
      expect(screen.getByRole("heading", { level: 2, name: "INFO-A" })).toBeInTheDocument();
      expect(tags(header("INFO-A"))).toEqual([
        "Em andamento",
        "Edição 2026.1",
        "Nível básico — herdado do curso",
        "12 de 15 vagas",
      ]);
      const data = card("Dados da turma");
      expectDash(valueOf(data, "Local"));
      expect(labelsOf(data)).toHaveLength(11);
      expect(valueOf(data, "Código")).toHaveTextContent(/^INFO-A$/);
      const summary = card("Resumo");
      expectDash(valueOf(summary, "Aulas realizadas"));
      expectDash(valueOf(summary, "Frequência média"));
      expect(valueOf(summary, "Carga horária")).toHaveTextContent(/^7h30$/);
      expect(valueOf(summary, "Alunos")).toHaveTextContent(/^12 de 15$/);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows a dash only for the fields that are null, and a zero for what is zero", async () => {
      await renderPage({
        classDetail: buildClassDetail({
          course: buildClassCourse({ lessonPlanCount: 0, plannedWorkloadMinutes: 0 }),
        }),
      });

      expect(valueOf(card("Curso de origem"), "Planos de aula")).toHaveTextContent(/^0$/);
      expect(valueOf(card("Resumo"), "Carga horária")).toHaveTextContent(/^0h$/);
      expect(within(card("Curso de origem")).queryByText("—")).not.toBeInTheDocument();
    });
  });

  describe("a class with no enrollment", () => {
    it("says nobody is enrolled yet, with no table and no Ver todos, and shows zero students", async () => {
      await renderPage({
        classDetail: buildClassDetail({ enrollmentsPreview: [], enrollmentsTotal: 0 }),
      });

      const students = card("Alunos matriculados");
      expect(within(students).getByText("Nenhum aluno matriculado ainda.")).toBeInTheDocument();
      expect(within(students).queryByRole("table")).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /Ver todos/ })).not.toBeInTheDocument();
      expect(valueOf(card("Resumo"), "Alunos")).toHaveTextContent(/^0 de 15$/);
      expect(valueOf(card("Dados da turma"), "Matriculados")).toHaveTextContent(/^0 ativos$/);
      expect(tags(header())).toContain("0 de 15 vagas");
    });
  });

  describe("not found", () => {
    it("shows the page of not found, with the way back to the list, for a class that does not exist", async () => {
      server.use(getClassHandler({ error: CLASS_NOT_FOUND_ERROR }));
      await renderRoutes(classesRoutes, { route: CLASS_ROUTE });

      expect(
        await screen.findByRole("heading", { name: "Turma não encontrada" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Esta turma não existe ou foi removida. Volte para a lista e escolha outra.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Voltar para turmas" })).toHaveAttribute(
        "href",
        "/classes",
      );
      expect(screen.queryByRole("heading", { name: "Dados da turma" })).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows not found at once for an id that is not a UUID, with no request to the class", async () => {
      const onGet = vi.fn();
      const requests: string[] = [];
      server.events.on("request:start", ({ request }) => {
        requests.push(`${request.method} ${new URL(request.url).pathname}`);
      });
      server.use(getClassHandler({ onCall: onGet }));

      try {
        // "1" is the id of the first class of the old example list, which still links here.
        await renderRoutes(classesRoutes, { route: "/classes/1" });

        expect(
          await screen.findByRole("heading", { name: "Turma não encontrada" }),
        ).toBeInTheDocument();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(onGet).not.toHaveBeenCalled();
        expect(requests.filter((request) => !request.endsWith("/auth/me"))).toEqual([]);
      } finally {
        server.events.removeAllListeners("request:start");
      }
    });

    it("does not take a 404 that did not come from the API for a class that does not exist", async () => {
      server.use(getClassHandler({ error: { statusCode: 404, error: "Not Found" } }));
      await renderRoutes(classesRoutes, { route: CLASS_ROUTE });

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar a turma. Tente novamente.",
      );
      expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Turma não encontrada" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("when the class cannot be loaded", () => {
    it("shows an error with retry for a server error, and the class after a new try", async () => {
      server.use(getClassHandler({ error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" } }));
      const user = userEvent.setup();
      await renderRoutes(classesRoutes, { route: CLASS_ROUTE });

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar a turma. Tente novamente.",
      );
      expect(screen.queryByRole("heading", { name: CLASS_NAME })).not.toBeInTheDocument();

      server.use(getClassHandler());
      await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

      expect(await screen.findByRole("heading", { name: CLASS_NAME })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows the same error with retry when the request never gets an answer", async () => {
      server.use(getClassHandler({ networkError: true }));
      await renderRoutes(classesRoutes, { route: CLASS_ROUTE });

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar a turma.",
      );
      expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
    });
  });
});
