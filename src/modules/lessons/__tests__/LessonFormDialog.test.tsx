import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getGetLessonQueryKey } from "@api/generated/lessons/lessons";
import { LessonStatus } from "@api/generated/model";

import { LessonFormDialog, type LessonClassContext } from "../components/LessonFormDialog";
import {
  ARCHIVED_LESSON_PLAN_ID,
  buildCancelledLesson,
  buildCourseLessonPlans,
  buildLesson,
  buildLessonPlanDetail,
  buildSequenceItem,
  buildStandaloneLesson,
  CLASS_ARCHIVED_ERROR,
  CLASS_ID,
  CLASS_NAME,
  CLASS_PERIOD,
  COURSE_ID,
  createLessonHandler,
  getLessonHandler,
  getLessonPlanHandler,
  INVALID_TIME_RANGE_ERROR,
  LESSON_CANCELLED_ERROR,
  LESSON_ID,
  LESSON_NOT_FOUND_ERROR,
  LESSON_PLAN_ID_2,
  LESSON_PLAN_NOT_IN_SEQUENCE_ERROR,
  listCourseLessonPlansHandler,
  OUTSIDE_PERIOD_ERROR,
  updateLessonHandler,
  VALIDATION_ERROR,
  type CreateLessonCall,
  type UpdateLessonCall,
} from "./handlers";
import { createDeferred, renderWithProviders, server, setupLessonsTestServer } from "./test-utils";

setupLessonsTestServer();

const LESSON_CLASS: LessonClassContext = {
  id: CLASS_ID,
  label: CLASS_NAME,
  courseId: COURSE_ID,
  ...CLASS_PERIOD,
};

const PERIOD_TEXT = "02/03/2026 a 30/06/2026";

const textbox = (name: string | RegExp) => screen.getByRole("textbox", { name });
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const field = (label: RegExp) => screen.getByLabelText(label);
const planTrigger = () => button(/Plano de aula \(origem\)/);

/** Date and time inputs are filled with `change`, as in the tests of the classes (jsdom has no picker). */
function setField(label: RegExp, value: string) {
  fireEvent.change(field(label), { target: { value } });
}

function fillSchedule({ date = "2026-03-10", start = "09:00", end = "11:00" } = {}) {
  setField(/^Data da aula/, date);
  setField(/^Hora de início/, start);
  setField(/^Hora de término/, end);
}

async function fillRequired(user: UserEvent, title = "Aula de teclado") {
  await user.type(textbox("Título da aula"), title);
  fillSchedule();
}

async function renderCreate() {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const view = await renderWithProviders(
    <LessonFormDialog
      mode="create"
      lessonClass={LESSON_CLASS}
      onClose={onClose}
      onSaved={onSaved}
    />,
  );
  await screen.findByRole("dialog", { name: "Nova aula" });
  return { ...view, onClose, onSaved };
}

/** Waits for the plans of the course to arrive: the origin select is off while they load. */
async function waitForPlans() {
  await waitFor(() => expect(planTrigger()).toBeEnabled());
}

async function renderEdit(lessonId = LESSON_ID) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const view = await renderWithProviders(
    <LessonFormDialog mode="edit" lessonId={lessonId} onClose={onClose} onSaved={onSaved} />,
  );
  await screen.findByRole("dialog", { name: "Editar aula" });
  return { ...view, onClose, onSaved };
}

async function choosePlan(user: UserEvent, name: string) {
  await user.click(planTrigger());
  await user.click(await screen.findByRole("option", { name }));
}

const save = (user: UserEvent) => user.click(button("Salvar aula"));

/** The plans of the Figma sequence plus the answer of `GET /lesson-plans/:id` for each of them. */
function useSequenceHandlers() {
  server.use(
    listCourseLessonPlansHandler(),
    getLessonPlanHandler({
      response: (id) =>
        id === LESSON_PLAN_ID_2
          ? buildLessonPlanDetail({
              id,
              title: "Senhas e privacidade",
              objective: "Criar e guardar senhas com segurança.",
            })
          : buildLessonPlanDetail(),
    }),
  );
}

