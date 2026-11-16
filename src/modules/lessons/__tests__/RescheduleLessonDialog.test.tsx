import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getGetLessonQueryKey } from "@api/generated/lessons/lessons";
import type { LessonResponseDto } from "@api/generated/model";

import { RescheduleLessonDialog } from "../components/RescheduleLessonDialog";
import {
  buildCancelledLesson,
  buildLesson,
  buildRescheduledLesson,
  CLASS_ARCHIVED_ERROR,
  getLessonHandler,
  INVALID_TIME_RANGE_ERROR,
  LESSON_CANCELLED_ERROR,
  LESSON_ID,
  LESSON_NOT_FOUND_ERROR,
  OUTSIDE_PERIOD_ERROR,
  rescheduleLessonHandler,
  VALIDATION_ERROR,
  type RescheduleLessonCall,
} from "./handlers";
import { createDeferred, renderWithProviders, server, setupLessonsTestServer } from "./test-utils";

setupLessonsTestServer();

const PERIOD_TEXT = "02/03/2026 a 30/06/2026";

const textbox = (name: string | RegExp) => screen.getByRole("textbox", { name });
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const field = (label: RegExp) => screen.getByLabelText(label);
const submit = (user: ReturnType<typeof userEvent.setup>) => user.click(button("Remarcar aula"));

/** Date and time inputs are filled with `change`, as in the tests of the classes (jsdom has no picker). */
function setField(label: RegExp, value: string) {
  fireEvent.change(field(label), { target: { value } });
}

async function renderReschedule(
  lesson: LessonResponseDto = buildLesson(),
  onGet?: (call: { id: string }) => void,
) {
  server.use(getLessonHandler({ response: lesson, onCall: onGet }));
  const onClose = vi.fn();
  const onRescheduled = vi.fn();
  const view = await renderWithProviders(
    <RescheduleLessonDialog lessonId={LESSON_ID} onClose={onClose} onRescheduled={onRescheduled} />,
  );
  await screen.findByRole("dialog", { name: "Remarcar aula" });
  await screen.findByLabelText(/^Nova data/);
  return { ...view, onClose, onRescheduled };
}

