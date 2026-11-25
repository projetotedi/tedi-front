import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ClassStatus } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import {
  archiveClassHandler,
  buildClassDetail,
  buildClassesPage,
  buildClassListItem,
  buildMeUser,
  CLASS_HAS_ACTIVE_ENROLLMENTS_ERROR,
  CLASS_ID,
  COURSE_ID,
  EDITION_2025_ID,
  getClassHandler,
  listClassesHandler,
  listCoursesHandler,
  listEditionsHandler,
  unarchiveClassHandler,
  type ListClassesCall,
} from "./handlers";
import { classesRoutes, renderRoutes, server, setupClassesTestServer } from "./test-utils";

setupClassesTestServer();

const ARCHIVED_ROW = buildClassListItem({
  id: "01952ef7-0000-7000-8000-0000000000d2",
  code: "INFO-Z",
  name: null,
  archivedAt: "2026-10-10T13:00:00.000Z",
});

async function renderList({
  route = "/classes",
  role = Role.coordinator,
  onCall,
  page = buildClassesPage(),
}: {
  route?: string;
  role?: Role;
  onCall?: (call: ListClassesCall) => void;
  page?: ReturnType<typeof buildClassesPage>;
} = {}) {
  server.use(
    listEditionsHandler(),
    listCoursesHandler(),
    listClassesHandler({ response: page, onCall }),
  );
  const view = await renderRoutes(classesRoutes, { route, user: buildMeUser(role) });
  return view;
}

const table = () => screen.findByRole("table", { name: /Turmas/ });

