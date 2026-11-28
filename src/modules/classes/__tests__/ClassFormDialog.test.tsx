import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ClassStatus } from "@api/generated/model";

import { ClassFormDialog } from "../components/ClassFormDialog";
import {
  buildClassDetail,
  CAPACITY_BELOW_ENROLLED_ERROR,
  CLASS_CODE_TAKEN_ERROR,
  CLASS_ID,
  COURSE_ARCHIVED_ERROR,
  COURSE_ID,
  createClassHandler,
  getClassHandler,
  INVALID_PERIOD_ERROR,
  listCoursesHandler,
  listEditionsHandler,
  OTHER_COURSE_ID,
  updateClassHandler,
} from "./handlers";
import { renderWithProviders, server, setupClassesTestServer } from "./test-utils";

setupClassesTestServer();

type User = ReturnType<typeof userEvent.setup>;

const LOCKED_HINT = "O curso só pode ser trocado enquanto a turma está Planejada e sem matrículas.";

async function renderDialog({
  classId,
  initialCourseId,
  classDetail = buildClassDetail(),
}: {
  classId?: string;
  initialCourseId?: string;
  classDetail?: ReturnType<typeof buildClassDetail>;
} = {}) {
  server.use(
    listCoursesHandler(),
    listEditionsHandler(),
    getClassHandler({ response: classDetail }),
  );
  const onClose = vi.fn();
  const onSaved = vi.fn();
  await renderWithProviders(
    <ClassFormDialog
      classId={classId}
      initialCourseId={initialCourseId}
      onClose={onClose}
      onSaved={onSaved}
    />,
  );
  const dialog = await screen.findByRole("dialog", {
    name: classId ? "Editar turma" : "Nova turma",
  });
  return { dialog, onClose, onSaved };
}

const courseTrigger = () => screen.getByRole("button", { name: /Curso/ });
const codeField = () => screen.getByRole("textbox", { name: /Código da turma/ });
const editionField = () => screen.getByRole("combobox", { name: /Edição/ });
const locationField = () => screen.getByRole("textbox", { name: /Local/ });
const capacityField = () => screen.getByRole("textbox", { name: /Vagas totais/ });
const dateGroup = (name: string) => screen.getByRole("group", { name: new RegExp(name) });

async function pickCourse(user: User, name: string) {
  await user.click(courseTrigger());
  await user.click(await screen.findByRole("option", { name }));
}

async function typeDate(user: User, name: string, digits: string) {
  await user.click(within(dateGroup(name)).getAllByRole("spinbutton")[0]);
  await user.keyboard(digits);
}

async function fillNewClass(user: User, { edition = "2026.1" } = {}) {
  await waitFor(() => expect(courseTrigger()).toBeEnabled());
  await pickCourse(user, "Informática Básica");
  await user.type(codeField(), "INFO-B");
  await user.type(editionField(), edition);
  // The suggestions close when the focus leaves the field.
  await user.tab();
  await typeDate(user, "Data de início", "03032026");
  await typeDate(user, "Data de término", "27062026");
  await user.type(locationField(), "Laboratório 2");
  await user.type(capacityField(), "20");
}

const submit = (user: User, name = "Salvar turma") =>
  user.click(screen.getByRole("button", { name }));

