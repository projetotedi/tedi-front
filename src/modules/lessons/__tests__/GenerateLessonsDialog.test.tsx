import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getGetClassQueryKey } from "@api/generated/classes/classes";
import {
  getListLessonsCalendarQueryKey,
  getListLessonsQueryKey,
  getPreviewClassLessonsUrl,
} from "@api/generated/lessons/lessons";
import { Role } from "@shared/lib/role";

import {
  GenerateLessonsDialog,
  type GenerateLessonsDialogProps,
} from "../components/GenerateLessonsDialog";
import { PREVIEW_DEBOUNCE_MS } from "../hooks/useClassLessonsPreview";
import {
  buildGeneratedLessons,
  buildLessonsPage,
  buildMeUser,
  buildOutsidePreview,
  buildPreview,
  buildPreviewFor,
  buildSkippedPlan,
  CLASS_ARCHIVED_ERROR,
  CLASS_ID,
  CLASS_NOT_FOUND_ERROR,
  CLASS_START_DATE,
  COURSE_NAME,
  COURSE_WITHOUT_SEQUENCE_ERROR,
  FIGMA_BODY,
  generateClassLessonsHandler,
  INVALID_TIME_RANGE_ERROR,
  LESSONS_ALREADY_GENERATED_ERROR,
  LESSONS_OUTSIDE_CLASS_PERIOD_ERROR,
  PLAN_FIXTURES,
  previewClassLessonsHandler,
  type ClassBodyCall,
} from "./generate-handlers";
import { createDeferred, renderWithProviders, server, setupLessonsTestServer } from "./test-utils";

setupLessonsTestServer();

// The answers of the API as it would give them: a test that cares about a route says so with its
// own handler, which wins over these. The fake clock still follows the real one (`shouldAdvanceTime`),
// so the requests of MSW and the `waitFor` of Testing Library keep moving; what it saves is the pause of
// the preview (400 ms), which each test skips by advancing it instead of waiting for it.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  server.use(previewClassLessonsHandler(), generateClassLessonsHandler());
});
afterEach(() => {
  vi.useRealTimers();
});

const setupUser = (): UserEvent => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

const PREVIEW_LIST = { name: "Datas das aulas" };

const dialog = () => screen.getByRole("dialog", { name: "Gerar aulas da turma" });
const weekdaySelect = () => screen.getByRole("button", { name: /Dia da semana/ });
const startTimeField = () => screen.getByLabelText("Hora de início");
const endTimeField = () => screen.getByLabelText("Hora de término");
const firstDateField = () => screen.getByLabelText("Data da primeira aula");
const locationField = () => screen.getByRole("textbox", { name: "Local padrão" });
const backButton = () => screen.getByRole("button", { name: "Voltar" });
/** The footer button: "Gerar aulas" before there is a preview, "Gerar N aulas" after it. */
const generateButton = () => screen.getByRole("button", { name: /^Gerar( \d+ aulas?| aulas)$/ });
/** The title of an alert. The live region says the same words aloud, so the text alone finds two. */
const findAlertTitle = (text: string) =>
  screen.findByText(text, { selector: "[data-slot='alert-title']" });

const rowsOfList = () => within(screen.getByRole("list", PREVIEW_LIST)).getAllByRole("listitem");
const dateOfRow = (row: HTMLElement) => within(row).getByText(/^\d{2}\/\d{2}\/\d{4}$/).textContent;

type Props = Partial<GenerateLessonsDialogProps>;

async function renderDialog({ onClose = vi.fn(), ...props }: Props = {}) {
  const view = await renderWithProviders(
    <GenerateLessonsDialog
      classId={CLASS_ID}
      courseName={COURSE_NAME}
      defaultFirstDate={CLASS_START_DATE}
      onClose={onClose}
      {...props}
    />,
    { user: buildMeUser(Role.coordinator) },
  );
  await screen.findByRole("dialog", { name: "Gerar aulas da turma" });
  return { ...view, onClose };
}

async function chooseWeekday(user: UserEvent, name: string) {
  await user.click(weekdaySelect());
  await user.click(await screen.findByRole("option", { name }));
}

/** Tuesdays, 09:00 to 11:00 (the Figma), on top of the first date the dialog starts with. */
async function fillValidForm(
  user: UserEvent,
  { weekday = "Terça-feira", start = "09:00", end = "11:00" } = {},
) {
  await chooseWeekday(user, weekday);
  await user.type(startTimeField(), start);
  await user.type(endTimeField(), end);
  await advance(PREVIEW_DEBOUNCE_MS);
}

/** A date input is set as a whole: typing it key by key is not how the browser gives it. */
function setFirstDate(value: string) {
  fireEvent.change(firstDateField(), { target: { value } });
}

