import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CourseCategory, CourseStatus } from "@api/generated/model";

import { CourseFormDialog, type CourseFormDialogProps } from "../components/CourseFormDialog";
import {
  buildCourseDetail,
  buildCourseListItem,
  COURSE_ARCHIVED_ERROR,
  COURSE_ID,
  COURSE_NAME_TAKEN_ERROR,
  COURSE_SMARTPHONES,
  createCourseHandler,
  getCourseHandler,
  listCoursesHandler,
  PREREQUISITE_CYCLE_ERROR,
  updateCourseHandler,
} from "./handlers";
import { renderWithProviders, server, setupCatalogTestServer } from "./test-utils";

setupCatalogTestServer();

const BASIC_ID = "01952ef7-0000-7000-8000-0000000001a1";

/** The active courses the API offers as prerequisites: the edited course itself among them. */
const ACTIVE_COURSES = [
  buildCourseListItem({ id: BASIC_ID, name: "Informática Básica" }),
  buildCourseListItem({ id: COURSE_ID, name: "Redes Sociais com Segurança" }),
  buildCourseListItem({ id: COURSE_SMARTPHONES.courseId, name: COURSE_SMARTPHONES.courseName }),
];

const nameField = () => screen.getByRole("textbox", { name: /Nome do curso/ });
const descriptionField = () => screen.getByRole("textbox", { name: /Descrição/ });
const objectiveField = () => screen.getByRole("textbox", { name: /Objetivo/ });
const categoryTrigger = () => screen.getByRole("button", { name: /Categoria/ });
const prerequisitesTrigger = () => screen.getByRole("button", { name: /Pré-requisitos/ });

async function renderDialog(
  props: Partial<CourseFormDialogProps> & { mode?: "create" | "edit" } = {},
  { onList }: { onList?: (call: { params: Record<string, string> }) => void } = {},
) {
  server.use(listCoursesHandler({ courses: ACTIVE_COURSES, onCall: onList }));
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const onCourseArchived = vi.fn();
  const dialogProps = (
    props.mode === "edit"
      ? { mode: "edit", courseId: COURSE_ID, onClose, onSaved, onCourseArchived, ...props }
      : { mode: "create", onClose, onSaved, ...props }
  ) as CourseFormDialogProps;
  const view = await renderWithProviders(<CourseFormDialog {...dialogProps} />);
  return { ...view, onClose, onSaved, onCourseArchived };
}

async function choose(trigger: HTMLElement, option: string) {
  const user = userEvent.setup();
  await user.click(trigger);
  await user.click(await screen.findByRole("option", { name: option }));
  await user.keyboard("{Escape}");
}

