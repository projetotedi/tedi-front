import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CourseLessonPlansResponseDto } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { catalogRoutes } from "../routes";
import {
  buildCourseSequence,
  buildMeUser,
  buildMockSequenceItem,
  buildSequenceItem,
  COURSE_ARCHIVED_ERROR,
  COURSE_ID,
  COURSE_NOT_FOUND_ERROR,
  listCourseLessonPlansHandler,
  replaceCourseLessonPlansHandler,
} from "./handlers";
import { createDeferred, renderRoutes, server, setupCatalogTestServer } from "./test-utils";

setupCatalogTestServer();

const COURSE_ROUTE = `/courses/${COURSE_ID}`;

interface RenderOptions {
  sequence?: CourseLessonPlansResponseDto;
  role?: Role;
  onList?: (call: { id: string }) => void;
}

async function renderPage({
  sequence = buildCourseSequence(),
  role = Role.coordinator,
  onList,
}: RenderOptions = {}) {
  server.use(listCourseLessonPlansHandler({ response: sequence, onCall: onList }));
  const view = await renderRoutes(catalogRoutes, { route: COURSE_ROUTE, user: buildMeUser(role) });
  await screen.findByRole("heading", { name: "Plano do curso" });
  return view;
}

const editButton = () => screen.getByRole("button", { name: "Editar sequência" });
const dialog = () => screen.getByRole("dialog", { name: "Montar sequência do curso" });
const dialogButton = (name: string | RegExp) => within(dialog()).getByRole("button", { name });
const table = () => screen.getByRole("table", { name: "Plano do curso" });
const tableTitles = () =>
  within(table())
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[1].textContent);

describe("CourseDetailPage", () => {
  describe("loading the sequence", () => {
    it("shows a loading state while the sequence is on its way", async () => {
      const deferred = createDeferred();
      server.use(listCourseLessonPlansHandler({ delay: deferred.promise }));
      await renderRoutes(catalogRoutes, { route: COURSE_ROUTE });

      expect(await screen.findByRole("status")).toHaveTextContent("Carregando o plano do curso…");
      expect(screen.queryByRole("heading", { name: "Plano do curso" })).not.toBeInTheDocument();

      deferred.resolve();
      expect(await screen.findByRole("heading", { name: "Plano do curso" })).toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("asks the sequence by the id of the route", async () => {
      const onCall = vi.fn();
      server.use(listCourseLessonPlansHandler({ onCall }));
      await renderRoutes(catalogRoutes, { route: COURSE_ROUTE });

      await screen.findByRole("heading", { name: "Plano do curso" });

      expect(onCall).toHaveBeenCalledExactlyOnceWith({ id: COURSE_ID });
    });

    it("shows the sequence, with the workload the API answered", async () => {
      await renderPage();

      expect(tableTitles()).toEqual([
        "Conhecendo o WhatsApp",
        "Enviar um áudio no WhatsApp",
        "Senhas e privacidade",
        "Reconhecendo golpes",
      ]);
      expect(screen.getByText(/^A carga horária prevista \(7h\)/)).toBeInTheDocument();
    });

    it("shows a page of not found, with no way back (there is no list of courses), for an unknown id", async () => {
      server.use(listCourseLessonPlansHandler({ error: COURSE_NOT_FOUND_ERROR }));
      await renderRoutes(catalogRoutes, { route: COURSE_ROUTE });

      expect(
        await screen.findByRole("heading", { name: "Curso não encontrado" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Este curso não existe ou foi removido.")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Plano do curso" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Editar sequência" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("shows an error with retry when the sequence cannot be loaded", async () => {
      server.use(listCourseLessonPlansHandler({ networkError: true }));
      const user = userEvent.setup();
      await renderRoutes(catalogRoutes, { route: COURSE_ROUTE });

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar o plano do curso. Tente novamente.",
      );
      expect(
        screen.queryByRole("heading", { name: "Curso não encontrado" }),
      ).not.toBeInTheDocument();

      server.use(listCourseLessonPlansHandler());
      await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

      expect(await screen.findByRole("heading", { name: "Plano do curso" })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("also shows the error with retry for a server error", async () => {
      server.use(
        listCourseLessonPlansHandler({
          error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" },
        }),
      );
      await renderRoutes(catalogRoutes, { route: COURSE_ROUTE });

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar o plano do curso.",
      );
      expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
    });
  });

  describe("who sees what", () => {
    it("the member sees the plan of the course and cannot edit it", async () => {
      await renderPage({ role: Role.member });

      expect(tableTitles()).toHaveLength(4);
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

    it("after saving, the card shows the sequence and the workload from the PUT response", async () => {
      const user = userEvent.setup();
      const onList = vi.fn();
      server.use(replaceCourseLessonPlansHandler());
      await renderPage({ onList });

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
      expect(await screen.findByText("Sequência do curso salva.")).toBeInTheDocument();
      // It is the answer of the PUT that is on the page, not a new GET: the only one is the first.
      expect(onList).toHaveBeenCalledTimes(1);
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

    it("an archived course (409 COURSE_ARCHIVED) turns Editar sequência off, with the hint, after the dialog closes", async () => {
      const user = userEvent.setup();
      server.use(replaceCourseLessonPlansHandler({ error: COURSE_ARCHIVED_ERROR }));
      await renderPage();
      expect(editButton()).toBeEnabled();

      await user.click(editButton());
      await user.click(dialogButton("Salvar sequência"));
      expect(await within(dialog()).findByRole("alert")).toHaveTextContent(
        "Este curso está arquivado e a sequência não pode ser alterada.",
      );
      await user.click(dialogButton("Cancelar"));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(editButton()).toBeDisabled();
      expect(
        screen.getByText("Curso arquivado: a sequência não pode ser alterada (RN-27)."),
      ).toBeVisible();
      expect(tableTitles()).toHaveLength(4);
    });
  });
});