/** Moves the fake clock, which is how a test crosses the pause of the preview without waiting for it. */
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe("GenerateLessonsDialog", () => {
  describe("layout", () => {
    it("has the five labelled fields, the first date filled with the start of the class", async () => {
      await renderDialog();

      expect(within(dialog()).getByRole("button", { name: /Dia da semana/ })).toBeVisible();
      expect(startTimeField()).toHaveAttribute("type", "time");
      expect(endTimeField()).toHaveAttribute("type", "time");
      expect(firstDateField()).toHaveAttribute("type", "date");
      expect(firstDateField()).toHaveValue(CLASS_START_DATE);
      expect(locationField()).toHaveValue("");
      // The weekday and the times start empty: the person chooses them.
      expect(weekdaySelect()).toHaveTextContent("Escolha o dia");
      expect(startTimeField()).toHaveValue("");
      expect(endTimeField()).toHaveValue("");
    });

    it("marks the weekday, the times and the first date as required, and the location as optional", async () => {
      await renderDialog();

      for (const field of [startTimeField(), endTimeField(), firstDateField()]) {
        expect(field).toBeRequired();
      }
      expect(weekdaySelect().closest("[data-required='true']")).not.toBeNull();
      expect(locationField()).not.toBeRequired();
    });

    it("explains where the first lesson falls, below the first date", async () => {
      await renderDialog();

      expect(firstDateField()).toHaveAccessibleDescription(
        "A primeira aula cai no primeiro dia da semana escolhido a partir desta data.",
      );
    });

    it("offers the seven days of the week, in order, in Portuguese", async () => {
      const user = setupUser();
      await renderDialog();

      await user.click(weekdaySelect());

      expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
        "Segunda-feira",
        "Terça-feira",
        "Quarta-feira",
        "Quinta-feira",
        "Sexta-feira",
        "Sábado",
        "Domingo",
      ]);
    });

    it("is the 800px dialog, with Voltar and Gerar aulas in the footer", async () => {
      await renderDialog();

      expect(dialog()).toHaveClass("max-w-200");
      expect(within(dialog()).getByRole("button", { name: "Fechar" })).toBeInTheDocument();
      expect(backButton()).toHaveClass("button--secondary", "min-h-11");
      expect(generateButton()).toHaveClass("button--primary", "min-h-11");
    });

    it("keeps the 44px targets and the 16px font on the fields", async () => {
      await renderDialog();

      for (const field of [startTimeField(), endTimeField(), firstDateField(), locationField()]) {
        expect(field).toHaveClass("min-h-11", "text-base");
      }
      expect(weekdaySelect()).toHaveClass("min-h-11", "text-base");
    });

    it("focuses the first field when it opens", async () => {
      await renderDialog();

      expect(weekdaySelect()).toHaveFocus();
    });

    it("says what to fill before there is a preview, and Gerar aulas is off", async () => {
      await renderDialog();

      expect(screen.getByRole("heading", { level: 3, name: "Prévia das datas" })).toBeVisible();
      expect(
        screen.getByText(
          "Preencha o dia da semana, os horários e a data da primeira aula para ver a prévia das datas.",
        ),
      ).toBeVisible();
      expect(screen.queryByRole("list", PREVIEW_LIST)).not.toBeInTheDocument();
      expect(generateButton()).toBeDisabled();
      expect(generateButton()).toHaveAccessibleDescription(/Preencha o dia da semana/);
    });

    it("shows the summary without a count before there is a preview", async () => {
      await renderDialog();

      expect(screen.getByText("As aulas serão criadas a partir do plano do curso")).toBeVisible();
    });
  });

  describe("preview", () => {
    it("asks nothing until every field is valid", async () => {
      const onCall = vi.fn();
      server.use(previewClassLessonsHandler({ onCall }));
      const user = setupUser();
      await renderDialog();

      await chooseWeekday(user, "Terça-feira");
      await user.type(startTimeField(), "09:00");
      await advance(PREVIEW_DEBOUNCE_MS + 200);

      // The end time is still missing.
      expect(onCall).not.toHaveBeenCalled();
      expect(screen.queryByRole("list", PREVIEW_LIST)).not.toBeInTheDocument();

      await user.type(endTimeField(), "11:00");

      await screen.findByRole("list", PREVIEW_LIST);
      expect(onCall).toHaveBeenCalledTimes(1);
    });

    it("asks for the class of the dialog, with the five fields as the API takes them", async () => {
      const onCall = vi.fn<(call: ClassBodyCall) => void>();
      server.use(previewClassLessonsHandler({ onCall }));
      const user = setupUser();
      await renderDialog();

      await fillValidForm(user);
      await user.type(locationField(), "Laboratório 2 — Bloco B");
      await advance(PREVIEW_DEBOUNCE_MS);

      await waitFor(() =>
        expect(onCall).toHaveBeenLastCalledWith({ id: CLASS_ID, body: FIGMA_BODY }),
      );
    });

    it("does not ask on every key: typing the location is one request after the pause", async () => {
      const onCall = vi.fn();
      server.use(previewClassLessonsHandler({ onCall }));
      const user = setupUser();
      await renderDialog();
      await fillValidForm(user);
      await screen.findByRole("list", PREVIEW_LIST);
      expect(onCall).toHaveBeenCalledTimes(1);

      await user.type(locationField(), "Lab 2");
      await advance(PREVIEW_DEBOUNCE_MS);

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(2));
      await advance(PREVIEW_DEBOUNCE_MS + 200);
      expect(onCall).toHaveBeenCalledTimes(2);
    });

    it("lists number, date, title and duration of each lesson, in the order of the plan", async () => {
      const user = setupUser();
      await renderDialog();

      await fillValidForm(user);

      await screen.findByRole("list", PREVIEW_LIST);
      const rows = rowsOfList();
      expect(rows).toHaveLength(3);
      expect(rows.map((row) => dateOfRow(row))).toEqual(["07/04/2026", "14/04/2026", "21/04/2026"]);
      expect(within(rows[0]).getByText("1")).toHaveAttribute("aria-hidden", "true");
      expect(within(rows[0]).getByText("Aula 1")).toHaveClass("sr-only");
      expect(within(rows[0]).getByText("Conhecendo o computador")).toBeInTheDocument();
      expect(within(rows[0]).getByText("1h30")).toBeInTheDocument();
      expect(within(rows[1]).getByText("Teclado, mouse e janelas")).toBeInTheDocument();
      expect(within(rows[2]).getByText("Navegando na internet")).toBeInTheDocument();
      expect(within(rows[2]).getByText("1h")).toBeInTheDocument();
      expect(within(rows[2]).getByText("3")).toBeInTheDocument();
    });

    it("sets the color of the text of each row, because the body of the dialog is muted (4,2:1 on the row)", async () => {
      const user = setupUser();
      await renderDialog();

      await fillValidForm(user);

      await screen.findByRole("list", PREVIEW_LIST);
      const [row] = rowsOfList();
      expect(within(row).getByText("07/04/2026")).toHaveClass("text-foreground");
      expect(within(row).getByText("Conhecendo o computador")).toHaveClass("text-foreground");
      expect(within(row).getByText("1h30")).toHaveClass("text-tedi-neutral-foreground");
      expect(within(row).getByText("1")).toHaveClass("text-foreground");
      expect(screen.getByRole("heading", { level: 3, name: "Prévia das datas" })).toHaveClass(
        "text-foreground",
      );
    });

    it("lets the title of a lesson go to its own line on a narrow screen, instead of breaking inside a word", async () => {
      const user = setupUser();
      await renderDialog();

      await fillValidForm(user);

      await screen.findByRole("list", PREVIEW_LIST);
      const [row] = rowsOfList();
      expect(row).toHaveClass("flex-wrap");
      expect(within(row).getByText("Conhecendo o computador")).toHaveClass("basis-40", "flex-1");
    });

    it("gives the description of the summary the foreground color, which the muted one of the alert is under 4,5:1", async () => {
      await renderDialog();

      const description = screen.getByText(/^Uma por plano de aula do curso Informática Básica/);

      expect(description).toHaveClass("text-foreground");
      expect(description.closest("[data-slot='alert-description']")).not.toBeNull();
    });

    it("shows the schedule of the preview next to its title, read from the answer", async () => {
      const user = setupUser();
      await renderDialog();

      await fillValidForm(user);

      expect(await screen.findByText("Toda terça-feira, 09:00–11:00")).toBeVisible();
    });

    it("shows how many lessons will be created, from the preview, and the course name", async () => {
      const user = setupUser();
      await renderDialog();

      await fillValidForm(user);

      expect(await screen.findByText("3 aulas serão criadas")).toBeVisible();
      expect(
        screen.getByText(
          "Uma por plano de aula do curso Informática Básica, na ordem do plano. Título e objetivo são copiados para cada aula.",
        ),
      ).toBeVisible();
      expect(screen.queryByText("As aulas serão criadas a partir do plano do curso")).toBeNull();
    });

    it("says one lesson in the singular", async () => {
      server.use(
        previewClassLessonsHandler({
          response: (call) => buildPreviewFor(call.body, { plans: PLAN_FIXTURES.slice(0, 1) }),
        }),
      );
      const user = setupUser();
      await renderDialog();

      await fillValidForm(user);

      expect(await screen.findByText("1 aula será criada")).toBeVisible();
      expect(generateButton()).toHaveAccessibleName("Gerar 1 aula");
    });

    it("says which archived plans are left out", async () => {
      server.use(
        previewClassLessonsHandler({
          response: (call) =>
            buildPreviewFor(call.body, { skippedLessonPlans: [buildSkippedPlan()] }),
        }),
      );
      const user = setupUser();
      await renderDialog();

      await fillValidForm(user);

      expect(
        await screen.findByText(/O plano arquivado “Redes sociais antigas” fica de fora\.$/),
      ).toBeVisible();
    });

    it("lists the titles when more than one archived plan is left out", async () => {
      server.use(
        previewClassLessonsHandler({
          response: (call) =>
            buildPreviewFor(call.body, {
              skippedLessonPlans: [
                buildSkippedPlan({ title: "Redes sociais antigas" }),
                buildSkippedPlan({ title: "Planilhas e e-mail", sequenceOrder: 5 }),
              ],
            }),
        }),
      );
      const user = setupUser();
      await renderDialog();

      await fillValidForm(user);

      expect(
        await screen.findByText(
          /Os 2 planos arquivados ficam de fora: “Redes sociais antigas” e “Planilhas e e-mail”\.$/,
        ),
      ).toBeVisible();
    });

    it("changing the weekday asks for a new preview and never calls generate", async () => {
      const onPreview = vi.fn<(call: ClassBodyCall) => void>();
      const onGenerate = vi.fn();
      server.use(
        previewClassLessonsHandler({ onCall: onPreview }),
        generateClassLessonsHandler({ onCall: onGenerate }),
      );
      const user = setupUser();
      await renderDialog();
      await fillValidForm(user);
      await screen.findByRole("list", PREVIEW_LIST);
      expect(rowsOfList().map((row) => dateOfRow(row))).toEqual([
        "07/04/2026",
        "14/04/2026",
        "21/04/2026",
      ]);
      expect(onPreview).toHaveBeenCalledTimes(1);

      await chooseWeekday(user, "Quinta-feira");
      await advance(PREVIEW_DEBOUNCE_MS);

      await waitFor(() => expect(onPreview).toHaveBeenCalledTimes(2));
      expect(onPreview.mock.calls[1][0].body.weekday).toBe("thursday");
      await waitFor(() =>
        expect(rowsOfList().map((row) => dateOfRow(row))).toEqual([
          "09/04/2026",
          "16/04/2026",
          "23/04/2026",
        ]),
      );
      expect(screen.getByText("Toda quinta-feira, 09:00–11:00")).toBeVisible();
      expect(onGenerate).not.toHaveBeenCalled();
    });

    it("asks again when the first date changes, and the first lesson follows it", async () => {
      const onPreview = vi.fn<(call: ClassBodyCall) => void>();
      server.use(previewClassLessonsHandler({ onCall: onPreview }));
      const user = setupUser();
      await renderDialog();
      await fillValidForm(user);
      await screen.findByRole("list", PREVIEW_LIST);

      setFirstDate("2026-04-08");

      await advance(PREVIEW_DEBOUNCE_MS);

      await waitFor(() => expect(onPreview).toHaveBeenCalledTimes(2));
      expect(onPreview.mock.calls[1][0].body.firstDate).toBe("2026-04-08");
      // The first Tuesday on or after Wednesday 08/04 is 14/04.
      await waitFor(() => expect(dateOfRow(rowsOfList()[0])).toBe("14/04/2026"));
    });

    it("keeps the last list, marked as busy, while the next one is on its way", async () => {
      const user = setupUser();
      await renderDialog();
      await fillValidForm(user);
      await screen.findByRole("list", PREVIEW_LIST);
      expect(screen.getByRole("list", PREVIEW_LIST)).toHaveAttribute("aria-busy", "false");

      const deferred = createDeferred();
      server.use(previewClassLessonsHandler({ delay: deferred.promise }));
      await chooseWeekday(user, "Quinta-feira");
      await advance(PREVIEW_DEBOUNCE_MS);

      expect(await screen.findByText("Atualizando a prévia…")).toBeVisible();
      // Tuesdays are still there, and Gerar is off: it is not the preview of what is typed.
      expect(screen.getByRole("list", PREVIEW_LIST)).toHaveAttribute("aria-busy", "true");
      expect(dateOfRow(rowsOfList()[0])).toBe("07/04/2026");
      expect(generateButton()).toBeDisabled();

      deferred.resolve();

      await waitFor(() => expect(dateOfRow(rowsOfList()[0])).toBe("09/04/2026"));
      expect(screen.getByRole("list", PREVIEW_LIST)).toHaveAttribute("aria-busy", "false");
      expect(screen.queryByText("Atualizando a prévia…")).not.toBeInTheDocument();
      expect(generateButton()).toBeEnabled();
    });

    it("an end time before the start is shown on the field and asks nothing", async () => {
      const onCall = vi.fn();
      server.use(previewClassLessonsHandler({ onCall }));
      const user = setupUser();
      await renderDialog();

      await fillValidForm(user, { start: "11:00", end: "09:00" });
      await user.tab();

      expect(
        await screen.findByText("A hora de término deve ser depois da hora de início."),
      ).toBeVisible();
      expect(endTimeField()).toHaveAttribute("aria-invalid", "true");
      await advance(PREVIEW_DEBOUNCE_MS + 200);
      expect(onCall).not.toHaveBeenCalled();
      expect(generateButton()).toBeDisabled();
    });

    it("an end time equal to the start is refused too", async () => {
      const onCall = vi.fn();
      server.use(previewClassLessonsHandler({ onCall }));
      const user = setupUser();
      await renderDialog();

      await fillValidForm(user, { start: "09:00", end: "09:00" });
      await user.tab();

      expect(
        await screen.findByText("A hora de término deve ser depois da hora de início."),
      ).toBeVisible();
      await advance(PREVIEW_DEBOUNCE_MS + 200);
      expect(onCall).not.toHaveBeenCalled();
    });

    it("asks for a first date when it is cleared, and asks nothing", async () => {
      const onCall = vi.fn();
      server.use(previewClassLessonsHandler({ onCall }));
      const user = setupUser();
      await renderDialog();
      await fillValidForm(user);
      await screen.findByRole("list", PREVIEW_LIST);
      expect(onCall).toHaveBeenCalledTimes(1);

      setFirstDate("");
      await user.click(firstDateField());
      await user.tab();

      expect(await screen.findByText("Informe a data da primeira aula.")).toBeVisible();
      expect(firstDateField()).toHaveAttribute("aria-invalid", "true");
      await advance(PREVIEW_DEBOUNCE_MS + 200);
      expect(onCall).toHaveBeenCalledTimes(1);
      expect(generateButton()).toBeDisabled();
    });

    it("refuses a location of 201 characters, on the field, and asks nothing about it", async () => {
      const onCall = vi.fn();
      server.use(previewClassLessonsHandler({ onCall }));
      const user = setupUser();
      await renderDialog();
      await fillValidForm(user);
      await screen.findByRole("list", PREVIEW_LIST);
      expect(onCall).toHaveBeenCalledTimes(1);

      await user.click(locationField());
      await user.paste("a".repeat(201));
      await user.tab();

      expect(await screen.findByText("O local pode ter no máximo 200 caracteres.")).toBeVisible();
      await advance(PREVIEW_DEBOUNCE_MS + 200);
      expect(onCall).toHaveBeenCalledTimes(1);
    });

    it("announces the updated preview in a live region", async () => {
      const user = setupUser();
      await renderDialog();

      await fillValidForm(user);

      const announcement = await screen.findByText(
        "Prévia atualizada: de 07/04/2026 a 21/04/2026.",
      );
      expect(announcement).toHaveAttribute("role", "status");
      expect(announcement).toHaveClass("sr-only");

      await chooseWeekday(user, "Quinta-feira");
      await advance(PREVIEW_DEBOUNCE_MS);

      expect(
        await screen.findByText("Prévia atualizada: de 09/04/2026 a 23/04/2026."),
      ).toBeInTheDocument();
    });

    it("announces a single lesson with its day, and says how many fall outside the period", async () => {
      server.use(
        previewClassLessonsHandler({
          response: (call) =>
            buildPreviewFor(call.body, {
              plans: PLAN_FIXTURES.slice(0, 1),
              classEndDate: "2026-04-06",
            }),
        }),
      );
      const user = setupUser();
      await renderDialog();

      await fillValidForm(user);

      expect(
        await screen.findByText(
          "Prévia atualizada: 1 aula, em 07/04/2026. 1 aula fica fora do período da turma.",
        ),
      ).toHaveAttribute("role", "status");
    });

    it("a failed preview shows the error and Tentar de novo, which asks again", async () => {
      const onCall = vi.fn();
      server.use(previewClassLessonsHandler({ networkError: true, onCall }));
      const user = setupUser();
      await renderDialog();

      await fillValidForm(user);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Não foi possível carregar a prévia das datas.");
      expect(screen.queryByRole("list", PREVIEW_LIST)).not.toBeInTheDocument();
      expect(generateButton()).toBeDisabled();

      server.use(previewClassLessonsHandler({ onCall }));
      await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

      await screen.findByRole("list", PREVIEW_LIST);
      expect(onCall).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(generateButton()).toBeEnabled();
    });

    it("shows the error of the preview when the server fails too, and a new try clears it", async () => {
      server.use(
        previewClassLessonsHandler({ error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" } }),
      );
      const user = setupUser();
      await renderDialog();

      await fillValidForm(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar a prévia das datas.",
      );
      expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();

      // Changing a field is a new question: the old failure goes away.
      server.use(previewClassLessonsHandler());
      await chooseWeekday(user, "Quinta-feira");
      await advance(PREVIEW_DEBOUNCE_MS);

      await screen.findByRole("list", PREVIEW_LIST);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("says the class no longer exists when the preview answers 404 CLASS_NOT_FOUND, with no retry", async () => {
      server.use(previewClassLessonsHandler({ error: CLASS_NOT_FOUND_ERROR }));
      const user = setupUser();
      await renderDialog();

      await fillValidForm(user);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Esta turma não existe mais");
      expect(alert).toHaveTextContent("Ela pode ter sido removida.");
      expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
      expect(generateButton()).toBeDisabled();
    });
  });

  describe("lessons outside the period of the class", () => {
    async function renderWithOutsidePreview(props: Props = {}) {
      server.use(previewClassLessonsHandler({ response: buildOutsidePreview() }));
      const user = setupUser();
      const view = await renderDialog(props);
      await fillValidForm(user);
      await screen.findByRole("list", PREVIEW_LIST);
      return { ...view, user };
    }

    it("marks the lessons outside the period and warns with the end of the class", async () => {
      await renderWithOutsidePreview();

      const rows = rowsOfList();
      expect(rows).toHaveLength(4);
      expect(within(rows[3]).getByText("28/04/2026")).toBeInTheDocument();
      expect(within(rows[3]).getByText("fora do período")).toBeInTheDocument();
      for (const row of rows.slice(0, 3)) {
        expect(within(row).queryByText("fora do período")).not.toBeInTheDocument();
      }
      expect(screen.getByText("A última aula cai depois do fim da turma")).toBeVisible();
      expect(
        screen.getByText(
          "A turma termina em 24/04/2026 e a 4ª aula ficaria em 28/04/2026. Estenda o período da turma ou comece uma semana antes: o sistema não grava aula fora do período.",
        ),
      ).toBeVisible();
    });

    it("says it in words, with the warning colors, and not only with a color", async () => {
      await renderWithOutsidePreview();

      const [, , , outside] = rowsOfList();
      expect(outside).toHaveClass("bg-tedi-warning");
      expect(within(outside).getByText("28/04/2026")).toHaveClass("text-tedi-warning-foreground");
      expect(within(outside).getByText("fora do período")).toHaveClass(
        "text-tedi-warning-foreground",
      );
      expect(rowsOfList()[0]).toHaveClass("bg-surface-secondary");
    });

    it("with a lesson outside the period, warns and keeps Gerar off", async () => {
      const onGenerate = vi.fn();
      server.use(generateClassLessonsHandler({ onCall: onGenerate }));
      const { user } = await renderWithOutsidePreview();

      expect(generateButton()).toHaveAccessibleName("Gerar 4 aulas");
      expect(generateButton()).toBeDisabled();
      expect(generateButton()).toHaveAccessibleDescription(
        /A última aula cai depois do fim da turma/,
      );

      await user.click(generateButton());

      expect(onGenerate).not.toHaveBeenCalled();
    });

    it("warns about the lessons before the start of the class with a title of its own", async () => {
      server.use(
        previewClassLessonsHandler({
          response: (call) =>
            buildPreviewFor({ ...call.body, firstDate: "2026-03-24" }, { plans: PLAN_FIXTURES }),
        }),
      );
      const user = setupUser();
      await renderDialog();

      await fillValidForm(user);

      expect(await screen.findByText("A primeira aula cai antes do início da turma")).toBeVisible();
      expect(screen.getByText(/A turma começa em 07\/04\/2026\./)).toBeVisible();
      expect(generateButton()).toBeDisabled();
    });

    it("offers Editar turma when the screen gives the way to it, which closes the dialog and goes there", async () => {
      const onEditClass = vi.fn();
      const onClose = vi.fn();
      const { user } = await renderWithOutsidePreview({ onEditClass, onClose });

      const edit = screen.getByRole("button", { name: "Editar turma" });
      expect(edit).toHaveClass("button--secondary", "min-h-11");
      await user.click(edit);

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onEditClass).toHaveBeenCalledTimes(1);
      expect(onClose.mock.invocationCallOrder[0]).toBeLessThan(
        onEditClass.mock.invocationCallOrder[0],
      );
    });

    it("has no Editar turma when there is none", async () => {
      await renderWithOutsidePreview();

      expect(screen.queryByRole("button", { name: "Editar turma" })).not.toBeInTheDocument();
      // The text still says what to do.
      expect(screen.getByText(/Estenda o período da turma/)).toBeVisible();
    });

    it("has no warning when every lesson is inside the period", async () => {
      const user = setupUser();
      await renderDialog({ onEditClass: vi.fn() });

      await fillValidForm(user);
      await screen.findByRole("list", PREVIEW_LIST);

      expect(screen.queryByText("A última aula cai depois do fim da turma")).toBeNull();
      expect(screen.queryByText("fora do período")).toBeNull();
      expect(screen.queryByRole("button", { name: "Editar turma" })).toBeNull();
    });

    it("turns Gerar on again once the period of the class takes every lesson", async () => {
      // Four weekly lessons need 22 days and the class has 18: it is extended, and a field changes.
      let classEndDate = "2026-04-24";
      server.use(
        previewClassLessonsHandler({
          response: (call) => buildPreviewFor(call.body, { plans: PLAN_FIXTURES, classEndDate }),
        }),
      );
      const user = setupUser();
      await renderDialog();
      await fillValidForm(user);
      await screen.findByText("A última aula cai depois do fim da turma");
      expect(generateButton()).toBeDisabled();

      classEndDate = "2026-04-30";
      await chooseWeekday(user, "Quinta-feira");
      await advance(PREVIEW_DEBOUNCE_MS);

      await waitFor(() => expect(generateButton()).toBeEnabled());
      expect(generateButton()).toHaveAccessibleName("Gerar 4 aulas");
      expect(screen.queryByText("A última aula cai depois do fim da turma")).toBeNull();
      expect(screen.queryByText("fora do período")).toBeNull();
    });

    it("a 409 LESSONS_OUTSIDE_CLASS_PERIOD from generate shows the same warning, and asks the preview again", async () => {
      // The preview was clean, then somebody shortened the period of the class.
      let periodChanged = false;
      const onPreview = vi.fn();
      server.use(
        previewClassLessonsHandler({
          onCall: onPreview,
          response: () => (periodChanged ? buildOutsidePreview() : buildPreview()),
        }),
        generateClassLessonsHandler({
          error: LESSONS_OUTSIDE_CLASS_PERIOD_ERROR,
          onCall: () => {
            periodChanged = true;
          },
        }),
      );
      const user = setupUser();
      const { onClose } = await renderDialog();
      await fillValidForm(user);
      await screen.findByRole("list", PREVIEW_LIST);

      await user.click(generateButton());

      expect(await findAlertTitle("Há aulas fora do período da turma")).toBeVisible();
      expect(
        screen.getByText(/O sistema não grava aula fora do período\. Estenda o período da turma/),
      ).toBeVisible();
      // The list is asked again and marks the lesson that the period left out.
      await waitFor(() => expect(onPreview).toHaveBeenCalledTimes(2));
      expect(await screen.findByText("fora do período")).toBeVisible();
      expect(screen.getByText("A última aula cai depois do fim da turma")).toBeVisible();
      expect(generateButton()).toBeDisabled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("rules of the system", () => {
    it("warns when the lessons were already generated, in the preview", async () => {
      server.use(previewClassLessonsHandler({ error: LESSONS_ALREADY_GENERATED_ERROR }));
      const user = setupUser();
      await renderDialog();

      await fillValidForm(user);

      expect(await findAlertTitle("As aulas desta turma já foram geradas")).toBeVisible();
      expect(
        screen.getByText(
          "Cada turma gera as aulas do plano do curso uma única vez. Feche esta janela para ver as aulas da turma.",
        ),
      ).toBeVisible();
      // A rule is a warning, not a failure: no alert, no retry, no list.
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
      expect(screen.queryByRole("list", PREVIEW_LIST)).not.toBeInTheDocument();
      expect(generateButton()).toBeDisabled();
      expect(generateButton()).toHaveAccessibleDescription(/As aulas desta turma já foram geradas/);
    });

    it("announces the title of a rule that refuses the preview", async () => {
      server.use(previewClassLessonsHandler({ error: LESSONS_ALREADY_GENERATED_ERROR }));
      const user = setupUser();
      await renderDialog();

      await fillValidForm(user);

      await waitFor(() => {
        const announced = screen
          .getAllByText("As aulas desta turma já foram geradas")
          .filter((element) => element.getAttribute("role") === "status");
        expect(announced).toHaveLength(1);
      });
    });

    it("warns when the lessons were already generated, in generate, and tells the card behind the dialog", async () => {
      const user = setupUser();
      const { queryClient, onClose } = await renderDialog();
      const classKey = getGetClassQueryKey(CLASS_ID);
      const listKey = getListLessonsQueryKey({ classId: CLASS_ID, limit: 5 });
      queryClient.setQueryData(classKey, { id: CLASS_ID });
      queryClient.setQueryData(listKey, buildLessonsPage());
      await fillValidForm(user);
      await screen.findByRole("list", PREVIEW_LIST);

      // Somebody else generated them between the preview and the click: from now on the preview
      // answers the same.
      const onPreview = vi.fn();
      server.use(
        previewClassLessonsHandler({ error: LESSONS_ALREADY_GENERATED_ERROR, onCall: onPreview }),
        generateClassLessonsHandler({ error: LESSONS_ALREADY_GENERATED_ERROR }),
      );
      await user.click(generateButton());

      expect(await findAlertTitle("As aulas desta turma já foram geradas")).toBeVisible();
      expect(queryClient.getQueryState(classKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
      expect(onClose).not.toHaveBeenCalled();
      // A rule is a warning, and Gerar has nothing left to do.
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      await waitFor(() => expect(onPreview).toHaveBeenCalled());
      expect(generateButton()).toBeDisabled();
      // The preview that comes back with the same rule does not repeat the warning.
      await advance(200);
      expect(screen.getAllByText("As aulas desta turma já foram geradas")).toHaveLength(1);
    });

    it("warns when the course has no active plan", async () => {
      server.use(previewClassLessonsHandler({ error: COURSE_WITHOUT_SEQUENCE_ERROR }));
      const user = setupUser();
      await renderDialog();

      await fillValidForm(user);

      expect(await findAlertTitle("O curso desta turma não tem plano de aula ativo")).toBeVisible();
      expect(
        screen.getByText(
          "Monte a sequência de planos de aula do curso antes de gerar as aulas da turma.",
        ),
      ).toBeVisible();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(generateButton()).toBeDisabled();
    });

    it("warns when the class is archived", async () => {
      server.use(previewClassLessonsHandler({ error: CLASS_ARCHIVED_ERROR }));
      const user = setupUser();
      await renderDialog();

      await fillValidForm(user);

      expect(await findAlertTitle("Esta turma está arquivada")).toBeVisible();
      expect(screen.getByText("Turma arquivada não recebe aulas novas.")).toBeVisible();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(generateButton()).toBeDisabled();
    });

    it("warns about a rule that generate refuses, as a warning and not as an alert, and keeps the form", async () => {
      server.use(generateClassLessonsHandler({ error: COURSE_WITHOUT_SEQUENCE_ERROR }));
      const user = setupUser();
      const { onClose } = await renderDialog();
      await fillValidForm(user);
      await screen.findByRole("list", PREVIEW_LIST);

      await user.click(generateButton());

      expect(await findAlertTitle("O curso desta turma não tem plano de aula ativo")).toBeVisible();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      expect(startTimeField()).toHaveValue("09:00");
      expect(endTimeField()).toHaveValue("11:00");
    });
  });

  describe("generating", () => {
    it("Gerar N aulas carries the count of the preview, and stays off until there is one", async () => {
      const user = setupUser();
      await renderDialog();
      expect(generateButton()).toHaveAccessibleName("Gerar aulas");
      expect(generateButton()).toBeDisabled();

      await fillValidForm(user);

      await waitFor(() => expect(generateButton()).toHaveAccessibleName("Gerar 3 aulas"));
      expect(generateButton()).toBeEnabled();
      expect(generateButton()).toHaveAttribute("type", "submit");
    });

    it("generates, shows the toast, closes and refreshes getClass and listLessons", async () => {
      const onCall = vi.fn();
      server.use(generateClassLessonsHandler({ onCall }));
      const user = setupUser();
      const { queryClient, onClose } = await renderDialog();
      const classKey = getGetClassQueryKey(CLASS_ID);
      const listKey = getListLessonsQueryKey({ classId: CLASS_ID, limit: 5 });
      const calendarKey = getListLessonsCalendarQueryKey({ from: "2026-04-01", to: "2026-04-30" });
      queryClient.setQueryData(classKey, { id: CLASS_ID });
      queryClient.setQueryData(listKey, buildLessonsPage());
      queryClient.setQueryData(calendarKey, []);
      await fillValidForm(user);
      await screen.findByRole("list", PREVIEW_LIST);
      expect(
        queryClient.getQueryState([getPreviewClassLessonsUrl(CLASS_ID), FIGMA_BODY]),
      ).toBeUndefined();

      await user.click(generateButton());

      expect(await screen.findByText("3 aulas geradas")).toBeInTheDocument();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledTimes(1);
      expect(queryClient.getQueryState(classKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(calendarKey)?.isInvalidated).toBe(true);
    });

    it("says one lesson in the singular in the toast", async () => {
      server.use(
        previewClassLessonsHandler({
          response: (call) => buildPreviewFor(call.body, { plans: PLAN_FIXTURES.slice(0, 1) }),
        }),
        generateClassLessonsHandler({ response: buildGeneratedLessons(1) }),
      );
      const user = setupUser();
      await renderDialog();
      await fillValidForm(user);
      await waitFor(() => expect(generateButton()).toHaveAccessibleName("Gerar 1 aula"));

      await user.click(generateButton());

      expect(await screen.findByText("1 aula gerada")).toBeInTheDocument();
    });

    it("counts the lessons the API created, not the ones the preview promised", async () => {
      server.use(generateClassLessonsHandler({ response: buildGeneratedLessons(2) }));
      const user = setupUser();
      await renderDialog();
      await fillValidForm(user);
      await screen.findByRole("list", PREVIEW_LIST);

      await user.click(generateButton());

      expect(await screen.findByText("2 aulas geradas")).toBeInTheDocument();
    });

    it("sends exactly the previewed body, with location null when blank", async () => {
      const onPreview = vi.fn<(call: ClassBodyCall) => void>();
      const onGenerate = vi.fn<(call: ClassBodyCall) => void>();
      server.use(
        previewClassLessonsHandler({ onCall: onPreview }),
        generateClassLessonsHandler({ onCall: onGenerate }),
      );
      const user = setupUser();
      await renderDialog();
      await fillValidForm(user, { weekday: "Quarta-feira", start: "14:30", end: "16:00" });
      await screen.findByRole("list", PREVIEW_LIST);

      await user.click(generateButton());

      await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(1));
      expect(onGenerate).toHaveBeenCalledWith({
        id: CLASS_ID,
        body: {
          weekday: "wednesday",
          startTime: "14:30",
          endTime: "16:00",
          firstDate: "2026-04-07",
          location: null,
        },
      });
      expect(onGenerate.mock.calls[0][0].body).toEqual(onPreview.mock.calls.at(-1)?.[0].body);
    });

    it("sends the location without the spaces around it, the same in the preview and in generate", async () => {
      const onPreview = vi.fn<(call: ClassBodyCall) => void>();
      const onGenerate = vi.fn<(call: ClassBodyCall) => void>();
      server.use(
        previewClassLessonsHandler({ onCall: onPreview }),
        generateClassLessonsHandler({ onCall: onGenerate }),
      );
      const user = setupUser();
      await renderDialog();
      await fillValidForm(user);
      await user.type(locationField(), "  Sala 3  ");
      await advance(PREVIEW_DEBOUNCE_MS);
      await waitFor(() => expect(onPreview.mock.calls.at(-1)?.[0].body.location).toBe("Sala 3"));
      await waitFor(() => expect(generateButton()).toBeEnabled());

      await user.click(generateButton());

      await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(1));
      expect(onGenerate.mock.calls[0][0].body.location).toBe("Sala 3");
      expect(onGenerate.mock.calls[0][0].body).toEqual(onPreview.mock.calls.at(-1)?.[0].body);
    });

    describe("while it is generating", () => {
      async function startGenerating() {
        const deferred = createDeferred();
        const onCall = vi.fn();
        server.use(generateClassLessonsHandler({ delay: deferred.promise, onCall }));
        const user = setupUser();
        const view = await renderDialog();
        await fillValidForm(user);
        await screen.findByRole("list", PREVIEW_LIST);
        await user.click(generateButton());
        await screen.findByRole("button", { name: "Gerando…" });
        return { ...view, user, deferred, onCall };
      }

      it("shows Gerando…, disables Voltar and marks the form as busy", async () => {
        const { deferred } = await startGenerating();

        expect(screen.getByRole("button", { name: "Gerando…" })).toBeInTheDocument();
        expect(backButton()).toBeDisabled();
        expect(dialog().querySelector("form")).toHaveAttribute("aria-busy", "true");

        deferred.resolve();
      });

      it("ignores a second press, and a second send is never made", async () => {
        const { user, deferred, onCall } = await startGenerating();

        await user.click(screen.getByRole("button", { name: "Gerando…" }));
        await user.keyboard("{Enter}");

        deferred.resolve();
        await screen.findByText("3 aulas geradas");
        expect(onCall).toHaveBeenCalledTimes(1);
      });

      it("cannot be closed: Escape, the close button and Voltar do nothing until the answer arrives", async () => {
        const { user, onClose, deferred } = await startGenerating();

        await user.keyboard("{Escape}");
        await user.click(screen.getByRole("button", { name: "Fechar" }));
        await user.click(backButton());

        expect(onClose).not.toHaveBeenCalled();
        expect(dialog()).toBeInTheDocument();

        deferred.resolve();
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      });
    });
  });

  describe("when generating fails", () => {
    async function generateFailing(failure: Parameters<typeof generateClassLessonsHandler>[0]) {
      server.use(generateClassLessonsHandler(failure));
      const user = setupUser();
      const view = await renderDialog();
      await fillValidForm(user);
      await screen.findByRole("list", PREVIEW_LIST);
      await user.click(generateButton());
      return { ...view, user };
    }

    it("moves the focus to the generate error, which is an alert in the dialog", async () => {
      const { onClose } = await generateFailing({
        error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" },
      });

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Não foi possível gerar as aulas");
      expect(alert).toHaveTextContent("Tente novamente em instantes.");
      expect(dialog()).toContainElement(alert);
      await waitFor(() => expect(alert.parentElement).toHaveFocus());
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.queryByText(/aulas geradas$/)).not.toBeInTheDocument();
      expect(generateButton()).toBeEnabled();
      expect(backButton()).toBeEnabled();
    });

    it("says it is the connection when the request never gets an answer", async () => {
      await generateFailing({ networkError: true });

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Não foi possível gerar as aulas");
      expect(alert).toHaveTextContent("Verifique sua conexão e tente novamente.");
    });

    it("treats a 403, the permission revoked while the dialog was open, as the generic error", async () => {
      await generateFailing({ error: { statusCode: 403, error: "FORBIDDEN" } });

      expect(await screen.findByRole("alert")).toHaveTextContent("Tente novamente em instantes.");
    });

    it("says the class no longer exists on a 404 CLASS_NOT_FOUND", async () => {
      await generateFailing({ error: CLASS_NOT_FOUND_ERROR });

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Esta turma não existe mais");
    });

    it("puts a 400 INVALID_TIME_RANGE on the end time, with the focus, and no alert", async () => {
      const { onClose } = await generateFailing({ error: INVALID_TIME_RANGE_ERROR });

      expect(
        await screen.findByText("A hora de término deve ser depois da hora de início."),
      ).toBeVisible();
      expect(endTimeField()).toHaveAttribute("aria-invalid", "true");
      await waitFor(() => expect(endTimeField()).toHaveFocus());
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("clears the error as soon as the next try starts, and the next try goes through", async () => {
      const { user, onClose } = await generateFailing({ networkError: true });
      await screen.findByRole("alert");

      const deferred = createDeferred();
      server.use(generateClassLessonsHandler({ delay: deferred.promise }));
      await user.click(generateButton());

      await screen.findByRole("button", { name: "Gerando…" });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      deferred.resolve();
      expect(await screen.findByText("3 aulas geradas")).toBeInTheDocument();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });
  });

  describe("what a failure is about", () => {
    it("goes away when a field changes: it was about the fields of the last try", async () => {
      server.use(generateClassLessonsHandler({ networkError: true }));
      const user = setupUser();
      await renderDialog();
      await fillValidForm(user);
      await screen.findByRole("list", PREVIEW_LIST);
      await user.click(generateButton());
      await screen.findByRole("alert");

      await chooseWeekday(user, "Quinta-feira");
      await advance(PREVIEW_DEBOUNCE_MS);

      await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
      await waitFor(() => expect(generateButton()).toBeEnabled());
    });

    it("lets go of the failure about the period once the fields give a preview that fits it", async () => {
      // The class is shortened after the preview: generate says so, and the list marks the lesson.
      let classEndDate = "2026-04-30";
      server.use(
        previewClassLessonsHandler({
          response: (call) => buildPreviewFor(call.body, { plans: PLAN_FIXTURES, classEndDate }),
        }),
        generateClassLessonsHandler({
          error: LESSONS_OUTSIDE_CLASS_PERIOD_ERROR,
          onCall: () => {
            classEndDate = "2026-04-24";
          },
        }),
      );
      const user = setupUser();
      await renderDialog();
      await chooseWeekday(user, "Quinta-feira");
      await user.type(startTimeField(), "09:00");
      await user.type(endTimeField(), "11:00");
      await advance(PREVIEW_DEBOUNCE_MS);
      await screen.findByRole("list", PREVIEW_LIST);
      await user.click(generateButton());
      await findAlertTitle("Há aulas fora do período da turma");
      await screen.findByText("A última aula cai depois do fim da turma");

      // The class is extended again and the person picks another day: the new preview fits the
      // period, so the failure of the last try is gone and Gerar is back.
      classEndDate = "2026-04-30";
      await chooseWeekday(user, "Terça-feira");
      await advance(PREVIEW_DEBOUNCE_MS);

      await waitFor(() =>
        expect(screen.queryByText("Há aulas fora do período da turma")).not.toBeInTheDocument(),
      );
      await waitFor(() => expect(generateButton()).toBeEnabled());
    });

    it("hands a rule that generate refused over to the preview of the new fields, so it is said once", async () => {
      const user = setupUser();
      await renderDialog();
      await fillValidForm(user);
      await screen.findByRole("list", PREVIEW_LIST);
      // Somebody else generated them: from now on both routes refuse with the same rule.
      server.use(
        previewClassLessonsHandler({ error: LESSONS_ALREADY_GENERATED_ERROR }),
        generateClassLessonsHandler({ error: LESSONS_ALREADY_GENERATED_ERROR }),
      );
      await user.click(generateButton());
      await findAlertTitle("As aulas desta turma já foram geradas");
      await advance(200);
      expect(screen.getAllByText("As aulas desta turma já foram geradas")).toHaveLength(1);

      await user.type(locationField(), "Sala 3");
      await advance(PREVIEW_DEBOUNCE_MS);

      // Said by the preview now, in the same words, and not twice.
      await findAlertTitle("As aulas desta turma já foram geradas");
      expect(
        screen
          .getAllByText("As aulas desta turma já foram geradas")
          .filter((element) => element.getAttribute("data-slot") === "alert-title"),
      ).toHaveLength(1);
      expect(generateButton()).toBeDisabled();
    });
  });

  describe("Voltar", () => {
    it("closes without asking anything", async () => {
      const onPreview = vi.fn();
      const onGenerate = vi.fn();
      server.use(
        previewClassLessonsHandler({ onCall: onPreview }),
        generateClassLessonsHandler({ onCall: onGenerate }),
      );
      const user = setupUser();
      const { onClose } = await renderDialog();

      await user.click(backButton());

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onPreview).not.toHaveBeenCalled();
      expect(onGenerate).not.toHaveBeenCalled();
    });

    it("closes after a preview too, without generating anything", async () => {
      const onGenerate = vi.fn();
      server.use(generateClassLessonsHandler({ onCall: onGenerate }));
      const user = setupUser();
      const { onClose } = await renderDialog();
      await fillValidForm(user);
      await screen.findByRole("list", PREVIEW_LIST);

      await user.click(backButton());

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onGenerate).not.toHaveBeenCalled();
    });

    it("closes with Escape and with the close button", async () => {
      const user = setupUser();
      const { onClose } = await renderDialog();

      await user.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledTimes(1);

      await user.click(within(dialog()).getByRole("button", { name: "Fechar" }));
      expect(onClose).toHaveBeenCalledTimes(2);
    });
  });
});
