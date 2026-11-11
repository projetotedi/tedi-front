import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CourseCategory, CourseStatus, type CourseDetailDto } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { catalogRoutes } from "../routes";
import {
  buildArchivedCourseDetail,
  buildCourseDetail,
  buildCourseSequence,
  buildMeUser,
  buildMockSequenceItem,
  buildSequenceItem,
  COURSE_ARCHIVED_ERROR,
  COURSE_CREATOR_NAME,
  COURSE_ID,
  COURSE_NOT_FOUND_ERROR,
  COURSE_SMARTPHONES,
  COURSE_SOCIAL_NETWORKS,
  getCourseHandler,
  listCourseLessonPlansHandler,
  replaceCourseLessonPlansHandler,
} from "./handlers";
import { createDeferred, renderRoutes, server, setupCatalogTestServer } from "./test-utils";

setupCatalogTestServer();

const COURSE_ROUTE = `/courses/${COURSE_ID}`;
const COURSE_NAME = COURSE_SOCIAL_NETWORKS.courseName;
const ARCHIVED_HINT = "Curso arquivado: a sequência não pode ser alterada (RN-27).";

interface RenderOptions {
  course?: CourseDetailDto;
  role?: Role;
  onGet?: (call: { id: string }) => void;
}

async function renderPage({
  course = buildCourseDetail(),
  role = Role.coordinator,
  onGet,
}: RenderOptions = {}) {
  server.use(getCourseHandler({ response: course, onCall: onGet }));
  const view = await renderRoutes(catalogRoutes, { route: COURSE_ROUTE, user: buildMeUser(role) });
  await screen.findByRole("heading", { name: course.name });
  return view;
}

/**
 * The card (the root with `data-slot="card"`) whose `<h2>` is `name`. It also finds the cards of the
 * page while a dialog is open over it, when the page is hidden from the accessibility tree.
 */
function card(name: string): HTMLElement {
  const root = screen.getByRole("heading", { name, hidden: true }).closest("[data-slot='card']");
  if (!(root instanceof HTMLElement)) throw new Error(`No card titled "${name}"`);
  return root;
}

/** The header is the card whose heading is the name of the course. */
const header = (name: string = COURSE_NAME) => card(name);

/** The value (`<dd>`) of the field `label` (`<dt>`) inside `scope`. */
function valueOf(scope: HTMLElement, label: string): HTMLElement {
  const value = within(scope).getByText(label, { selector: "dt" }).nextElementSibling;
  if (!(value instanceof HTMLElement)) throw new Error(`No value for "${label}"`);
  return value;
}

const tags = (scope: HTMLElement) =>
  within(scope)
    .getAllByRole("listitem")
    .map((tag) => tag.textContent);

const editButton = () => screen.getByRole("button", { name: "Editar sequência" });
const dialog = () => screen.getByRole("dialog", { name: "Montar sequência do curso" });
const dialogButton = (name: string | RegExp) => within(dialog()).getByRole("button", { name });
const table = () => screen.getByRole("table", { name: "Plano do curso" });
const tableTitles = () =>
  within(table())
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[1].textContent);

/** "Smartphones no dia a dia": basic, with no prerequisite, and required by the course of the Figma. */
function buildSmartphonesCourse(overrides: Partial<CourseDetailDto> = {}): CourseDetailDto {
  return buildCourseDetail({
    id: COURSE_SMARTPHONES.courseId,
    name: COURSE_SMARTPHONES.courseName,
    category: CourseCategory.basic,
    lessonPlans: [buildSequenceItem()],
    prerequisites: [],
    requiredBy: [
      {
        id: COURSE_ID,
        name: COURSE_NAME,
        category: CourseCategory.intermediate,
        status: CourseStatus.active,
      },
    ],
    ...overrides,
  });
}