describe("ClassFormDialog", () => {
  describe("Nova turma", () => {
    it("has the fields of the Figma, in order, with Status Planejada", async () => {
      const { dialog } = await renderDialog();

      const names = [
        courseTrigger(),
        codeField(),
        editionField(),
        dateGroup("Data de início"),
        dateGroup("Data de término"),
        locationField(),
        capacityField(),
      ];
      for (let index = 1; index < names.length; index += 1) {
        expect(
          names[index - 1].compareDocumentPosition(names[index]) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
      expect(within(dialog).getByRole("button", { name: /Status/ })).toHaveTextContent("Planejada");
      expect(within(dialog).queryByRole("textbox", { name: /Nome/ })).not.toBeInTheDocument();
    });

    it("offers only the active courses", async () => {
      const user = userEvent.setup();
      await renderDialog();

      await user.click(courseTrigger());

      expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
        "Informática Básica",
        "Smartphones no dia a dia",
      ]);
    });

    it("creates the class with an edition typed that is not listed, without leaving the dialog", async () => {
      const onCall = vi.fn();
      server.use(createClassHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose, onSaved } = await renderDialog();

      await fillNewClass(user, { edition: "2026.2" });
      await submit(user);

      await waitFor(() =>
        expect(onCall).toHaveBeenCalledWith({
          id: null,
          body: {
            courseId: COURSE_ID,
            code: "INFO-B",
            editionName: "2026.2",
            startDate: "2026-03-03",
            endDate: "2026-06-27",
            location: "Laboratório 2",
            capacity: 20,
            status: ClassStatus.planned,
          },
        }),
      );
      expect(await screen.findByText("Turma criada.")).toBeInTheDocument();
      expect(onSaved).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("suggests the editions of the API", async () => {
      const user = userEvent.setup();
      await renderDialog();

      await user.type(editionField(), "2025");

      expect(await screen.findByRole("option", { name: "2025.2" })).toBeInTheDocument();
    });

    it("starts with the course of the screen it was opened from", async () => {
      await renderDialog({ initialCourseId: OTHER_COURSE_ID });

      await waitFor(() => expect(courseTrigger()).toHaveTextContent("Smartphones no dia a dia"));
    });

    it("stops an end before the start, on the end, with no request", async () => {
      const onCall = vi.fn();
      server.use(createClassHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog();

      await fillNewClass(user);
      await typeDate(user, "Data de término", "01012026");
      await submit(user);

      expect(
        await screen.findByText("A data de término deve ser igual ou posterior à data de início."),
      ).toBeInTheDocument();
      expect(onCall).not.toHaveBeenCalled();
    });

    it("refuses an edition out of the format", async () => {
      const user = userEvent.setup();
      await renderDialog();

      await fillNewClass(user, { edition: "2026" });
      await submit(user);

      expect(await screen.findByText("Informe a edição no formato 2026.1.")).toBeInTheDocument();
      expect(editionField()).toHaveFocus();
    });

    it("says which fields are missing and focuses the first one", async () => {
      const user = userEvent.setup();
      await renderDialog();
      await waitFor(() => expect(courseTrigger()).toBeEnabled());

      await submit(user);

      expect((await screen.findAllByText("Campo obrigatório.")).length).toBeGreaterThan(1);
      expect(courseTrigger()).toHaveFocus();
    });

    it.each([
      [CLASS_CODE_TAKEN_ERROR, "Já existe uma turma com este código nesta edição.", codeField],
      [
        INVALID_PERIOD_ERROR,
        "A data de término deve ser igual ou posterior à data de início.",
        () => within(dateGroup("Data de término")).getAllByRole("spinbutton")[0],
      ],
      [COURSE_ARCHIVED_ERROR, "Este curso foi arquivado e não recebe turmas novas.", courseTrigger],
    ])(
      "puts the refusal %# of the API on its field, with the focus",
      async (error, text, field) => {
        server.use(createClassHandler({ error }));
        const user = userEvent.setup();
        const { onClose } = await renderDialog();

        await fillNewClass(user);
        await submit(user);

        expect(await screen.findByText(text)).toBeInTheDocument();
        expect(field()).toHaveFocus();
        expect(onClose).not.toHaveBeenCalled();
      },
    );

    it("shows a network failure above the buttons", async () => {
      server.use(createClassHandler({ networkError: true }));
      const user = userEvent.setup();
      await renderDialog();

      await fillNewClass(user);
      await submit(user);

      expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conectar.");
    });
  });

  describe("Editar turma", () => {
    it("comes filled with the class", async () => {
      await renderDialog({ classId: CLASS_ID });

      expect(await screen.findByDisplayValue("INFO-A")).toBeInTheDocument();
      expect(editionField()).toHaveValue("2026.1");
      expect(locationField()).toHaveValue("Laboratório 3, bloco B");
      expect(capacityField()).toHaveValue("15");
      expect(screen.getByRole("button", { name: /Status/ })).toHaveTextContent("Em andamento");
    });

    it("sends only what changed and a cleared location as null", async () => {
      const onCall = vi.fn();
      server.use(updateClassHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog({ classId: CLASS_ID });
      await screen.findByDisplayValue("INFO-A");

      await user.clear(capacityField());
      await user.type(capacityField(), "18");
      await user.clear(locationField());
      await submit(user, "Salvar alterações");

      await waitFor(() =>
        expect(onCall).toHaveBeenCalledWith({
          id: CLASS_ID,
          body: { capacity: 18, location: null },
        }),
      );
      expect(await screen.findByText("Turma atualizada.")).toBeInTheDocument();
    });

    it("closes with no request when nothing changed", async () => {
      const onCall = vi.fn();
      server.use(updateClassHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog({ classId: CLASS_ID });
      await screen.findByDisplayValue("INFO-A");

      await submit(user, "Salvar alterações");

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCall).not.toHaveBeenCalled();
    });

    it("turns the course off, with the reason, once the class is no longer planned", async () => {
      await renderDialog({ classId: CLASS_ID });
      await screen.findByDisplayValue("INFO-A");

      expect(courseTrigger()).toBeDisabled();
      expect(screen.getByText(LOCKED_HINT)).toBeInTheDocument();
    });

    it("lets a planned class with no students change its course", async () => {
      const onCall = vi.fn();
      server.use(updateClassHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog({
        classId: CLASS_ID,
        classDetail: buildClassDetail({ status: ClassStatus.planned, enrollmentsTotal: 0 }),
      });
      await screen.findByDisplayValue("INFO-A");

      await pickCourse(user, "Smartphones no dia a dia");
      await submit(user, "Salvar alterações");

      await waitFor(() =>
        expect(onCall).toHaveBeenCalledWith({ id: CLASS_ID, body: { courseId: OTHER_COURSE_ID } }),
      );
    });

    it("puts seats below the students on Vagas totais", async () => {
      server.use(updateClassHandler({ error: CAPACITY_BELOW_ENROLLED_ERROR }));
      const user = userEvent.setup();
      await renderDialog({ classId: CLASS_ID });
      await screen.findByDisplayValue("INFO-A");

      await user.clear(capacityField());
      await user.type(capacityField(), "5");
      await submit(user, "Salvar alterações");

      expect(
        await screen.findByText(
          "As vagas não podem ficar abaixo do número de alunos matriculados.",
        ),
      ).toBeInTheDocument();
      expect(capacityField()).toHaveFocus();
    });

    it.each([
      [
        {
          statusCode: 409,
          error: "CLASS_HAS_LESSONS_OUTSIDE_PERIOD",
          message: "There is 1 lesson outside the new period.",
          details: [{ field: "lessonsOutsidePeriod", message: "1" }],
        },
        "Há 1 aula fora do novo período. Remarque ou cancele essa aula antes de mudar as datas.",
      ],
      [
        {
          statusCode: 409,
          error: "CLASS_HAS_LESSONS_OUTSIDE_PERIOD",
          message: "There are 2 lessons outside the new period.",
          details: [{ field: "lessonsOutsidePeriod", message: "2" }],
        },
        "Há 2 aulas fora do novo período. Remarque ou cancele essas aulas antes de mudar as datas.",
      ],
      [
        {
          statusCode: 409,
          error: "CLASS_HAS_LESSONS_OUTSIDE_PERIOD",
          message: "Lessons outside period.",
        },
        "Há aulas fora do novo período. Remarque ou cancele essas aulas antes de mudar as datas.",
      ],
    ])(
      "shows the alert above the buttons and focuses it when shortening leaves lessons outside (%#)",
      async (error, text) => {
        server.use(updateClassHandler({ error }));
        const user = userEvent.setup();
        const { onClose } = await renderDialog({ classId: CLASS_ID });
        await screen.findByDisplayValue("INFO-A");

        await typeDate(user, "Data de término", "01062026");
        await submit(user, "Salvar alterações");

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent(text);
        expect(document.activeElement).toContainElement(alert);
        expect(onClose).not.toHaveBeenCalled();
      },
    );
  });
});
