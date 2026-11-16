import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClassStatus } from "@api/generated/model";
import i18n from "@shared/i18n";

import "../index";
import { ClassFormDialog } from "../components/ClassFormDialog";
import { initialClasses, type ClassRecord } from "../mocks/classes.mock";

const LOCKED_HINT = "O curso só pode ser trocado enquanto a turma está Planejada e sem matrículas.";
const CHANGE_NOT_ALLOWED =
  "Esta turma não pode mais trocar de curso: ela já não está Planejada ou já tem matrícula.";

function classRecord(id: string): ClassRecord {
  const found = initialClasses.find((record) => record.id === id);
  if (found === undefined) throw new Error(`No mock class "${id}"`);
  return found;
}

/** An ongoing class with 12 enrollments, of "Informática Básica". */
const IN_PROGRESS = classRecord("1");
/** A planned class that already has 6 enrollments. */
const PLANNED_WITH_ENROLLMENTS = classRecord("3");
/** A planned class with no enrollment: the only one whose course can change. */
const PLANNED_EMPTY = classRecord("6");

const NEW_CLASS: ClassRecord = {
  ...PLANNED_EMPTY,
  id: "new",
  code: "",
  name: "",
  courseId: "computer",
  enrolled: 0,
};

interface RenderOptions {
  initialClass?: ClassRecord;
  isEditing?: boolean;
  onSave?: (record: ClassRecord) => void | Promise<void>;
  onOpenChange?: (isOpen: boolean) => void;
}

function renderDialog({
  initialClass = NEW_CLASS,
  isEditing = false,
  onSave = vi.fn(),
  onOpenChange = vi.fn(),
}: RenderOptions = {}) {
  render(
    <ClassFormDialog
      initialClass={initialClass}
      isEditing={isEditing}
      onOpenChange={onOpenChange}
      onSave={onSave}
    />,
  );
  return { onSave, onOpenChange };
}

const courseTrigger = () => screen.getByRole("button", { name: /Curso/ });
const statusTrigger = () => screen.getByRole("button", { name: /Status/ });
const optionNames = () => screen.getAllByRole("option").map((option) => option.textContent);

async function pickOption(
  user: ReturnType<typeof userEvent.setup>,
  trigger: HTMLElement,
  name: string,
) {
  await user.click(trigger);
  await user.click(screen.getByRole("option", { name }));
}

async function submit(user: ReturnType<typeof userEvent.setup>, isEditing: boolean) {
  await user.click(
    screen.getByRole("button", { name: isEditing ? "Salvar alterações" : "Salvar turma" }),
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("pt-BR");
});