describe("ClassesListPage", () => {
  describe("reading the API", () => {
    it("shows the classes of listClasses with the columns of the Figma", async () => {
      await renderList({ page: buildClassesPage([buildClassListItem()], { total: 12 }) });

      const rows = within(await table()).getAllByRole("row");
      const row = rows[1];

      expect(screen.getByRole("heading", { name: "Turmas (12)" })).toBeInTheDocument();
      expect(
        within(row).getByRole("link", { name: "Informática Básica — Turma A" }),
      ).toHaveAttribute("href", `/classes/${CLASS_ID}`);
      expect(within(row).getByText("INFO-A · Informática Básica")).toBeInTheDocument();
      expect(within(row).getByText("12/15")).toBeInTheDocument();
      expect(within(row).getByText("Em andamento")).toBeInTheDocument();
      expect(screen.getByText("Mostrando 1 de 12 turmas")).toBeInTheDocument();
    });

    it("asks the first page, by the latest start, with no filter", async () => {
      const onCall = vi.fn();
      await renderList({ onCall });

      await table();
      expect(onCall).toHaveBeenCalledWith({ page: "1", limit: "10", sort: "startDate" });
    });

    it("sends the filters of the URL to the API", async () => {
      const onCall = vi.fn();
      await renderList({
        onCall,
        route: `/classes?search=INFO&editionId=${EDITION_2025_ID}&courseId=${COURSE_ID}&category=basic&status=planned,in_progress&archived=true&page=2`,
      });

      await waitFor(() =>
        expect(onCall).toHaveBeenCalledWith({
          page: "2",
          limit: "10",
          sort: "startDate",
          search: "INFO",
          editionId: EDITION_2025_ID,
          courseId: COURSE_ID,
          category: "basic",
          status: "planned,in_progress",
          archived: "true",
        }),
      );
    });

    it("keeps ?courseId= from Ver todas of the screen of a course", async () => {
      const onCall = vi.fn();
      await renderList({ onCall, route: `/classes?courseId=${COURSE_ID}` });

      await waitFor(() =>
        expect(onCall).toHaveBeenCalledWith(expect.objectContaining({ courseId: COURSE_ID })),
      );
      expect(
        await screen.findByRole("button", { name: /Curso: informática básica/i }),
      ).toBeVisible();
    });

    it("names an archived class by its code and tags it Arquivada", async () => {
      await renderList({ page: buildClassesPage([ARCHIVED_ROW]) });

      const row = within(await table()).getAllByRole("row")[1];

      expect(within(row).getByRole("link", { name: "INFO-Z" })).toBeInTheDocument();
      expect(within(row).getByText("Arquivada")).toBeInTheDocument();
    });
  });

  describe("filters", () => {
    it("searches after the typing stops and goes back to page 1", async () => {
      const onCall = vi.fn();
      const user = userEvent.setup();
      await renderList({ onCall, route: "/classes?page=2" });
      await table();

      await user.type(
        screen.getByRole("textbox", { name: "Buscar por código, turma ou curso" }),
        "INFO",
      );

      await waitFor(() =>
        expect(onCall).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: "INFO", page: "1" }),
        ),
      );
    });

    it("filters by an edition of the API, by its id", async () => {
      const onCall = vi.fn();
      const user = userEvent.setup();
      await renderList({ onCall });
      await table();

      await user.click(screen.getByRole("button", { name: /Edição/ }));
      await user.click(await screen.findByRole("option", { name: "2025.2" }));

      await waitFor(() =>
        expect(onCall).toHaveBeenLastCalledWith(
          expect.objectContaining({ editionId: EDITION_2025_ID }),
        ),
      );
    });

    it("takes more than one status and Arquivadas apart, as archived=true", async () => {
      const onCall = vi.fn();
      const user = userEvent.setup();
      await renderList({ onCall });
      await table();

      await user.click(screen.getByRole("button", { name: /Status/ }));
      await user.click(await screen.findByRole("option", { name: "Planejada" }));
      await user.click(screen.getByRole("option", { name: "Arquivadas" }));

      await waitFor(() =>
        expect(onCall).toHaveBeenLastCalledWith(
          expect.objectContaining({ status: ClassStatus.planned, archived: "true" }),
        ),
      );
    });
  });

  describe("states", () => {
    it("says when there is no class yet and offers + Nova turma", async () => {
      await renderList({ page: buildClassesPage([]) });

      expect(await screen.findByText("Nenhuma turma ainda")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "+ Nova turma" })).toHaveLength(2);
    });

    it("says when the filters find nothing and clears them", async () => {
      const onCall = vi.fn();
      const user = userEvent.setup();
      await renderList({ onCall, page: buildClassesPage([]), route: "/classes?category=advanced" });

      await user.click(await screen.findByRole("button", { name: "Limpar filtros" }));

      await waitFor(() =>
        expect(onCall).toHaveBeenLastCalledWith({ page: "1", limit: "10", sort: "startDate" }),
      );
    });

    it("shows the error and tries again", async () => {
      server.use(
        listEditionsHandler(),
        listCoursesHandler(),
        listClassesHandler({ networkError: true }),
      );
      const user = userEvent.setup();
      await renderRoutes(classesRoutes, { route: "/classes" });

      const retry = await screen.findByRole("button", { name: "Tentar de novo" });
      server.use(listClassesHandler());
      await user.click(retry);

      expect(await table()).toBeInTheDocument();
    });
  });

  describe("actions", () => {
    it("the member sees no + Nova turma and no actions", async () => {
      await renderList({ role: Role.member });
      await table();

      expect(screen.queryByRole("button", { name: "+ Nova turma" })).not.toBeInTheDocument();
      expect(screen.queryByRole("columnheader", { name: "Ações" })).not.toBeInTheDocument();
    });

    it("the pencil opens Editar turma filled with the class", async () => {
      server.use(getClassHandler({ response: buildClassDetail() }));
      const user = userEvent.setup();
      await renderList();

      await user.click(
        within(await table()).getByRole("button", {
          name: "Editar turma Informática Básica — Turma A",
        }),
      );

      const dialog = await screen.findByRole("dialog", { name: "Editar turma" });
      expect(await within(dialog).findByDisplayValue("INFO-A")).toBeInTheDocument();
    });

    it("+ Nova turma opens the empty form", async () => {
      const user = userEvent.setup();
      await renderList();
      await table();

      await user.click(screen.getByRole("button", { name: "+ Nova turma" }));

      expect(await screen.findByRole("dialog", { name: "Nova turma" })).toBeInTheDocument();
    });

    it("the bin archives with the reason and the list is fetched again", async () => {
      const onArchive = vi.fn();
      const onList = vi.fn();
      server.use(archiveClassHandler({ onCall: onArchive }));
      const user = userEvent.setup();
      await renderList({ onCall: onList });

      await user.click(
        within(await table()).getByRole("button", {
          name: "Arquivar turma Informática Básica — Turma A",
        }),
      );
      const dialog = await screen.findByRole("dialog", { name: "Arquivar turma" });
      expect(within(dialog).getByText("Arquivar encerra a oferta da turma")).toBeInTheDocument();
      await user.type(
        within(dialog).getByRole("textbox", { name: "Motivo (opcional)" }),
        "Sem alunos.",
      );
      const callsBefore = onList.mock.calls.length;
      await user.click(within(dialog).getByRole("button", { name: "Arquivar turma" }));

      expect(await screen.findByText("Turma arquivada.")).toBeInTheDocument();
      expect(onArchive).toHaveBeenCalledWith({ id: CLASS_ID, body: { reason: "Sem alunos." } });
      await waitFor(() => expect(onList.mock.calls.length).toBeGreaterThan(callsBefore));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("explains the 409 of a class with students and keeps the dialog open", async () => {
      server.use(archiveClassHandler({ error: CLASS_HAS_ACTIVE_ENROLLMENTS_ERROR }));
      const user = userEvent.setup();
      await renderList();

      await user.click(
        within(await table()).getByRole("button", {
          name: "Arquivar turma Informática Básica — Turma A",
        }),
      );
      const dialog = await screen.findByRole("dialog", { name: "Arquivar turma" });
      await user.click(within(dialog).getByRole("button", { name: "Arquivar turma" }));

      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "Esta turma ainda tem alunos matriculados.",
      );
    });

    it("an archived row has Reativar instead of the pencil and the bin", async () => {
      const onCall = vi.fn();
      server.use(unarchiveClassHandler({ onCall }));
      const user = userEvent.setup();
      await renderList({ page: buildClassesPage([ARCHIVED_ROW]), route: "/classes?archived=true" });

      const row = within(await table()).getAllByRole("row")[1];
      expect(within(row).queryByRole("button", { name: /Editar turma/ })).not.toBeInTheDocument();
      await user.click(within(row).getByRole("button", { name: "Reativar turma INFO-Z" }));
      const dialog = await screen.findByRole("dialog", { name: "Reativar turma" });
      await user.click(within(dialog).getByRole("button", { name: "Reativar turma" }));

      expect(await screen.findByText("Turma reativada.")).toBeInTheDocument();
      expect(onCall).toHaveBeenCalledWith({ id: ARCHIVED_ROW.id, body: undefined });
    });
  });
});