describe("RescheduleLessonDialog", () => {
  describe("layout", () => {
    it("prefills times and location, date empty, shows the info", async () => {
      await renderReschedule();

      const dialog = screen.getByRole("dialog", { name: "Remarcar aula" });
      expect(dialog).toHaveClass("max-w-200");
      expect(field(/^Nova data/)).toHaveValue("");
      expect(field(/^Nova data/)).toHaveAttribute("type", "date");
      expect(field(/^Nova data/)).toBeRequired();
      expect(field(/^Hora de início/)).toHaveValue("09:00");
      expect(field(/^Hora de início/)).toHaveAttribute("type", "time");
      expect(field(/^Hora de início/)).toBeRequired();
      expect(field(/^Hora de término/)).toHaveValue("11:00");
      expect(field(/^Hora de término/)).toBeRequired();
      expect(textbox("Local")).toHaveValue("Laboratório 2 — Bloco B");
      expect(textbox("Motivo da remarcação")).toHaveValue("");
      expect(textbox("Motivo da remarcação")).not.toBeRequired();
      expect(textbox("Observação")).toHaveValue("");
      expect(within(dialog).getByText("A data original fica registrada")).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Voltar" })).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Remarcar aula" })).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Fechar" })).toBeInTheDocument();
    });

    it("draws no asterisk of its own: a required field draws its own", async () => {
      await renderReschedule();

      expect(screen.getByRole("dialog").textContent).not.toContain("*");
    });

    it("says the period of the class under the new date", async () => {
      await renderReschedule();

      expect(field(/^Nova data/)).toHaveAccessibleDescription(`Período da turma: ${PERIOD_TEXT}`);
    });

    it("tells the current date as the one that becomes the original, for a lesson never rescheduled", async () => {
      await renderReschedule();

      const dialog = screen.getByRole("dialog");
      expect(
        within(dialog).getByText(
          "Data atual da aula: 10/03/2026. Ela passa a ser a data original.",
        ),
      ).toBeInTheDocument();
      expect(within(dialog).queryByText(/Data original:/)).not.toBeInTheDocument();
    });

    it("shows 'Data original' in the info when the lesson was already rescheduled", async () => {
      await renderReschedule(buildRescheduledLesson({ date: "2026-03-17" }));

      const dialog = screen.getByRole("dialog");
      expect(
        within(dialog).getByText(
          "Data original: 03/03/2026. Ela continua registrada, mesmo remarcando de novo.",
        ),
      ).toBeInTheDocument();
      expect(within(dialog).queryByText(/Data atual da aula/)).not.toBeInTheDocument();
    });

    it("leaves the location empty for a lesson that has none", async () => {
      await renderReschedule(buildLesson({ location: null }));

      expect(textbox("Local")).toHaveValue("");
    });

    it("focuses the new date when the dialog opens", async () => {
      await renderReschedule();

      await waitFor(() => expect(field(/^Nova data/)).toHaveFocus());
    });
  });

  describe("loading", () => {
    it("shows a status while the lesson loads, with Remarcar aula off", async () => {
      const lesson = createDeferred();
      server.use(getLessonHandler({ delay: lesson.promise }));
      await renderWithProviders(<RescheduleLessonDialog lessonId={LESSON_ID} onClose={vi.fn()} />);

      expect(await screen.findByRole("status")).toHaveTextContent("Carregando a aula…");
      expect(button("Remarcar aula")).toBeDisabled();

      lesson.resolve();
      expect(await screen.findByLabelText(/^Nova data/)).toBeInTheDocument();
      expect(button("Remarcar aula")).toBeEnabled();
    });

    it("shows the error with 'Tentar de novo' when the lesson cannot be loaded, and loads it again", async () => {
      server.use(getLessonHandler({ networkError: true }));
      const user = userEvent.setup();
      await renderWithProviders(<RescheduleLessonDialog lessonId={LESSON_ID} onClose={vi.fn()} />);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar a aula.",
      );
      expect(button("Remarcar aula")).toBeDisabled();

      server.use(getLessonHandler());
      await user.click(button("Tentar de novo"));

      expect(await screen.findByLabelText(/^Nova data/)).toBeInTheDocument();
    });

    it("says the lesson is gone, without a retry, when it does not exist", async () => {
      server.use(getLessonHandler({ error: LESSON_NOT_FOUND_ERROR }));
      await renderWithProviders(<RescheduleLessonDialog lessonId={LESSON_ID} onClose={vi.fn()} />);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Aula não encontrada. Ela pode ter sido removida.",
      );
      expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
    });

    it("shows the warning only, with Remarcar aula off, for a lesson that is already cancelled", async () => {
      server.use(getLessonHandler({ response: buildCancelledLesson() }));
      await renderWithProviders(<RescheduleLessonDialog lessonId={LESSON_ID} onClose={vi.fn()} />);

      expect(
        await screen.findByText("Esta aula está cancelada e não pode mais ser alterada."),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText(/^Nova data/)).not.toBeInTheDocument();
      expect(button("Remarcar aula")).toBeDisabled();
    });
  });

  describe("validation in the form", () => {
    it("asks for the new date and sends nothing", async () => {
      const onCall = vi.fn();
      server.use(rescheduleLessonHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderReschedule();

      await submit(user);

      expect(await screen.findByText("Informe a data.")).toBeInTheDocument();
      expect(field(/^Nova data/)).toHaveAttribute("aria-invalid", "true");
      expect(field(/^Nova data/)).toHaveFocus();
      expect(onCall).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("refuses an end before the start, on the end field, and sends nothing", async () => {
      const onCall = vi.fn();
      server.use(rescheduleLessonHandler({ onCall }));
      const user = userEvent.setup();
      await renderReschedule();
      setField(/^Nova data/, "2026-03-17");
      setField(/^Hora de término/, "08:00");

      await submit(user);

      expect(
        await screen.findByText("A hora de término precisa ser depois da hora de início."),
      ).toBeInTheDocument();
      expect(field(/^Hora de término/)).toHaveAttribute("aria-invalid", "true");
      expect(field(/^Hora de término/)).toHaveFocus();
      expect(onCall).not.toHaveBeenCalled();
    });

    it("asks for the times when they are emptied", async () => {
      const onCall = vi.fn();
      server.use(rescheduleLessonHandler({ onCall }));
      const user = userEvent.setup();
      await renderReschedule();
      setField(/^Nova data/, "2026-03-17");
      setField(/^Hora de início/, "");
      setField(/^Hora de término/, "");

      await submit(user);

      expect(await screen.findByText("Informe a hora de início.")).toBeInTheDocument();
      expect(screen.getByText("Informe a hora de término.")).toBeInTheDocument();
      expect(onCall).not.toHaveBeenCalled();
    });

    it("Voltar closes without sending anything", async () => {
      const onCall = vi.fn();
      server.use(rescheduleLessonHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderReschedule();
      setField(/^Nova data/, "2026-03-17");

      await user.click(button("Voltar"));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onCall).not.toHaveBeenCalled();
    });
  });

  describe("rescheduling", () => {
    it("PATCHes /reschedule with the body: the cleared location goes as null, the reason and the note trimmed", async () => {
      const onCall = vi.fn<(call: RescheduleLessonCall) => void>();
      server.use(rescheduleLessonHandler({ onCall }));
      const user = userEvent.setup();
      await renderReschedule();
      setField(/^Nova data/, "2026-03-17");
      setField(/^Hora de início/, "14:00");
      setField(/^Hora de término/, "16:30");
      await user.clear(textbox("Local"));
      await user.type(textbox("Motivo da remarcação"), "  Sala indisponível ");
      await user.type(textbox("Observação"), " A sala foi usada para a prova. ");

      await submit(user);

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall.mock.calls[0][0]).toEqual({
        id: LESSON_ID,
        body: {
          date: "2026-03-17",
          startTime: "14:00",
          endTime: "16:30",
          location: null,
          reason: "Sala indisponível",
          note: "A sala foi usada para a prova.",
        },
      });
    });

    it("sends the location of the lesson, and null for the blank reason and note, when they are left as they are", async () => {
      const onCall = vi.fn<(call: RescheduleLessonCall) => void>();
      server.use(rescheduleLessonHandler({ onCall }));
      const user = userEvent.setup();
      await renderReschedule();
      setField(/^Nova data/, "2026-03-17");

      await submit(user);

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall.mock.calls[0][0].body).toEqual({
        date: "2026-03-17",
        startTime: "09:00",
        endTime: "11:00",
        location: "Laboratório 2 — Bloco B",
        reason: null,
        note: null,
      });
    });

    it("after saving, the getLesson cache holds originalDate and the toast tells the original date", async () => {
      const rescheduled = buildRescheduledLesson({
        date: "2026-03-17",
        originalDate: "2026-03-10",
      });
      server.use(rescheduleLessonHandler({ response: rescheduled }));
      const user = userEvent.setup();
      const { onClose, onRescheduled, queryClient } = await renderReschedule();
      setField(/^Nova data/, "2026-03-17");

      await submit(user);

      expect(
        await screen.findByText("Aula remarcada. A data original, 10/03/2026, fica registrada."),
      ).toBeInTheDocument();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onRescheduled).toHaveBeenCalledWith(rescheduled);
      const cached = queryClient.getQueryData<LessonResponseDto>(getGetLessonQueryKey(LESSON_ID));
      expect(cached?.originalDate).toBe("2026-03-10");
      expect(cached?.date).toBe("2026-03-17");
    });

    it("keeps the first original date when a rescheduled lesson is rescheduled again", async () => {
      server.use(
        rescheduleLessonHandler({
          response: buildRescheduledLesson({ date: "2026-03-24", originalDate: "2026-03-03" }),
        }),
      );
      const user = userEvent.setup();
      const { queryClient } = await renderReschedule(
        buildRescheduledLesson({ date: "2026-03-17" }),
      );
      setField(/^Nova data/, "2026-03-24");

      await submit(user);

      expect(
        await screen.findByText("Aula remarcada. A data original, 03/03/2026, fica registrada."),
      ).toBeInTheDocument();
      expect(
        queryClient.getQueryData<LessonResponseDto>(getGetLessonQueryKey(LESSON_ID))?.originalDate,
      ).toBe("2026-03-03");
    });

    it("takes the day the lesson had on the screen as the original one if the answer comes without it", async () => {
      server.use(
        rescheduleLessonHandler({
          response: buildLesson({ date: "2026-03-17", originalDate: null }),
        }),
      );
      const user = userEvent.setup();
      await renderReschedule();
      setField(/^Nova data/, "2026-03-17");

      await submit(user);

      expect(
        await screen.findByText("Aula remarcada. A data original, 10/03/2026, fica registrada."),
      ).toBeInTheDocument();
    });

    it("refreshes the lists and the class, and leaves the other lessons alone", async () => {
      server.use(rescheduleLessonHandler());
      const user = userEvent.setup();
      const { queryClient } = await renderReschedule();
      const listKey = ["/lessons", { page: 1 }] as const;
      const calendarKey = ["/lessons/calendar", { from: "2026-03-01", to: "2026-03-31" }] as const;
      const otherLessonKey = getGetLessonQueryKey("01952ef7-0000-7000-8000-0000000000f2");
      queryClient.setQueryData(listKey, { data: [] });
      queryClient.setQueryData(calendarKey, []);
      queryClient.setQueryData(otherLessonKey, buildLesson());
      setField(/^Nova data/, "2026-03-17");

      await submit(user);

      await screen.findByText(/Aula remarcada/);
      expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(calendarKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(otherLessonKey)?.isInvalidated).toBe(false);
    });

    it("keeps the dialog shut and ignores a second press while the request is on its way", async () => {
      const response = createDeferred();
      const onCall = vi.fn<(call: RescheduleLessonCall) => void>();
      server.use(rescheduleLessonHandler({ delay: response.promise, onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderReschedule();
      setField(/^Nova data/, "2026-03-17");

      await submit(user);
      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));

      await user.keyboard("{Escape}");
      await user.click(button("Fechar"));
      await user.click(button("Voltar"));
      await user.click(button(/Remarcando/));
      expect(onClose).not.toHaveBeenCalled();
      expect(button("Voltar")).toBeDisabled();
      expect(document.querySelector("form")).toHaveAttribute("aria-busy", "true");
      expect(onCall).toHaveBeenCalledTimes(1);

      response.resolve();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledTimes(1);
    });
  });

  describe("errors of the API", () => {
    it("maps 400 LESSON_OUTSIDE_CLASS_PERIOD to the new date, with the class period and the focus on it", async () => {
      server.use(rescheduleLessonHandler({ error: OUTSIDE_PERIOD_ERROR }));
      const user = userEvent.setup();
      const { onClose } = await renderReschedule();
      setField(/^Nova data/, "2026-07-15");

      await submit(user);

      const message = `A data precisa estar dentro do período da turma (${PERIOD_TEXT}).`;
      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(field(/^Nova data/)).toHaveAttribute("aria-invalid", "true");
      expect(field(/^Nova data/)).toHaveAccessibleDescription(message);
      expect(field(/^Nova data/)).toHaveFocus();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.queryByText(/Aula remarcada/)).not.toBeInTheDocument();
    });

    it("maps 400 INVALID_TIME_RANGE to the end time", async () => {
      server.use(rescheduleLessonHandler({ error: INVALID_TIME_RANGE_ERROR }));
      const user = userEvent.setup();
      await renderReschedule();
      setField(/^Nova data/, "2026-03-17");

      await submit(user);

      expect(
        await screen.findByText("A hora de término precisa ser depois da hora de início."),
      ).toBeInTheDocument();
      expect(field(/^Hora de término/)).toHaveAttribute("aria-invalid", "true");
      expect(field(/^Hora de término/)).toHaveFocus();
    });

    it("maps a 400 VALIDATION_FAILED to the fields it points at, with the focus on the first one on the screen", async () => {
      server.use(
        rescheduleLessonHandler({
          error: VALIDATION_ERROR([
            { field: "note", message: "too long" },
            { field: "startTime", message: "invalid" },
          ]),
        }),
      );
      const user = userEvent.setup();
      await renderReschedule();
      setField(/^Nova data/, "2026-03-17");

      await submit(user);

      await waitFor(() =>
        expect(screen.getAllByText("Revise este campo e tente de novo.")).toHaveLength(2),
      );
      expect(field(/^Hora de início/)).toHaveFocus();
    });

    it("409 LESSON_CANCELLED shows the warning, takes the focus, turns save off and refetches getLesson", async () => {
      const onGet = vi.fn();
      server.use(rescheduleLessonHandler({ error: LESSON_CANCELLED_ERROR }));
      const user = userEvent.setup();
      const { onClose } = await renderReschedule(buildLesson(), onGet);
      setField(/^Nova data/, "2026-03-17");
      await user.type(textbox("Observação"), "Prova");

      await submit(user);

      const warning = await screen.findByText(
        "Esta aula está cancelada e não pode mais ser alterada.",
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      await waitFor(() => expect(warning.closest("[tabindex='-1']")).toHaveFocus());
      expect(button("Remarcar aula")).toBeDisabled();
      expect(onClose).not.toHaveBeenCalled();
      await waitFor(() => expect(onGet).toHaveBeenCalledTimes(2));
      // What was typed is still there: the form was not swapped for another screen.
      expect(textbox("Observação")).toHaveValue("Prova");
    });

    it("shows 409 CLASS_ARCHIVED as an alert with the focus, and keeps save on", async () => {
      server.use(rescheduleLessonHandler({ error: CLASS_ARCHIVED_ERROR }));
      const user = userEvent.setup();
      await renderReschedule();
      setField(/^Nova data/, "2026-03-17");

      await submit(user);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("A turma está arquivada");
      await waitFor(() => expect(alert.parentElement).toHaveFocus());
      expect(button("Remarcar aula")).toBeEnabled();
    });

    it("shows a network failure as an alert, and the next attempt clears it and reschedules", async () => {
      server.use(rescheduleLessonHandler({ networkError: true }));
      const user = userEvent.setup();
      const { onClose } = await renderReschedule();
      setField(/^Nova data/, "2026-03-17");

      await submit(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível conectar. Verifique sua conexão e tente novamente.",
      );

      server.use(rescheduleLessonHandler());
      await submit(user);

      expect(await screen.findByText(/Aula remarcada/)).toBeInTheDocument();
      expect(within(screen.getByRole("dialog")).queryByRole("alert")).not.toBeInTheDocument();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("shows a 404 LESSON_NOT_FOUND as an alert", async () => {
      server.use(rescheduleLessonHandler({ error: LESSON_NOT_FOUND_ERROR }));
      const user = userEvent.setup();
      await renderReschedule();
      setField(/^Nova data/, "2026-03-17");

      await submit(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Aula não encontrada. Ela pode ter sido removida.",
      );
    });
  });
});