describe("CourseFormDialog", () => {
  describe("Novo curso", () => {
    it("opens with the fields of the Figma, in its order, and Cancelar / Salvar curso", async () => {
      await renderDialog();

      const dialog = await screen.findByRole("dialog", { name: "Novo curso" });
      expect(nameField()).toHaveValue("");
      expect(nameField()).toHaveFocus();
      expect(categoryTrigger()).toBeInTheDocument();
      expect(prerequisitesTrigger()).toBeInTheDocument();
      expect(descriptionField()).toBeInTheDocument();
      expect(objectiveField()).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Salvar curso" })).toBeInTheDocument();
    });

    it("offers as prerequisites only the active courses, from listCourses?status=active", async () => {
      const onList = vi.fn();
      const user = userEvent.setup();
      await renderDialog({}, { onList });

      await waitFor(() =>
        expect(onList).toHaveBeenCalledWith({
          params: expect.objectContaining({ status: "active", sort: "name" }),
        }),
      );
      await user.click(prerequisitesTrigger());
      expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
        "Informática Básica",
        "Redes Sociais com Segurança",
        "Smartphones no dia a dia",
      ]);
    });

    it("refuses an empty form on the fields, without asking the API", async () => {
      const onCreate = vi.fn();
      server.use(createCourseHandler({ onCall: onCreate }));
      const user = userEvent.setup();
      await renderDialog();

      await user.click(screen.getByRole("button", { name: "Salvar curso" }));

      expect(await screen.findByText("Informe o nome do curso.")).toBeInTheDocument();
      expect(screen.getByText("Escolha a categoria.")).toBeInTheDocument();
      expect(screen.getByText("Informe a descrição.")).toBeInTheDocument();
      expect(nameField()).toHaveFocus();
      expect(onCreate).not.toHaveBeenCalled();
    });

    it("creates the course with the trimmed fields and the chosen prerequisites, then closes", async () => {
      const onCreate = vi.fn();
      server.use(createCourseHandler({ onCall: onCreate }));
      const user = userEvent.setup();
      const { onClose, onSaved } = await renderDialog();

      await user.type(nameField(), "  Fotografia no Celular  ");
      await choose(categoryTrigger(), "Básico");
      await choose(prerequisitesTrigger(), "Smartphones no dia a dia");
      await user.type(descriptionField(), "Fotos e vídeos com o celular.");
      await user.click(screen.getByRole("button", { name: "Salvar curso" }));

      await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
      expect(onCreate).toHaveBeenCalledWith({
        body: {
          name: "Fotografia no Celular",
          category: CourseCategory.basic,
          description: "Fotos e vídeos com o celular.",
          prerequisiteIds: [COURSE_SMARTPHONES.courseId],
        },
      });
      expect(await screen.findByText("Curso criado.")).toBeInTheDocument();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onSaved).toHaveBeenCalledTimes(1);
    });

    it("shows a repeated name on the name field, with the focus on it", async () => {
      server.use(createCourseHandler({ error: COURSE_NAME_TAKEN_ERROR }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await user.type(nameField(), "Informática Básica");
      await choose(categoryTrigger(), "Básico");
      await user.type(descriptionField(), "Fundamentos.");
      await user.click(screen.getByRole("button", { name: "Salvar curso" }));

      expect(
        await screen.findByText("Já existe um curso com esse nome (arquivados também contam)."),
      ).toBeInTheDocument();
      await waitFor(() => expect(nameField()).toHaveFocus());
      expect(onClose).not.toHaveBeenCalled();
    });

    it("shows a network failure as an alert and keeps the dialog open", async () => {
      server.use(createCourseHandler({ networkError: true }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await user.type(nameField(), "Curso");
      await choose(categoryTrigger(), "Básico");
      await user.type(descriptionField(), "Descrição.");
      await user.click(screen.getByRole("button", { name: "Salvar curso" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(/Não foi possível conectar/);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("Editar curso", () => {
    it("opens filled with the course and Salvar alterações", async () => {
      server.use(getCourseHandler());
      await renderDialog({ mode: "edit" });

      const dialog = await screen.findByRole("dialog", { name: "Editar curso" });
      expect(await within(dialog).findByDisplayValue("Redes Sociais com Segurança")).toBeVisible();
      expect(categoryTrigger()).toHaveTextContent("Intermediário");
      expect(prerequisitesTrigger()).toHaveTextContent("Smartphones no dia a dia");
      expect(descriptionField()).toHaveValue("WhatsApp, Instagram e os golpes mais comuns.");
      expect(objectiveField()).toHaveValue("Participar das redes sociais reconhecendo os riscos.");
      expect(within(dialog).getByRole("button", { name: "Salvar alterações" })).toBeInTheDocument();
    });

    it("does not offer the course itself as its own prerequisite", async () => {
      server.use(getCourseHandler());
      const user = userEvent.setup();
      await renderDialog({ mode: "edit" });
      await screen.findByDisplayValue("Redes Sociais com Segurança");

      await user.click(prerequisitesTrigger());

      const options = (await screen.findAllByRole("option")).map((option) => option.textContent);
      expect(options).not.toContain("Redes Sociais com Segurança");
      expect(options).toContain("Informática Básica");
    });

    it("keeps an archived prerequisite chosen and names it as archived", async () => {
      server.use(
        getCourseHandler({
          response: buildCourseDetail({
            prerequisites: [
              {
                id: "01952ef7-0000-7000-8000-0000000001b9",
                name: "Informática Básica (2023)",
                category: CourseCategory.basic,
                status: CourseStatus.archived,
              },
            ],
          }),
        }),
      );
      await renderDialog({ mode: "edit" });

      await screen.findByDisplayValue("Redes Sociais com Segurança");
      expect(prerequisitesTrigger()).toHaveTextContent("Informática Básica (2023) (arquivado)");
    });

    it("sends only what changed and says the classes show the new category", async () => {
      const onUpdate = vi.fn();
      server.use(getCourseHandler(), updateCourseHandler({ onCall: onUpdate }));
      const user = userEvent.setup();
      await renderDialog({ mode: "edit" });
      await screen.findByDisplayValue("Redes Sociais com Segurança");

      expect(screen.queryByText("A categoria vai mudar")).not.toBeInTheDocument();
      await choose(categoryTrigger(), "Avançado");
      expect(
        screen.getByText("As turmas deste curso passam a mostrar a nova categoria."),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

      await waitFor(() =>
        expect(onUpdate).toHaveBeenCalledWith({
          id: COURSE_ID,
          body: { category: CourseCategory.advanced },
        }),
      );
      expect(await screen.findByText("Curso atualizado.")).toBeInTheDocument();
    });

    it("clears the objective with null and replaces the whole set of prerequisites", async () => {
      const onUpdate = vi.fn();
      server.use(getCourseHandler(), updateCourseHandler({ onCall: onUpdate }));
      const user = userEvent.setup();
      await renderDialog({ mode: "edit" });
      await screen.findByDisplayValue("Redes Sociais com Segurança");

      await user.clear(objectiveField());
      await choose(prerequisitesTrigger(), "Informática Básica");
      await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
      const { body } = onUpdate.mock.calls[0][0] as { body: Record<string, unknown> };
      expect(body.objective).toBeNull();
      expect([...(body.prerequisiteIds as string[])].sort()).toEqual(
        [BASIC_ID, COURSE_SMARTPHONES.courseId].sort(),
      );
      expect(Object.keys(body).sort()).toEqual(["objective", "prerequisiteIds"]);
    });

    it("closes without asking the API when nothing changed", async () => {
      const onUpdate = vi.fn();
      server.use(getCourseHandler(), updateCourseHandler({ onCall: onUpdate }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog({ mode: "edit" });
      await screen.findByDisplayValue("Redes Sociais com Segurança");

      await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("shows a prerequisite cycle on Pré-requisitos", async () => {
      server.use(getCourseHandler(), updateCourseHandler({ error: PREREQUISITE_CYCLE_ERROR }));
      const user = userEvent.setup();
      await renderDialog({ mode: "edit" });
      await screen.findByDisplayValue("Redes Sociais com Segurança");

      await choose(prerequisitesTrigger(), "Informática Básica");
      await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

      expect(
        await screen.findByText(
          "Esses pré-requisitos formariam um ciclo: um curso acabaria exigindo a si mesmo.",
        ),
      ).toBeInTheDocument();
    });

    it("tells the screen when the course was archived meanwhile (409 COURSE_ARCHIVED)", async () => {
      server.use(getCourseHandler(), updateCourseHandler({ error: COURSE_ARCHIVED_ERROR }));
      const user = userEvent.setup();
      const { onCourseArchived, onClose } = await renderDialog({ mode: "edit" });
      await screen.findByDisplayValue("Redes Sociais com Segurança");

      await user.type(nameField(), " 2");
      await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Este curso está arquivado.");
      expect(onCourseArchived).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