describe("ClassFormDialog", () => {
  describe("the fields", () => {
    it("has no level field and saves no level", async () => {
      const user = userEvent.setup();
      const { onSave } = renderDialog();

      expect(within(screen.getByRole("dialog")).queryByText(/Nível/)).not.toBeInTheDocument();

      await user.type(screen.getByRole("textbox", { name: "Código da turma" }), "TUR-NEW");
      await submit(user, false);

      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      const saved = vi.mocked(onSave).mock.calls[0][0];
      expect(saved).not.toHaveProperty("level");
      expect(saved).not.toHaveProperty("course");
      expect(saved).toMatchObject({ code: "TUR-NEW", courseId: "computer" });
    });

    it("titles the dialog by what it does", () => {
      renderDialog();

      expect(screen.getByRole("dialog", { name: "Nova turma" })).toBeInTheDocument();
    });
  });

  describe("the course of a new class", () => {
    it("offers only the active courses, with no archived one", async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.click(courseTrigger());

      expect(optionNames()).toEqual([
        "Informática Básica",
        "Internet",
        "Redes Sociais com Segurança",
        "Segurança digital",
        "Smartphones no dia a dia",
      ]);
      expect(screen.queryByRole("option", { name: /Fotografia digital/ })).not.toBeInTheDocument();
    });

    it("is free to be chosen and has no hint", () => {
      renderDialog();

      expect(courseTrigger()).toBeEnabled();
      expect(screen.queryByText(LOCKED_HINT)).not.toBeInTheDocument();
    });

    it("saves the course that was chosen", async () => {
      const user = userEvent.setup();
      const { onSave } = renderDialog();

      await pickOption(user, courseTrigger(), "Internet");
      await user.type(screen.getByRole("textbox", { name: "Código da turma" }), "TUR-NET");
      await submit(user, false);

      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      expect(vi.mocked(onSave).mock.calls[0][0]).toMatchObject({ courseId: "internet" });
    });
  });

  describe("changing the course of a class that exists", () => {
    it("is turned off, with the hint, when the class is in progress", () => {
      renderDialog({ initialClass: IN_PROGRESS, isEditing: true });

      expect(courseTrigger()).toBeDisabled();
      expect(courseTrigger()).toHaveAccessibleDescription(LOCKED_HINT);
      expect(screen.getByText(LOCKED_HINT)).toBeVisible();
      expect(courseTrigger()).toHaveTextContent("Informática Básica");
    });

    it("is turned off when the class is planned but already has an enrollment", () => {
      renderDialog({ initialClass: PLANNED_WITH_ENROLLMENTS, isEditing: true });

      expect(courseTrigger()).toBeDisabled();
      expect(courseTrigger()).toHaveAccessibleDescription(LOCKED_HINT);
    });

    it.each([ClassStatus.in_progress, ClassStatus.completed, ClassStatus.cancelled])(
      "is turned off when the class is %s, even with no enrollment",
      (status) => {
        renderDialog({ initialClass: { ...PLANNED_EMPTY, status }, isEditing: true });

        expect(courseTrigger()).toBeDisabled();
        expect(screen.getByText(LOCKED_HINT)).toBeVisible();
      },
    );

    it("is free when the class is planned and has no enrollment", () => {
      renderDialog({ initialClass: PLANNED_EMPTY, isEditing: true });

      expect(courseTrigger()).toBeEnabled();
      expect(screen.queryByText(LOCKED_HINT)).not.toBeInTheDocument();
    });

    it("moves the class to the course that was chosen when it is free", async () => {
      const user = userEvent.setup();
      const { onSave } = renderDialog({ initialClass: PLANNED_EMPTY, isEditing: true });

      await pickOption(user, courseTrigger(), "Internet");
      await submit(user, true);

      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      expect(vi.mocked(onSave).mock.calls[0][0]).toMatchObject({
        id: PLANNED_EMPTY.id,
        courseId: "internet",
      });
    });

    it("keeps sending the course as it is when the field is off, so the rest can be saved", async () => {
      const user = userEvent.setup();
      const { onSave } = renderDialog({ initialClass: IN_PROGRESS, isEditing: true });

      await submit(user, true);

      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      expect(vi.mocked(onSave).mock.calls[0][0]).toMatchObject({
        id: IN_PROGRESS.id,
        courseId: "computer",
      });
    });

    it("looks at the saved status (P11): picking Em andamento in a planned class does not turn the course off", async () => {
      const user = userEvent.setup();
      renderDialog({ initialClass: PLANNED_EMPTY, isEditing: true });

      await pickOption(user, statusTrigger(), "Em andamento");

      expect(statusTrigger()).toHaveTextContent("Em andamento");
      expect(courseTrigger()).toBeEnabled();
      expect(screen.queryByText(LOCKED_HINT)).not.toBeInTheDocument();
    });

    it("looks at the saved status (P11): picking Planejada in a class in progress does not free the course", async () => {
      const user = userEvent.setup();
      renderDialog({ initialClass: IN_PROGRESS, isEditing: true });

      await pickOption(user, statusTrigger(), "Planejada");

      expect(statusTrigger()).toHaveTextContent("Planejada");
      expect(courseTrigger()).toBeDisabled();
      expect(screen.getByText(LOCKED_HINT)).toBeVisible();
    });

    it("keeps the archived course the class already has, marked, and offers no other archived one", async () => {
      const user = userEvent.setup();
      renderDialog({ initialClass: { ...PLANNED_EMPTY, courseId: "photo" }, isEditing: true });

      expect(courseTrigger()).toHaveTextContent("Fotografia digital (arquivado)");

      await user.click(courseTrigger());

      expect(optionNames()).toContain("Fotografia digital (arquivado)");
      expect(optionNames()).toContain("Informática Básica");
    });

    it("does not offer the archived course when the class is being created, even if the form came with it", async () => {
      const user = userEvent.setup();
      renderDialog({ initialClass: { ...NEW_CLASS, courseId: "photo" }, isEditing: false });

      await user.click(courseTrigger());

      expect(screen.queryByRole("option", { name: /Fotografia digital/ })).not.toBeInTheDocument();
    });
  });

  describe("when the API refuses the save", () => {
    async function saveRefusedWith(error: unknown, initialClass: ClassRecord = PLANNED_EMPTY) {
      const user = userEvent.setup();
      const onSave = vi
        .fn<(record: ClassRecord) => void | Promise<void>>()
        .mockRejectedValue(error);
      const { onOpenChange } = renderDialog({ initialClass, isEditing: true, onSave });

      await submit(user, true);
      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

      return { user, onSave, onOpenChange };
    }

    it("shows 409 COURSE_CHANGE_NOT_ALLOWED on the course field, with the dialog still open", async () => {
      const { onOpenChange } = await saveRefusedWith({
        statusCode: 409,
        error: "COURSE_CHANGE_NOT_ALLOWED",
      });

      await waitFor(() => expect(courseTrigger()).toHaveAccessibleDescription(CHANGE_NOT_ALLOWED));
      expect(screen.getByText(CHANGE_NOT_ALLOWED)).toBeVisible();
      expect(screen.getByRole("dialog", { name: "Editar turma" })).toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("sends the focus to the course field, as the other forms do with the field that has the error", async () => {
      await saveRefusedWith({ statusCode: 409, error: "COURSE_CHANGE_NOT_ALLOWED" });

      await waitFor(() => expect(courseTrigger()).toHaveFocus());
    });

    it("shows 409 COURSE_ARCHIVED on the course field", async () => {
      await saveRefusedWith({ statusCode: 409, error: "COURSE_ARCHIVED" });

      await waitFor(() =>
        expect(courseTrigger()).toHaveAccessibleDescription(
          "Este curso foi arquivado e não recebe turmas novas.",
        ),
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows 400 COURSE_NOT_FOUND on the course field", async () => {
      await saveRefusedWith({ statusCode: 400, error: "COURSE_NOT_FOUND" });

      await waitFor(() =>
        expect(courseTrigger()).toHaveAccessibleDescription(
          "Curso não encontrado. Escolha outro curso.",
        ),
      );
    });

    it("clears the error of the course when another course is chosen and the form is sent again", async () => {
      const { user, onSave } = await saveRefusedWith({
        statusCode: 409,
        error: "COURSE_CHANGE_NOT_ALLOWED",
      });
      await waitFor(() => expect(courseTrigger()).toHaveAccessibleDescription(CHANGE_NOT_ALLOWED));
      onSave.mockResolvedValue(undefined);

      await pickOption(user, courseTrigger(), "Internet");
      await submit(user, true);

      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
      expect(screen.queryByText(CHANGE_NOT_ALLOWED)).not.toBeInTheDocument();
    });

    describe("with the course field turned off", () => {
      it.each([
        [{ statusCode: 409, error: "COURSE_CHANGE_NOT_ALLOWED" }, CHANGE_NOT_ALLOWED],
        [
          { statusCode: 409, error: "COURSE_ARCHIVED" },
          "Este curso foi arquivado e não recebe turmas novas.",
        ],
        [
          { statusCode: 400, error: "COURSE_NOT_FOUND" },
          "Curso não encontrado. Escolha outro curso.",
        ],
      ])(
        "announces %j in the warning of the form, since a field that is off takes no focus",
        async (error, message) => {
          const { onOpenChange } = await saveRefusedWith(error, IN_PROGRESS);

          // `role="alert"` is a live region: the screen reader says it when it appears.
          expect(await screen.findByRole("alert")).toHaveTextContent(message);
          expect(screen.getByRole("dialog", { name: "Editar turma" })).toBeInTheDocument();
          expect(onOpenChange).not.toHaveBeenCalled();
          // The field stays off, and what it says is still why it is off, not the error.
          expect(courseTrigger()).toBeDisabled();
          expect(courseTrigger()).toHaveAccessibleDescription(LOCKED_HINT);
          expect(screen.getAllByText(message)).toHaveLength(1);
        },
      );

      it("leaves the focus on the button that was pressed: the field that is off cannot take it", async () => {
        await saveRefusedWith({ statusCode: 409, error: "COURSE_CHANGE_NOT_ALLOWED" }, IN_PROGRESS);
        await screen.findByRole("alert");

        expect(courseTrigger()).not.toHaveFocus();
        expect(screen.getByRole("button", { name: "Salvar alterações" })).toHaveFocus();
      });
    });

    it("shows any other error as a warning of the form, and not on a field", async () => {
      await saveRefusedWith(new TypeError("Failed to fetch"));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível salvar a turma. Tente novamente.",
      );
      expect(courseTrigger()).not.toHaveAccessibleDescription(/.+/);
      expect(screen.getByRole("dialog", { name: "Editar turma" })).toBeInTheDocument();
    });

    it("treats an error of the API that is not about the course as the general one", async () => {
      await saveRefusedWith({ statusCode: 500, error: "INTERNAL_SERVER_ERROR" });

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível salvar a turma. Tente novamente.",
      );
    });

    it("lets the person try again after the warning, and clears the warning", async () => {
      const { user, onSave } = await saveRefusedWith(new Error("boom"));
      expect(await screen.findByRole("alert")).toBeInTheDocument();
      onSave.mockResolvedValue(undefined);

      await submit(user, true);

      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    });
  });

  describe("while it saves", () => {
    it("shows the button as busy and sends the form once, however many times it is pressed", async () => {
      const user = userEvent.setup();
      let finish!: () => void;
      const onSave = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
      renderDialog({ initialClass: PLANNED_EMPTY, isEditing: true, onSave });
      const save = screen.getByRole("button", { name: "Salvar alterações" });

      await user.click(save);
      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      await user.click(save);
      await user.click(save);

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(save).toHaveAttribute("aria-disabled", "true");

      finish();

      await waitFor(() => expect(save).not.toHaveAttribute("aria-disabled", "true"));
      expect(onSave).toHaveBeenCalledTimes(1);
    });
  });

  describe("the other validations", () => {
    it("still asks for the code of the class", async () => {
      const user = userEvent.setup();
      const { onSave } = renderDialog();

      await submit(user, false);

      expect(await screen.findByText("Campo obrigatório.")).toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();
    });
  });
});
