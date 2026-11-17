import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Role } from "@shared/lib/role";

import {
  archiveCourseHandler,
  buildCourseDetail,
  buildCourseListItem,
  buildFigmaCourseList,
  buildMeUser,
  classesSummaryHandler,
  getCourseHandler,
  listCoursesHandler,
  unarchiveCourseHandler,
} from "./handlers";
import { catalogRoutes, renderRoutes, server, setupCatalogTestServer } from "./test-utils";

setupCatalogTestServer();

const FIGMA = buildFigmaCourseList();

async function renderPage({
  route = "/courses",
  role = Role.coordinator,
}: { route?: string; role?: Role } = {}) {
  const view = await renderRoutes(catalogRoutes, { route, user: buildMeUser(role) });
  return view;
}

const table = () => screen.getByRole("table");
const rowOf = (name: string) =>
  within(table()).getByRole("link", { name }).closest("tr") as HTMLElement;
const cellsOf = (name: string) =>
  within(rowOf(name))
    .getAllByRole("cell")
    .map((cell) => cell.textContent);

describe("CoursesPage", () => {
  describe("the list", () => {
    it("shows Cursos (N) and the six courses of the Figma with every column", async () => {
      server.use(listCoursesHandler(), classesSummaryHandler({ total: 4 }));
      await renderPage();

      expect(await screen.findByRole("heading", { name: "Cursos (6)" })).toBeInTheDocument();
      expect(
        within(table())
          .getAllByRole("columnheader")
          .map((header) => header.textContent),
      ).toEqual([
        "Curso",
        "Categoria",
        "Planos de aula",
        "Carga prevista",
        "Pré-requisito",
        "Turmas",
        "Status",
        "Ações",
      ]);
      await waitFor(() => expect(cellsOf("Informática Básica")[5]).toBe("4"));
      expect(cellsOf("Informática Básica").slice(0, 7)).toEqual([
        "Informática Básica",
        "Básico",
        "6",
        "12h",
        "-",
        "4",
        "Ativo",
      ]);
      expect(cellsOf("Redes Sociais com Segurança")[4]).toBe("Smartphones no dia a dia");
      expect(cellsOf("Informática Básica (2023)")[6]).toBe("Arquivado");
      expect(screen.getByText("Mostrando 6 de 6 cursos")).toBeInTheDocument();
    });

    it("asks the classes of the whole page in ONE call, not one per row", async () => {
      const onSummary = vi.fn();
      server.use(listCoursesHandler(), classesSummaryHandler({ onCall: onSummary }));
      await renderPage();

      await waitFor(() => expect(onSummary).toHaveBeenCalled());
      await screen.findByRole("heading", { name: "Cursos (6)" });
      expect(onSummary).toHaveBeenCalledTimes(1);
      expect(onSummary.mock.calls[0][0].courseIds.split(",")).toEqual(
        FIGMA.map((course) => course.id),
      );
    });

    it("shows a dash in Turmas when the summary fails, and keeps the list", async () => {
      server.use(
        listCoursesHandler(),
        classesSummaryHandler({ error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" } }),
      );
      await renderPage();

      await screen.findByRole("heading", { name: "Cursos (6)" });
      expect(cellsOf("Informática Básica")[5]).toBe("—");
    });

    it("opens the course when the row is clicked, and the name is a link to it", async () => {
      server.use(listCoursesHandler(), classesSummaryHandler(), getCourseHandler());
      const user = userEvent.setup();
      const { router } = await renderPage();
      await screen.findByRole("heading", { name: "Cursos (6)" });

      expect(within(table()).getByRole("link", { name: "Fotografia no Celular" })).toHaveAttribute(
        "href",
        `/courses/${FIGMA[4].id}`,
      );
      await user.click(within(rowOf("Fotografia no Celular")).getAllByRole("cell")[1]);

      await waitFor(() => expect(router.state.location.pathname).toBe(`/courses/${FIGMA[4].id}`));
    });
  });

  describe("filters in the URL", () => {
    it("sends the filters of the URL to listCourses", async () => {
      const onCall = vi.fn();
      server.use(listCoursesHandler({ onCall }), classesSummaryHandler());
      await renderPage({
        route: "/courses?search=info&category=basic&status=active&prerequisite=without&page=2",
      });

      await waitFor(() => expect(onCall).toHaveBeenCalled());
      expect(onCall.mock.calls[0][0].params).toEqual({
        page: "2",
        limit: "20",
        search: "info",
        category: "basic",
        status: "active",
        hasPrerequisite: "false",
      });
    });

    it("searches after the debounce, with one request, and goes back to page 1", async () => {
      const onCall = vi.fn();
      server.use(listCoursesHandler({ onCall }), classesSummaryHandler());
      const user = userEvent.setup();
      const { router } = await renderPage({ route: "/courses?page=2" });
      await screen.findByRole("heading", { name: "Cursos (6)" });
      onCall.mockClear();

      await user.type(screen.getByRole("textbox", { name: "Buscar curso por nome" }), "redes");

      await waitFor(() => expect(router.state.location.search).toBe("?search=redes"));
      await waitFor(() =>
        expect(onCall).toHaveBeenLastCalledWith({
          params: { page: "1", limit: "20", search: "redes" },
        }),
      );
      expect(
        onCall.mock.calls.filter(
          (call) => (call[0] as { params: { search?: string } }).params.search,
        ).length,
      ).toBe(1);
    });

    it("filters by status from the select, in the URL and back to page 1", async () => {
      server.use(listCoursesHandler(), classesSummaryHandler());
      const user = userEvent.setup();
      const { router } = await renderPage({ route: "/courses?page=2" });
      await screen.findByRole("heading", { name: "Cursos (6)" });

      await user.click(screen.getByRole("button", { name: /Status: todos/ }));
      await user.click(await screen.findByRole("option", { name: "Arquivado" }));

      await waitFor(() => expect(router.state.location.search).toBe("?status=archived"));
    });
  });

  describe("states", () => {
    it("shows the loading state while the first page loads", async () => {
      server.use(listCoursesHandler({ delay: new Promise(() => {}) }));
      await renderPage();

      expect(await screen.findByText("Carregando cursos…")).toBeInTheDocument();
    });

    it("shows Nenhum curso ainda when the catalog is empty and there is no filter", async () => {
      server.use(listCoursesHandler({ courses: [] }));
      await renderPage();

      expect(await screen.findByText("Nenhum curso ainda")).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("shows no result with Limpar filtros, which clears the URL", async () => {
      server.use(listCoursesHandler({ courses: [] }));
      const user = userEvent.setup();
      const { router } = await renderPage({ route: "/courses?category=advanced&search=xyz" });

      await screen.findByText("Nenhum curso encontrado com esses filtros.");
      await user.click(screen.getByRole("button", { name: "Limpar filtros" }));

      await waitFor(() => expect(router.state.location.search).toBe(""));
      expect(screen.getByRole("textbox", { name: "Buscar curso por nome" })).toHaveValue("");
    });

    it("shows the error with Tentar de novo, which asks again", async () => {
      server.use(
        listCoursesHandler({ error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" } }),
      );
      const user = userEvent.setup();
      await renderPage();

      await screen.findByText("Não foi possível carregar os cursos.");
      server.use(listCoursesHandler(), classesSummaryHandler());
      await user.click(screen.getByRole("button", { name: /Tentar/ }));

      expect(await screen.findByRole("heading", { name: "Cursos (6)" })).toBeInTheDocument();
    });
  });

  describe("actions", () => {
    it("opens Arquivar curso from the bin, over the list, without opening the course", async () => {
      server.use(listCoursesHandler(), classesSummaryHandler(), archiveCourseHandler());
      const user = userEvent.setup();
      const { router } = await renderPage();
      await screen.findByRole("heading", { name: "Cursos (6)" });

      await user.click(
        screen.getByRole("button", { name: "Arquivar curso: Fotografia no Celular" }),
      );

      expect(await screen.findByRole("dialog", { name: "Arquivar curso" })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/courses");
    });

    it("archives from the list and stays on it, refreshing the list", async () => {
      let courses = FIGMA;
      const onList = vi.fn();
      server.use(
        listCoursesHandler({ courses, onCall: onList }),
        classesSummaryHandler(),
        archiveCourseHandler({
          onCall: () => {
            courses = FIGMA.map((course, index) =>
              index === 4 ? { ...course, status: "archived" as const } : course,
            );
            server.use(listCoursesHandler({ courses }));
          },
        }),
      );
      const user = userEvent.setup();
      const { router } = await renderPage();
      await screen.findByRole("heading", { name: "Cursos (6)" });

      await user.click(
        screen.getByRole("button", { name: "Arquivar curso: Fotografia no Celular" }),
      );
      const dialog = await screen.findByRole("dialog", { name: "Arquivar curso" });
      await user.click(within(dialog).getByRole("button", { name: "Arquivar curso" }));

      expect(await screen.findByText("Curso arquivado.")).toBeInTheDocument();
      await waitFor(() => expect(cellsOf("Fotografia no Celular")[6]).toBe("Arquivado"));
      expect(router.state.location.pathname).toBe("/courses");
    });

    it("shows Reativar for an archived course and reactivates it after the confirmation", async () => {
      const onUnarchive = vi.fn();
      server.use(
        listCoursesHandler(),
        classesSummaryHandler(),
        unarchiveCourseHandler({ onCall: onUnarchive }),
      );
      const user = userEvent.setup();
      await renderPage();
      await screen.findByRole("heading", { name: "Cursos (6)" });

      expect(
        within(rowOf("Informática Básica (2023)")).queryByRole("button", {
          name: /Arquivar curso/,
        }),
      ).not.toBeInTheDocument();
      await user.click(
        screen.getByRole("button", { name: "Reativar curso: Informática Básica (2023)" }),
      );
      const confirm = await screen.findByRole("dialog", { name: "Reativar curso" });
      await user.click(within(confirm).getByRole("button", { name: "Reativar curso" }));

      await waitFor(() => expect(onUnarchive).toHaveBeenCalledWith({ id: FIGMA[5].id }));
    });

    it("the member sees no column Ações, no bin and no Reativar", async () => {
      server.use(listCoursesHandler(), classesSummaryHandler());
      await renderPage({ role: Role.member });
      await screen.findByRole("heading", { name: "Cursos (6)" });

      expect(screen.queryByRole("columnheader", { name: "Ações" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Arquivar curso/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Reativar/ })).not.toBeInTheDocument();
    });
  });

  it("keeps the detail of a course reachable under /courses/:id", async () => {
    server.use(getCourseHandler({ response: buildCourseDetail() }));
    await renderPage({ route: `/courses/${buildCourseListItem().id}` });

    expect(await screen.findByRole("heading", { name: "Plano do curso" })).toBeInTheDocument();
  });
});