describe("LessonFormDialog (create)", () => {
  describe("layout", () => {
    it("shows the fields in the Figma order with the class fixed", async () => {
      server.use(listCourseLessonPlansHandler());
      await renderCreate();
      await waitForPlans();

      const controls = [
        field(/^Turma/),
        planTrigger(),
        field(/^Título da aula/),
        field(/^Objetivo/),
        field(/^Data da aula/),
        field(/^Local/),
        field(/^Hora de início/),
        field(/^Hora de término/),
        field(/^Alunos esperados/),
        field(/^Monitores esperados/),
        field(/^Assunto da aula/),
      ];
      controls.slice(1).forEach((control, index) => {
        const isAfter = controls[index].compareDocumentPosition(control);
        expect(isAfter & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      });

      const dialog = screen.getByRole("dialog", { name: "Nova aula" });
      expect(dialog).toHaveClass("max-w-200");
      expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Salvar aula" })).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Fechar" })).toBeInTheDocument();
    });

    it("shows the class as a read-only field and the plan as 'Sem plano' at first", async () => {
      server.use(listCourseLessonPlansHandler());
      await renderCreate();
      await waitForPlans();

      expect(field(/^Turma/)).toHaveValue(CLASS_NAME);
      expect(field(/^Turma/)).toHaveAttribute("readonly");
      expect(planTrigger()).toHaveTextContent("Sem plano (aula avulsa)");
    });

    it("does not ask for the status nor for the post-lesson notes", async () => {
      server.use(listCourseLessonPlansHandler());
      await renderCreate();
      await waitForPlans();

      expect(screen.queryByLabelText(/Status/)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Status/ })).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Observações pós-aula/)).not.toBeInTheDocument();
    });

    it("marks the title, the date and the times as required, and says the period of the class", async () => {
      server.use(listCourseLessonPlansHandler());
      await renderCreate();

      expect(textbox("Título da aula")).toBeRequired();
      expect(field(/^Data da aula/)).toBeRequired();
      expect(field(/^Hora de início/)).toBeRequired();
      expect(field(/^Hora de término/)).toBeRequired();
      expect(textbox("Objetivo")).not.toBeRequired();
      expect(field(/^Data da aula/)).toHaveAccessibleDescription(
        `Período da turma: ${PERIOD_TEXT}`,
      );
      expect(field(/^Data da aula/)).toHaveAttribute("type", "date");
      expect(field(/^Hora de início/)).toHaveAttribute("type", "time");
      expect(field(/^Alunos esperados/)).toHaveAttribute("inputmode", "numeric");
    });

    it("focuses the title when the dialog opens", async () => {
      server.use(listCourseLessonPlansHandler());
      await renderCreate();

      expect(textbox("Título da aula")).toHaveFocus();
    });
  });

  describe("the origin plan", () => {
    it("offers the plans of the sequence of the course of the class, with 'Sem plano' first", async () => {
      const onCall = vi.fn();
      server.use(listCourseLessonPlansHandler({ onCall }));
      const user = userEvent.setup();
      await renderCreate();
      await waitForPlans();

      await user.click(planTrigger());

      expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
        "Sem plano (aula avulsa)",
        "Teclado, mouse e janelas",
        "Senhas e privacidade",
      ]);
      expect(onCall).toHaveBeenCalledExactlyOnceWith({ id: COURSE_ID });
    });

    it("does not offer a plan that was archived after it entered the sequence", async () => {
      server.use(
        listCourseLessonPlansHandler({
          response: buildCourseLessonPlans([
            buildSequenceItem(),
            buildSequenceItem({
              lessonPlanId: ARCHIVED_LESSON_PLAN_ID,
              title: "Plano antigo",
              archivedAt: "2026-01-10T12:00:00.000Z",
            }),
            buildSequenceItem({ lessonPlanId: LESSON_PLAN_ID_2, title: "Senhas e privacidade" }),
          ]),
        }),
      );
      const user = userEvent.setup();
      await renderCreate();
      await waitForPlans();

      await user.click(planTrigger());

      expect(screen.queryByRole("option", { name: "Plano antigo" })).not.toBeInTheDocument();
      expect(screen.getAllByRole("option")).toHaveLength(3);
    });

    it("is off, and says the plans are loading, while the sequence is on its way", async () => {
      const sequence = createDeferred();
      server.use(listCourseLessonPlansHandler({ delay: sequence.promise }));
      await renderCreate();

      expect(planTrigger()).toBeDisabled();
      expect(screen.getByText("Carregando os planos do curso…")).toBeInTheDocument();
      expect(planTrigger()).toHaveAccessibleDescription("Carregando os planos do curso…");

      sequence.resolve();
      await waitForPlans();
      expect(screen.queryByText("Carregando os planos do curso…")).not.toBeInTheDocument();
    });

    it("offers only 'Sem plano' when the plans cannot be loaded, and the lesson can still be created", async () => {
      const onCall = vi.fn<(call: CreateLessonCall) => void>();
      server.use(
        listCourseLessonPlansHandler({ networkError: true }),
        createLessonHandler({ onCall }),
      );
      const user = userEvent.setup();
      await renderCreate();
      await waitFor(() => expect(planTrigger()).toBeEnabled());

      // A status region, so the failure is announced when it appears.
      expect(
        screen
          .getByText(
            "Não foi possível carregar os planos do curso. A aula ainda pode ser criada sem plano.",
          )
          .closest("[role='status']"),
      ).toBeInTheDocument();
      await user.click(planTrigger());
      expect(screen.getAllByRole("option")).toHaveLength(1);
      await user.keyboard("{Escape}");

      await fillRequired(user);
      await save(user);

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall.mock.calls[0]?.[0].body.lessonPlanId).toBeNull();
    });

    it("fills title and objective from the chosen lesson plan, and both stay editable", async () => {
      const onCall = vi.fn<(call: CreateLessonCall) => void>();
      useSequenceHandlers();
      server.use(createLessonHandler({ onCall }));
      const user = userEvent.setup();
      await renderCreate();
      await waitForPlans();

      await choosePlan(user, "Senhas e privacidade");

      await waitFor(() =>
        expect(textbox("Objetivo")).toHaveValue("Criar e guardar senhas com segurança."),
      );
      expect(textbox("Título da aula")).toHaveValue("Senhas e privacidade");
      expect(planTrigger()).toHaveTextContent("Senhas e privacidade");

      // Both can be changed after the plan filled them.
      await user.clear(textbox("Título da aula"));
      await user.type(textbox("Título da aula"), "Senhas para o dia a dia");
      await user.clear(textbox("Objetivo"));
      await user.type(textbox("Objetivo"), "Criar uma senha forte.");
      fillSchedule();
      await save(user);

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall.mock.calls[0]?.[0].body).toEqual({
        classId: CLASS_ID,
        lessonPlanId: LESSON_PLAN_ID_2,
        sequenceOrder: 2,
        title: "Senhas para o dia a dia",
        objective: "Criar uma senha forte.",
        date: "2026-03-10",
        location: null,
        startTime: "09:00",
        endTime: "11:00",
        expectedStudents: null,
        expectedMonitors: null,
        subject: null,
      });
    });

    it("fills the title at once from the sequence, before the plan itself answers", async () => {
      const plan = createDeferred();
      server.use(
        listCourseLessonPlansHandler(),
        getLessonPlanHandler({ delay: plan.promise, response: buildLessonPlanDetail() }),
      );
      const user = userEvent.setup();
      await renderCreate();
      await waitForPlans();

      await choosePlan(user, "Teclado, mouse e janelas");

      expect(textbox("Título da aula")).toHaveValue("Teclado, mouse e janelas");
      expect(textbox("Objetivo")).toHaveValue("");

      plan.resolve();
      await waitFor(() =>
        expect(textbox("Objetivo")).toHaveValue(
          "Familiarizar o aluno com o teclado, o mouse e o uso básico das janelas.",
        ),
      );
    });

    it("keeps what the person typed while the plan was loading", async () => {
      const plan = createDeferred();
      server.use(
        listCourseLessonPlansHandler(),
        getLessonPlanHandler({ delay: plan.promise, response: buildLessonPlanDetail() }),
      );
      const user = userEvent.setup();
      await renderCreate();
      await waitForPlans();

      await choosePlan(user, "Teclado, mouse e janelas");
      await user.clear(textbox("Título da aula"));
      await user.type(textbox("Título da aula"), "Meu título");
      await user.type(textbox("Objetivo"), "Meu objetivo");
      plan.resolve();

      // The answer is in the cache once the form had the chance to use it.
      await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(textbox("Título da aula")).toHaveValue("Meu título");
      expect(textbox("Objetivo")).toHaveValue("Meu objetivo");
    });

    it("keeps the title of the sequence and says the objective is unavailable when the plan cannot be read", async () => {
      server.use(
        listCourseLessonPlansHandler(),
        getLessonPlanHandler({ error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" } }),
      );
      const user = userEvent.setup();
      await renderCreate();
      await waitForPlans();

      await choosePlan(user, "Senhas e privacidade");

      expect(
        await screen.findByText(
          "Não foi possível trazer o objetivo do plano. Preencha à mão, se quiser.",
        ),
      ).toBeInTheDocument();
      expect(textbox("Título da aula")).toHaveValue("Senhas e privacidade");
      expect(textbox("Objetivo")).toHaveValue("");
      // A status region, so the hint is announced when it appears.
      expect(
        screen
          .getByText("Não foi possível trazer o objetivo do plano. Preencha à mão, se quiser.")
          .closest("[role='status']"),
      ).toBeInTheDocument();
    });

    it("takes the hint away when the person writes the objective", async () => {
      server.use(
        listCourseLessonPlansHandler(),
        getLessonPlanHandler({ error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" } }),
      );
      const user = userEvent.setup();
      await renderCreate();
      await waitForPlans();
      await choosePlan(user, "Senhas e privacidade");
      await screen.findByText(/Não foi possível trazer o objetivo do plano/);

      await user.type(textbox("Objetivo"), "Criar senhas.");

      expect(
        screen.queryByText(/Não foi possível trazer o objetivo do plano/),
      ).not.toBeInTheDocument();
    });

    it("keeps the fields as they are when 'Sem plano' is chosen after a plan", async () => {
      useSequenceHandlers();
      const user = userEvent.setup();
      await renderCreate();
      await waitForPlans();
      await choosePlan(user, "Senhas e privacidade");
      await waitFor(() =>
        expect(textbox("Objetivo")).toHaveValue("Criar e guardar senhas com segurança."),
      );

      await choosePlan(user, "Sem plano (aula avulsa)");

      expect(planTrigger()).toHaveTextContent("Sem plano (aula avulsa)");
      expect(textbox("Título da aula")).toHaveValue("Senhas e privacidade");
      expect(textbox("Objetivo")).toHaveValue("Criar e guardar senhas com segurança.");
    });

    it("sends a lesson on its own, without a plan and without a position, when 'Sem plano' stays chosen", async () => {
      const onCall = vi.fn<(call: CreateLessonCall) => void>();
      server.use(listCourseLessonPlansHandler(), createLessonHandler({ onCall }));
      const user = userEvent.setup();
      await renderCreate();
      await waitForPlans();
      await fillRequired(user, "  Aula extra  ");
      await user.type(textbox("Local"), "Laboratório 1");
      await user.type(textbox("Alunos esperados"), "15");
      await user.type(textbox("Monitores esperados"), "0");
      await user.type(textbox("Assunto da aula"), "Revisão");

      await save(user);

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      const { body } = onCall.mock.calls[0][0];
      expect(body).toEqual({
        classId: CLASS_ID,
        lessonPlanId: null,
        title: "Aula extra",
        objective: null,
        date: "2026-03-10",
        location: "Laboratório 1",
        startTime: "09:00",
        endTime: "11:00",
        expectedStudents: 15,
        expectedMonitors: 0,
        subject: "Revisão",
      });
      expect(body).not.toHaveProperty("sequenceOrder");
      expect(body).not.toHaveProperty("status");
      expect(body).not.toHaveProperty("postNotes");
    });
  });

  describe("validation in the form", () => {
    it("asks for the title, the date and both times, and sends nothing", async () => {
      const onCall = vi.fn();
      server.use(listCourseLessonPlansHandler(), createLessonHandler({ onCall }));
      const user = userEvent.setup();
      await renderCreate();
      await waitForPlans();

      await save(user);

      expect(await screen.findByText("Informe o título da aula.")).toBeInTheDocument();
      expect(screen.getByText("Informe a data.")).toBeInTheDocument();
      expect(screen.getByText("Informe a hora de início.")).toBeInTheDocument();
      expect(screen.getByText("Informe a hora de término.")).toBeInTheDocument();
      expect(textbox("Título da aula")).toHaveAttribute("aria-invalid", "true");
      expect(textbox("Título da aula")).toHaveFocus();
      expect(onCall).not.toHaveBeenCalled();
    });

    it("shows invalidTimeRange on Hora de término and sends nothing", async () => {
      const onCall = vi.fn();
      server.use(listCourseLessonPlansHandler(), createLessonHandler({ onCall }));
      const user = userEvent.setup();
      await renderCreate();
      await waitForPlans();
      await user.type(textbox("Título da aula"), "Aula");
      fillSchedule({ start: "11:00", end: "09:00" });

      await save(user);

      expect(
        await screen.findByText("A hora de término precisa ser depois da hora de início."),
      ).toBeInTheDocument();
      expect(field(/^Hora de término/)).toHaveAttribute("aria-invalid", "true");
      expect(field(/^Hora de término/)).toHaveFocus();
      expect(field(/^Hora de início/)).not.toHaveAttribute("aria-invalid", "true");
      expect(onCall).not.toHaveBeenCalled();
    });

    it("refuses an end time equal to the start time", async () => {
      const onCall = vi.fn();
      server.use(listCourseLessonPlansHandler(), createLessonHandler({ onCall }));
      const user = userEvent.setup();
      await renderCreate();
      await waitForPlans();
      await user.type(textbox("Título da aula"), "Aula");
      fillSchedule({ start: "09:00", end: "09:00" });

      await save(user);

      expect(
        await screen.findByText("A hora de término precisa ser depois da hora de início."),
      ).toBeInTheDocument();
      expect(onCall).not.toHaveBeenCalled();
    });

    it("refuses a count that is not a whole number of the allowed size", async () => {
      const onCall = vi.fn();
      server.use(listCourseLessonPlansHandler(), createLessonHandler({ onCall }));
      const user = userEvent.setup();
      await renderCreate();
      await waitForPlans();
      await fillRequired(user);
      await user.type(textbox("Alunos esperados"), "1001");
      await user.type(textbox("Monitores esperados"), "-1");

      await save(user);

      expect(await screen.findByText("Informe um número inteiro de 0 a 1000.")).toBeInTheDocument();
      expect(screen.getByText("Informe um número inteiro de 0 a 100.")).toBeInTheDocument();
      expect(onCall).not.toHaveBeenCalled();
    });

    it("Cancelar closes without sending anything", async () => {
      const onCall = vi.fn();
      server.use(listCourseLessonPlansHandler(), createLessonHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderCreate();
      await user.type(textbox("Título da aula"), "Aula");

      await user.click(button("Cancelar"));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onCall).not.toHaveBeenCalled();
    });
  });

  describe("errors of the API", () => {
    it("maps 400 INVALID_TIME_RANGE to Hora de término", async () => {
      server.use(
        listCourseLessonPlansHandler(),
        createLessonHandler({ error: INVALID_TIME_RANGE_ERROR }),
      );
      const user = userEvent.setup();
      const { onClose } = await renderCreate();
      await waitForPlans();
      await fillRequired(user);

      await save(user);

      expect(
        await screen.findByText("A hora de término precisa ser depois da hora de início."),
      ).toBeInTheDocument();
      expect(field(/^Hora de término/)).toHaveAttribute("aria-invalid", "true");
      expect(field(/^Hora de término/)).toHaveFocus();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("maps 400 LESSON_OUTSIDE_CLASS_PERIOD to Data da aula, with the class period and the focus on it", async () => {
      server.use(
        listCourseLessonPlansHandler(),
        createLessonHandler({ error: OUTSIDE_PERIOD_ERROR }),
      );
      const user = userEvent.setup();
      const { onClose } = await renderCreate();
      await waitForPlans();
      await fillRequired(user);
      setField(/^Data da aula/, "2026-07-15");

      await save(user);

      const message = `A data precisa estar dentro do período da turma (${PERIOD_TEXT}).`;
      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(field(/^Data da aula/)).toHaveAttribute("aria-invalid", "true");
      expect(field(/^Data da aula/)).toHaveAccessibleDescription(message);
      expect(field(/^Data da aula/)).toHaveFocus();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.queryByText("Aula criada")).not.toBeInTheDocument();
    });

    it("clears the error of the date when the person changes it", async () => {
      server.use(
        listCourseLessonPlansHandler(),
        createLessonHandler({ error: OUTSIDE_PERIOD_ERROR }),
      );
      const user = userEvent.setup();
      await renderCreate();
      await waitForPlans();
      await fillRequired(user);
      await save(user);
      await screen.findByText(/A data precisa estar dentro do período da turma/);

      setField(/^Data da aula/, "2026-03-11");

      await waitFor(() =>
        expect(field(/^Data da aula/)).not.toHaveAttribute("aria-invalid", "true"),
      );
      expect(screen.queryByText(/A data precisa estar dentro do período/)).not.toBeInTheDocument();
    });

    it("maps 400 LESSON_PLAN_NOT_IN_COURSE_SEQUENCE to the plan field, with the focus on it, and loads the sequence again", async () => {
      const onList = vi.fn();
      useSequenceHandlers();
      server.use(
        listCourseLessonPlansHandler({ onCall: onList }),
        createLessonHandler({ error: LESSON_PLAN_NOT_IN_SEQUENCE_ERROR }),
      );
      const user = userEvent.setup();
      await renderCreate();
      await waitForPlans();
      await choosePlan(user, "Senhas e privacidade");
      fillSchedule();
      await save(user);

      expect(
        await screen.findByText(
          "Este plano não pode originar a aula. Escolha outro plano da sequência do curso.",
        ),
      ).toBeInTheDocument();
      expect(planTrigger()).toHaveFocus();
      await waitFor(() => expect(onList).toHaveBeenCalledTimes(2));
    });

    it("maps 400 VALIDATION_FAILED to the fields it points at, with the focus on the first one on the screen", async () => {
      server.use(
        listCourseLessonPlansHandler(),
        createLessonHandler({
          error: VALIDATION_ERROR([
            { field: "subject", message: "too long" },
            { field: "title", message: "invalid" },
          ]),
        }),
      );
      const user = userEvent.setup();
      await renderCreate();
      await waitForPlans();
      await fillRequired(user);

      await save(user);

      await waitFor(() =>
        expect(screen.getAllByText("Revise este campo e tente de novo.")).toHaveLength(2),
      );
      expect(textbox("Título da aula")).toHaveFocus();
      expect(textbox("Assunto da aula")).toHaveAttribute("aria-invalid", "true");
    });

    it("shows 409 CLASS_ARCHIVED as an alert, with the focus on it", async () => {
      server.use(
        listCourseLessonPlansHandler(),
        createLessonHandler({ error: CLASS_ARCHIVED_ERROR }),
      );
      const user = userEvent.setup();
      const { onClose } = await renderCreate();
      await waitForPlans();
      await fillRequired(user);

      await save(user);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(
        "A turma está arquivada. As aulas de uma turma arquivada ficam só para leitura.",
      );
      await waitFor(() => expect(alert.parentElement).toHaveFocus());
      expect(onClose).not.toHaveBeenCalled();
    });

    it("shows a network failure as an alert, and the next attempt clears it and saves", async () => {
      const created = buildLesson({ title: "Aula de teclado" });
      server.use(listCourseLessonPlansHandler(), createLessonHandler({ networkError: true }));
      const user = userEvent.setup();
      const { onClose } = await renderCreate();
      await waitForPlans();
      await fillRequired(user);

      await save(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível conectar. Verifique sua conexão e tente novamente.",
      );

      server.use(createLessonHandler({ response: created }));
      await save(user);

      expect(await screen.findByText("Aula criada")).toBeInTheDocument();
      expect(within(screen.getByRole("dialog")).queryByRole("alert")).not.toBeInTheDocument();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("shows any other error as the generic alert", async () => {
      server.use(
        listCourseLessonPlansHandler(),
        createLessonHandler({ error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" } }),
      );
      const user = userEvent.setup();
      await renderCreate();
      await waitForPlans();
      await fillRequired(user);

      await save(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível concluir a ação. Tente novamente.",
      );
    });
  });

  describe("saving", () => {
    it("shows the toast Aula criada, calls onSaved and closes, with the lesson in the cache", async () => {
      const created = buildLesson({ title: "Aula de teclado" });
      server.use(listCourseLessonPlansHandler(), createLessonHandler({ response: created }));
      const user = userEvent.setup();
      const { onClose, onSaved, queryClient } = await renderCreate();
      await waitForPlans();
      await fillRequired(user);

      await save(user);

      expect(await screen.findByText("Aula criada")).toBeInTheDocument();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onSaved).toHaveBeenCalledWith(created);
      expect(queryClient.getQueryData(getGetLessonQueryKey(created.id))).toEqual(created);
    });

    it("keeps the dialog shut and ignores a second press while the request is on its way", async () => {
      const response = createDeferred();
      const onCall = vi.fn<(call: CreateLessonCall) => void>();
      server.use(
        listCourseLessonPlansHandler(),
        createLessonHandler({ delay: response.promise, onCall }),
      );
      const user = userEvent.setup();
      const { onClose } = await renderCreate();
      await waitForPlans();
      await fillRequired(user);

      await save(user);
      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));

      await user.keyboard("{Escape}");
      await user.click(button("Fechar"));
      await user.click(button("Cancelar"));
      await user.click(button(/Salvando/));
      expect(onClose).not.toHaveBeenCalled();
      expect(button("Cancelar")).toBeDisabled();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(document.querySelector("form")).toHaveAttribute("aria-busy", "true");
      expect(onCall).toHaveBeenCalledTimes(1);

      response.resolve();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledTimes(1);
    });
  });
});

describe("LessonFormDialog (edit)", () => {
  describe("loading", () => {
    it("shows a status while the lesson loads, with Salvar aula off", async () => {
      const lesson = createDeferred();
      server.use(getLessonHandler({ delay: lesson.promise }));
      await renderEdit();

      expect(screen.getByRole("status")).toHaveTextContent("Carregando a aula…");
      expect(button("Salvar aula")).toBeDisabled();

      lesson.resolve();
      expect(await screen.findByRole("textbox", { name: "Título da aula" })).toBeInTheDocument();
      expect(button("Salvar aula")).toBeEnabled();
    });

    it("shows the error with 'Tentar de novo' when the lesson cannot be loaded, and loads it again", async () => {
      server.use(getLessonHandler({ networkError: true }));
      const user = userEvent.setup();
      await renderEdit();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar a aula.",
      );
      expect(button("Salvar aula")).toBeDisabled();

      server.use(getLessonHandler());
      await user.click(button("Tentar de novo"));

      expect(await screen.findByRole("textbox", { name: "Título da aula" })).toHaveValue(
        "Teclado, mouse e janelas",
      );
    });

    it("says the lesson is gone, without a retry, when it does not exist", async () => {
      server.use(getLessonHandler({ error: LESSON_NOT_FOUND_ERROR }));
      await renderEdit();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Aula não encontrada. Ela pode ter sido removida.",
      );
      expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
    });
  });

  describe("the form", () => {
    it("is prefilled; the class, the plan, the date and the times are read-only, with the way to change them", async () => {
      server.use(getLessonHandler());
      await renderEdit();
      await screen.findByRole("textbox", { name: "Título da aula" });

      expect(textbox("Título da aula")).toHaveValue("Teclado, mouse e janelas");
      expect(textbox("Objetivo")).toHaveValue("Usar teclado e mouse e organizar janelas.");
      expect(textbox("Local")).toHaveValue("Laboratório 2 — Bloco B");
      expect(textbox("Alunos esperados")).toHaveValue("12");
      expect(textbox("Monitores esperados")).toHaveValue("2");
      expect(textbox("Assunto da aula")).toHaveValue("");
      expect(textbox("Observações pós-aula")).toHaveValue("");
      expect(button(/Status/)).toHaveTextContent("Planejada");

      expect(field(/^Turma/)).toHaveValue(CLASS_NAME);
      expect(field(/^Turma/)).toHaveAttribute("readonly");
      expect(field(/^Plano de aula \(origem\)/)).toHaveValue("Teclado, mouse e janelas");
      expect(field(/^Plano de aula \(origem\)/)).toHaveAttribute("readonly");
      expect(field(/^Plano de aula \(origem\)/)).toHaveAccessibleDescription(
        "O plano de origem não muda depois que a aula é criada.",
      );
      for (const [label, value] of [
        [/^Data da aula/, "2026-03-10"],
        [/^Hora de início/, "09:00"],
        [/^Hora de término/, "11:00"],
      ] as const) {
        expect(field(label)).toHaveValue(value);
        expect(field(label)).toHaveAttribute("readonly");
        expect(field(label)).toHaveAccessibleDescription(
          "Para mudar data e horário, use Remarcar aula.",
        );
      }
    });

    it("says 'Sem plano' for a lesson that was created on its own", async () => {
      server.use(getLessonHandler({ response: buildStandaloneLesson() }));
      await renderEdit();
      await screen.findByRole("textbox", { name: "Título da aula" });

      expect(field(/^Plano de aula \(origem\)/)).toHaveValue("Sem plano (aula avulsa)");
    });

    it("shows the code of the class when it has no name", async () => {
      server.use(
        getLessonHandler({
          response: buildLesson({
            class: { ...buildLesson().class, name: null },
          }),
        }),
      );
      await renderEdit();
      await screen.findByRole("textbox", { name: "Título da aula" });

      expect(field(/^Turma/)).toHaveValue("INFO-A");
    });

    it("offers planned, confirmed and done as status, and never cancelled", async () => {
      server.use(getLessonHandler());
      const user = userEvent.setup();
      await renderEdit();
      await screen.findByRole("textbox", { name: "Título da aula" });

      await user.click(button(/Status/));

      expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
        "Planejada",
        "Confirmada",
        "Realizada",
      ]);
    });

    it("focuses the title when the form opens", async () => {
      server.use(getLessonHandler());
      await renderEdit();

      await waitFor(() => expect(textbox("Título da aula")).toHaveFocus());
    });
  });

  describe("saving", () => {
    it("PATCHes only the editable fields, with the status and the post-lesson notes, and never the schedule", async () => {
      const onCall = vi.fn<(call: UpdateLessonCall) => void>();
      const updated = buildLesson({ title: "Novo título", status: LessonStatus.done });
      server.use(getLessonHandler(), updateLessonHandler({ response: updated, onCall }));
      const user = userEvent.setup();
      const { onClose, onSaved, queryClient } = await renderEdit();
      await screen.findByRole("textbox", { name: "Título da aula" });

      await user.clear(textbox("Título da aula"));
      await user.type(textbox("Título da aula"), "Novo título");
      await user.clear(textbox("Local"));
      await user.clear(textbox("Alunos esperados"));
      await user.type(textbox("Assunto da aula"), "Mouse");
      await user.click(button(/Status/));
      await user.click(screen.getByRole("option", { name: "Realizada" }));
      await user.type(textbox("Observações pós-aula"), "Faltaram dois alunos.");
      await save(user);

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      const { id, body } = onCall.mock.calls[0][0];
      expect(id).toBe(LESSON_ID);
      expect(body).toEqual({
        title: "Novo título",
        objective: "Usar teclado e mouse e organizar janelas.",
        location: null,
        subject: "Mouse",
        expectedStudents: null,
        expectedMonitors: 2,
        status: LessonStatus.done,
        postNotes: "Faltaram dois alunos.",
      });
      for (const locked of [
        "date",
        "startTime",
        "endTime",
        "classId",
        "lessonPlanId",
        "sequenceOrder",
      ]) {
        expect(body).not.toHaveProperty(locked);
      }

      expect(await screen.findByText("Aula atualizada")).toBeInTheDocument();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onSaved).toHaveBeenCalledWith(updated);
      expect(queryClient.getQueryData(getGetLessonQueryKey(LESSON_ID))).toEqual(updated);
    });

    it("clears the title with a message when it is emptied, and sends nothing", async () => {
      const onCall = vi.fn();
      server.use(getLessonHandler(), updateLessonHandler({ onCall }));
      const user = userEvent.setup();
      await renderEdit();
      await screen.findByRole("textbox", { name: "Título da aula" });

      await user.clear(textbox("Título da aula"));
      await save(user);

      expect(await screen.findByText("Informe o título da aula.")).toBeInTheDocument();
      expect(onCall).not.toHaveBeenCalled();
    });

    it("shows a 409 LESSON_CANCELLED as a warning with the focus, turns Salvar aula off and loads the lesson again", async () => {
      const onGet = vi.fn();
      server.use(
        getLessonHandler({ onCall: onGet }),
        updateLessonHandler({ error: LESSON_CANCELLED_ERROR }),
      );
      const user = userEvent.setup();
      const { onClose } = await renderEdit();
      await screen.findByRole("textbox", { name: "Título da aula" });
      await user.type(textbox("Assunto da aula"), "Mouse");

      await save(user);

      const warning = await screen.findByText(
        "Esta aula está cancelada e não pode mais ser alterada.",
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      await waitFor(() => expect(warning.closest("[tabindex='-1']")).toHaveFocus());
      expect(button("Salvar aula")).toBeDisabled();
      expect(onClose).not.toHaveBeenCalled();
      await waitFor(() => expect(onGet).toHaveBeenCalledTimes(2));
      // What was typed is still there, and the form was not swapped for another screen.
      expect(textbox("Assunto da aula")).toHaveValue("Mouse");
    });

    it("keeps the form and what was typed when the lesson turns out to be cancelled on the refetch", async () => {
      server.use(getLessonHandler(), updateLessonHandler({ error: LESSON_CANCELLED_ERROR }));
      const user = userEvent.setup();
      await renderEdit();
      await screen.findByRole("textbox", { name: "Título da aula" });
      await user.type(textbox("Assunto da aula"), "Mouse");
      server.use(getLessonHandler({ response: buildCancelledLesson() }));

      await save(user);
      await screen.findByText("Esta aula está cancelada e não pode mais ser alterada.");
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(textbox("Assunto da aula")).toHaveValue("Mouse");
      expect(
        screen.getAllByText("Esta aula está cancelada e não pode mais ser alterada."),
      ).toHaveLength(1);
    });

    it("shows a 404 LESSON_NOT_FOUND as an alert and loads the lesson again", async () => {
      const onGet = vi.fn();
      server.use(
        getLessonHandler({ onCall: onGet }),
        updateLessonHandler({ error: LESSON_NOT_FOUND_ERROR }),
      );
      const user = userEvent.setup();
      await renderEdit();
      await screen.findByRole("textbox", { name: "Título da aula" });

      await save(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Aula não encontrada. Ela pode ter sido removida.",
      );
      await waitFor(() => expect(onGet).toHaveBeenCalledTimes(2));
    });

    it("shows the warning only, with Salvar aula off, for a lesson that is already cancelled", async () => {
      server.use(getLessonHandler({ response: buildCancelledLesson() }));
      await renderEdit();

      expect(
        await screen.findByText("Esta aula está cancelada e não pode mais ser alterada."),
      ).toBeInTheDocument();
      expect(screen.queryByRole("textbox", { name: "Título da aula" })).not.toBeInTheDocument();
      expect(button("Salvar aula")).toBeDisabled();
      expect(button("Cancelar")).toBeEnabled();
    });

    it("shows 409 CLASS_ARCHIVED as an alert and keeps Salvar aula on", async () => {
      server.use(getLessonHandler(), updateLessonHandler({ error: CLASS_ARCHIVED_ERROR }));
      const user = userEvent.setup();
      await renderEdit();
      await screen.findByRole("textbox", { name: "Título da aula" });

      await save(user);

      expect(await screen.findByRole("alert")).toHaveTextContent("A turma está arquivada");
      expect(button("Salvar aula")).toBeEnabled();
    });

    it("does not map an error of the date to a field: the date is read-only here", async () => {
      server.use(getLessonHandler(), updateLessonHandler({ error: OUTSIDE_PERIOD_ERROR }));
      const user = userEvent.setup();
      await renderEdit();
      await screen.findByRole("textbox", { name: "Título da aula" });

      await save(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível concluir a ação. Tente novamente.",
      );
      expect(field(/^Data da aula/)).not.toHaveAttribute("aria-invalid", "true");
    });

    it("keeps the dialog shut and ignores a second press while the request is on its way", async () => {
      const response = createDeferred();
      const onCall = vi.fn<(call: UpdateLessonCall) => void>();
      server.use(getLessonHandler(), updateLessonHandler({ delay: response.promise, onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderEdit();
      await screen.findByRole("textbox", { name: "Título da aula" });

      await save(user);
      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      await user.keyboard("{Escape}");
      await user.click(button("Fechar"));
      await user.click(button("Cancelar"));
      await user.click(button(/Salvando/));

      expect(onClose).not.toHaveBeenCalled();
      expect(onCall).toHaveBeenCalledTimes(1);

      response.resolve();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });
  });
});