describe("CourseDetailPage", () => {
  describe("loading the course", () => {
    it("shows a loading state while the course is on its way", async () => {
      const deferred = createDeferred();
      server.use(getCourseHandler({ delay: deferred.promise }));
      await renderRoutes(catalogRoutes, { route: COURSE_ROUTE });

      expect(await screen.findByRole("status")).toHaveTextContent("Carregando o curso…");
      expect(screen.queryByRole("heading", { name: COURSE_NAME })).not.toBeInTheDocument();

      deferred.resolve();
      expect(await screen.findByRole("heading", { name: COURSE_NAME })).toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("asks GET /courses/:id once, by the id of the route, and nothing else", async () => {
      const onGet = vi.fn();
      const onSequence = vi.fn();
      const requests: string[] = [];
      server.events.on("request:start", ({ request }) => {
        requests.push(`${request.method} ${new URL(request.url).pathname}`);
      });
      server.use(listCourseLessonPlansHandler({ onCall: onSequence }));

      try {
        await renderPage({ onGet });

        expect(onGet).toHaveBeenCalledExactlyOnceWith({ id: COURSE_ID });
        expect(onSequence).not.toHaveBeenCalled();
        expect(requests.filter((request) => !request.endsWith("/auth/me"))).toEqual([
          `GET /courses/${COURSE_ID}`,
        ]);
      } finally {
        server.events.removeAllListeners("request:start");
      }
    });

    it("shows the name and the tags: category, status, lesson plans and planned workload", async () => {
      await renderPage();

      expect(
        within(header()).getByRole("heading", { level: 2, name: COURSE_NAME }),
      ).toBeInTheDocument();
      expect(tags(header())).toEqual([
        "Intermediário",
        "Ativo",
        "4 planos de aula",
        "7h previstas",
      ]);
    });

    it("shows the data of the course", async () => {
      await renderPage();

      const data = card("Dados do curso");

      expect(valueOf(data, "Nome do curso")).toHaveTextContent(COURSE_NAME);
      expect(valueOf(data, "Categoria")).toHaveTextContent("Intermediário");
      expect(valueOf(data, "Status")).toHaveTextContent("Ativo");
      expect(valueOf(data, "Criado em")).toHaveTextContent("12/02/2024");
      expect(valueOf(data, "Descrição")).toHaveTextContent(
        "WhatsApp, Instagram e os golpes mais comuns.",
      );
      expect(valueOf(data, "Objetivo")).toHaveTextContent(
        "Participar das redes sociais reconhecendo os riscos.",
      );
    });

    it("shows the plan, the prerequisites and who created the course", async () => {
      await renderPage();

      expect(tableTitles()).toEqual([
        "Conhecendo o WhatsApp",
        "Enviar um áudio no WhatsApp",
        "Senhas e privacidade",
        "Reconhecendo golpes",
      ]);
      expect(
        within(valueOf(card("Pré-requisitos"), "Cursos exigidos")).getByRole("link", {
          name: COURSE_SMARTPHONES.courseName,
        }),
      ).toHaveAttribute("href", `/courses/${COURSE_SMARTPHONES.courseId}`);
      expect(valueOf(card("Catálogo e histórico"), "Criado por")).toHaveTextContent(
        COURSE_CREATOR_NAME,
      );
    });

    it.each([
      [420, "7h"],
      [510, "8h30"],
    ])(
      "shows %s minutes in hours, in the tag of the header and in the workload card",
      async (minutes, hours) => {
        await renderPage({ course: buildCourseDetail({ plannedWorkloadMinutes: minutes }) });

        expect(within(header()).getByText(`${hours} previstas`)).toBeInTheDocument();
        const workload = card("Carga horária prevista");
        expect(valueOf(workload, "Total previsto")).toHaveTextContent(new RegExp(`^${hours}$`));
        expect(valueOf(workload, "Aulas por turma")).toHaveTextContent(/^4$/);
      },
    );

    it("says the classes of the course are not available yet, with no link and no tag of classes", async () => {
      await renderPage();

      const classes = card("Turmas deste curso");

      expect(
        within(classes).getByText("As turmas deste curso vão aparecer aqui em breve."),
      ).toBeInTheDocument();
      expect(within(classes).queryByRole("link")).not.toBeInTheDocument();
      expect(within(classes).queryByRole("table")).not.toBeInTheDocument();
      expect(tags(header()).join(" ")).not.toMatch(/turma/);
    });

    it("has no course actions yet: Duplicar curso, Arquivar curso, Editar curso and + Nova turma are hidden", async () => {
      await renderPage({ role: Role.coordinator });

      for (const name of ["Duplicar curso", "Arquivar curso", "Editar curso", "+ Nova turma"]) {
        expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
      }
    });

    it("shows an error with retry when the course cannot be loaded", async () => {
      server.use(getCourseHandler({ networkError: true }));
      const user = userEvent.setup();
      await renderRoutes(catalogRoutes, { route: COURSE_ROUTE });

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar o curso. Tente novamente.",
      );
      expect(
        screen.queryByRole("heading", { name: "Curso não encontrado" }),
      ).not.toBeInTheDocument();

      server.use(getCourseHandler());
      await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

      expect(await screen.findByRole("heading", { name: COURSE_NAME })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("also shows the error with retry for a server error", async () => {
      server.use(getCourseHandler({ error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" } }));
      await renderRoutes(catalogRoutes, { route: COURSE_ROUTE });

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar o curso.",
      );
      expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
    });
  });

  describe("not found", () => {
    it("shows a page of not found, with no way back (there is no list of courses), for an unknown id", async () => {
      server.use(getCourseHandler({ error: COURSE_NOT_FOUND_ERROR }));
      await renderRoutes(catalogRoutes, { route: COURSE_ROUTE });

      expect(
        await screen.findByRole("heading", { name: "Curso não encontrado" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Este curso não existe ou foi removido.")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Plano do curso" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Editar sequência" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("does not take a 404 that did not come from the API for a course that does not exist", async () => {
      server.use(getCourseHandler({ error: { statusCode: 404, error: "Not Found" } }));
      await renderRoutes(catalogRoutes, { route: COURSE_ROUTE });

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar o curso.",
      );
      expect(
        screen.queryByRole("heading", { name: "Curso não encontrado" }),
      ).not.toBeInTheDocument();
    });

    it("shows not found at once for an id that is not a UUID, with no request", async () => {
      const onGet = vi.fn();
      const requests: string[] = [];
      server.events.on("request:start", ({ request }) => {
        requests.push(`${request.method} ${new URL(request.url).pathname}`);
      });
      server.use(getCourseHandler({ onCall: onGet }));

      try {
        await renderRoutes(catalogRoutes, { route: "/courses/abc" });

        expect(
          await screen.findByRole("heading", { name: "Curso não encontrado" }),
        ).toBeInTheDocument();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(onGet).not.toHaveBeenCalled();
        expect(requests.filter((request) => !request.endsWith("/auth/me"))).toEqual([]);
      } finally {
        server.events.removeAllListeners("request:start");
      }
    });
  });

  describe("an archived course", () => {
    it("shows Arquivado in the tags and in the data, and no Ativo", async () => {
      await renderPage({ course: buildArchivedCourseDetail() });

      expect(tags(header())).toEqual([
        "Intermediário",
        "Arquivado",
        "4 planos de aula",
        "7h previstas",
      ]);
      expect(valueOf(card("Dados do curso"), "Status")).toHaveTextContent("Arquivado");
      expect(screen.queryByText("Ativo")).not.toBeInTheDocument();
    });

    it("turns Editar sequência off, with the reason on the page, for who can manage courses", async () => {
      const user = userEvent.setup();
      await renderPage({ course: buildArchivedCourseDetail() });

      expect(editButton()).toBeDisabled();
      expect(screen.getByText(ARCHIVED_HINT)).toBeVisible();
      expect(editButton()).toHaveAccessibleDescription(ARCHIVED_HINT);

      await user.click(editButton());

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("still shows the whole course: the sequence, the prerequisites and who created it", async () => {
      await renderPage({ course: buildArchivedCourseDetail() });

      expect(tableTitles()).toHaveLength(4);
      expect(within(card("Pré-requisitos")).getAllByRole("link")).toHaveLength(1);
      expect(valueOf(card("Catálogo e histórico"), "Criado por")).toHaveTextContent(
        COURSE_CREATOR_NAME,
      );
    });

    it("shows the member the tag and no button, and no reason for a button that is not there", async () => {
      await renderPage({ course: buildArchivedCourseDetail(), role: Role.member });

      expect(tags(header())).toContain("Arquivado");
      expect(screen.queryByRole("button", { name: "Editar sequência" })).not.toBeInTheDocument();
      expect(screen.queryByText(ARCHIVED_HINT)).not.toBeInTheDocument();
    });
  });

  describe("who sees what", () => {
    it("the member sees the whole course and cannot edit its sequence", async () => {
      await renderPage({ role: Role.member });

      expect(tableTitles()).toHaveLength(4);
      expect(card("Dados do curso")).toBeInTheDocument();
      expect(card("Carga horária prevista")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Editar sequência" })).not.toBeInTheDocument();
    });

    it.each([
      ["director", Role.director],
      ["coordinator", Role.coordinator],
    ])("the %s can edit the sequence", async (_label, role) => {
      await renderPage({ role });

      expect(editButton()).toBeEnabled();
    });
  });

  describe("editing the sequence", () => {
    it("opens the dialog with the saved sequence", async () => {
      const user = userEvent.setup();
      await renderPage();

      await user.click(editButton());

      expect(
        await screen.findByRole("dialog", { name: "Montar sequência do curso" }),
      ).toBeVisible();
      expect(within(dialog()).getByText("Carga horária prevista: 7h")).toBeInTheDocument();
    });

    it("after saving, the header, the workload card and the plan show the PUT response, with a single GET /courses/:id", async () => {
      const user = userEvent.setup();
      const onGet = vi.fn();
      server.use(replaceCourseLessonPlansHandler());
      await renderPage({ onGet });

      await user.click(editButton());
      await user.click(dialogButton(/Adicionar plano de aula/));
      await user.click(await screen.findByRole("option", { name: "Fotos no celular · 1h30" }));
      await user.click(dialogButton("Adicionar"));
      await user.click(dialogButton("Mover Fotos no celular para cima"));
      expect(within(dialog()).getByText("Carga horária prevista: 8h30")).toBeInTheDocument();
      await user.click(dialogButton("Salvar sequência"));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(tableTitles()).toEqual([
        "Conhecendo o WhatsApp",
        "Enviar um áudio no WhatsApp",
        "Senhas e privacidade",
        "Fotos no celular",
        "Reconhecendo golpes",
      ]);
      expect(screen.getByText(/^A carga horária prevista \(8h30\)/)).toBeInTheDocument();
      expect(tags(header())).toEqual([
        "Intermediário",
        "Ativo",
        "5 planos de aula",
        "8h30 previstas",
      ]);
      const workload = card("Carga horária prevista");
      expect(valueOf(workload, "Total previsto")).toHaveTextContent(/^8h30$/);
      expect(valueOf(workload, "Aulas por turma")).toHaveTextContent(/^5$/);
      expect(await screen.findByText("Sequência do curso salva.")).toBeInTheDocument();
      // It is the answer of the PUT that is on the page, not a new GET: the only one is the first.
      expect(onGet).toHaveBeenCalledTimes(1);
    });

    it("shows what the API answered and not what the dialog added up", async () => {
      const user = userEvent.setup();
      const answered = {
        ...buildCourseSequence([buildSequenceItem(), buildMockSequenceItem("lesson-plan-07")]),
        plannedWorkloadMinutes: 195,
      };
      server.use(replaceCourseLessonPlansHandler({ response: answered }));
      await renderPage();

      await user.click(editButton());
      await user.click(dialogButton("Salvar sequência"));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(tableTitles()).toEqual(["Conhecendo o WhatsApp", "Fotos no celular"]);
      expect(screen.getByText(/^A carga horária prevista \(3h15\)/)).toBeInTheDocument();
      expect(tags(header())).toContain("2 planos de aula");
      expect(tags(header())).toContain("3h15 previstas");
      expect(valueOf(card("Carga horária prevista"), "Total previsto")).toHaveTextContent(/^3h15$/);
    });

    it("Cancelar keeps the sequence of the page as it was", async () => {
      const user = userEvent.setup();
      await renderPage();

      await user.click(editButton());
      await user.click(dialogButton("Remover Senhas e privacidade da sequência"));
      await user.click(dialogButton("Cancelar"));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(tableTitles()).toHaveLength(4);
      expect(screen.getByText(/^A carga horária prevista \(7h\)/)).toBeInTheDocument();
      expect(tags(header())).toContain("7h previstas");
    });

    it("gives the focus back to Editar sequência when the dialog closes", async () => {
      const user = userEvent.setup();
      await renderPage();

      await user.click(editButton());
      await user.click(dialogButton("Cancelar"));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() => expect(editButton()).toHaveFocus());
    });

    it("gives the focus back to Editar sequência after saving too", async () => {
      const user = userEvent.setup();
      server.use(replaceCourseLessonPlansHandler());
      await renderPage();

      await user.click(editButton());
      await user.click(dialogButton("Salvar sequência"));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() => expect(editButton()).toHaveFocus());
    });

    it("an archived course (409 COURSE_ARCHIVED) turns Editar sequência off, with the hint and the tag, after the dialog closes", async () => {
      const user = userEvent.setup();
      const onGet = vi.fn();
      server.use(replaceCourseLessonPlansHandler({ error: COURSE_ARCHIVED_ERROR }));
      await renderPage({ onGet });
      expect(editButton()).toBeEnabled();
      expect(tags(header())).toContain("Ativo");
      // From now on the API says the course is archived, which is what the refused save found out.
      server.use(getCourseHandler({ response: buildArchivedCourseDetail(), onCall: onGet }));

      await user.click(editButton());
      await user.click(dialogButton("Salvar sequência"));
      expect(await within(dialog()).findByRole("alert")).toHaveTextContent(
        "Este curso está arquivado e a sequência não pode ser alterada.",
      );
      await user.click(dialogButton("Cancelar"));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(editButton()).toBeDisabled();
      expect(screen.getByText(ARCHIVED_HINT)).toBeVisible();
      expect(tableTitles()).toHaveLength(4);
      // The detail is fetched again, and it is what puts Arquivado in the header and in the data.
      await waitFor(() => expect(tags(header())).toContain("Arquivado"));
      expect(tags(header())).not.toContain("Ativo");
      expect(valueOf(card("Dados do curso"), "Status")).toHaveTextContent("Arquivado");
      expect(onGet).toHaveBeenCalledTimes(2);
    });

    it("keeps Editar sequência off, and the tag too, even when the new GET fails", async () => {
      const user = userEvent.setup();
      server.use(replaceCourseLessonPlansHandler({ error: COURSE_ARCHIVED_ERROR }));
      await renderPage();
      server.use(getCourseHandler({ networkError: true }));

      await user.click(editButton());
      await user.click(dialogButton("Salvar sequência"));
      await within(dialog()).findByRole("alert");
      await user.click(dialogButton("Cancelar"));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(editButton()).toBeDisabled();
      expect(screen.getByText(ARCHIVED_HINT)).toBeVisible();
      expect(tags(header())).toContain("Arquivado");
      expect(tableTitles()).toHaveLength(4);
    });

    it("sends the focus to the reason when the button that opened the dialog is off", async () => {
      const user = userEvent.setup();
      server.use(replaceCourseLessonPlansHandler({ error: COURSE_ARCHIVED_ERROR }));
      await renderPage();

      await user.click(editButton());
      await user.click(dialogButton("Salvar sequência"));
      await within(dialog()).findByRole("alert");
      await user.click(dialogButton("Cancelar"));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() => expect(screen.getByText(ARCHIVED_HINT)).toHaveFocus());
    });
  });

  describe("prerequisites", () => {
    it("opens a prerequisite course and shows its data", async () => {
      const user = userEvent.setup();
      const onGet = vi.fn();
      server.use(
        getCourseHandler({
          response: (id) =>
            id === COURSE_SMARTPHONES.courseId ? buildSmartphonesCourse() : buildCourseDetail(),
          onCall: onGet,
        }),
      );
      await renderRoutes(catalogRoutes, { route: COURSE_ROUTE, user: buildMeUser() });
      await screen.findByRole("heading", { name: COURSE_NAME });

      await user.click(screen.getByRole("link", { name: COURSE_SMARTPHONES.courseName }));

      expect(
        await screen.findByRole("heading", { name: COURSE_SMARTPHONES.courseName }),
      ).toBeInTheDocument();
      expect(onGet).toHaveBeenNthCalledWith(2, { id: COURSE_SMARTPHONES.courseId });
      expect(screen.queryByRole("heading", { name: COURSE_NAME })).not.toBeInTheDocument();
      expect(tags(header(COURSE_SMARTPHONES.courseName))).toEqual([
        "Básico",
        "Ativo",
        "1 plano de aula",
        "1h30 previstas",
      ]);
      const prerequisites = card("Pré-requisitos");
      expect(valueOf(prerequisites, "Cursos exigidos")).toHaveTextContent("—Não informado");
      expect(
        within(valueOf(prerequisites, "É pré-requisito de")).getByRole("link", {
          name: COURSE_NAME,
        }),
      ).toHaveAttribute("href", COURSE_ROUTE);
    });

    it("does not carry what a refused save taught the screen about one course to another course that is already in the cache", async () => {
      const user = userEvent.setup();
      server.use(
        replaceCourseLessonPlansHandler({ error: COURSE_ARCHIVED_ERROR }),
        getCourseHandler({
          response: (id) =>
            id === COURSE_SMARTPHONES.courseId ? buildSmartphonesCourse() : buildCourseDetail(),
        }),
      );
      await renderRoutes(catalogRoutes, { route: COURSE_ROUTE, user: buildMeUser() });
      await screen.findByRole("heading", { name: COURSE_NAME });
      // Smartphones is opened once and the person comes back, so that the next time it is in the
      // cache and the page shows it with no loading step in between (the case the `key` is for:
      // with a loading step, the view of the previous course is thrown away anyway).
      await user.click(screen.getByRole("link", { name: COURSE_SMARTPHONES.courseName }));
      await screen.findByRole("heading", { name: COURSE_SMARTPHONES.courseName });
      await user.click(screen.getByRole("link", { name: COURSE_NAME }));
      await screen.findByRole("heading", { name: COURSE_NAME });
      await user.click(editButton());
      await user.click(dialogButton("Salvar sequência"));
      await within(dialog()).findByRole("alert");
      await user.click(dialogButton("Cancelar"));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(editButton()).toBeDisabled();

      await user.click(screen.getByRole("link", { name: COURSE_SMARTPHONES.courseName }));
      await screen.findByRole("heading", { name: COURSE_SMARTPHONES.courseName });

      expect(editButton()).toBeEnabled();
      expect(screen.queryByText(ARCHIVED_HINT)).not.toBeInTheDocument();
      expect(tags(header(COURSE_SMARTPHONES.courseName))).toContain("Ativo");
    });
  });
});
