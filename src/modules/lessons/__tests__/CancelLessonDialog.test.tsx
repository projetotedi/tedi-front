import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getGetLessonQueryKey } from "@api/generated/lessons/lessons";
import { LessonStatus } from "@api/generated/model";

import { CancelLessonDialog } from "../components/CancelLessonDialog";
import {
  buildCancelledLesson,
  buildLesson,
  CLASS_ARCHIVED_ERROR,
  cancelLessonHandler,
  LESSON_CANCELLED_ERROR,
  LESSON_ID,
  LESSON_NOT_FOUND_ERROR,
  VALIDATION_ERROR,
  type CancelLessonCall,
} from "./handlers";
import { createDeferred, renderWithProviders, server, setupLessonsTestServer } from "./test-utils";

setupLessonsTestServer();

const reasonField = () => screen.getByRole("textbox", { name: "Motivo do cancelamento" });
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const submit = (user: ReturnType<typeof userEvent.setup>) => user.click(button("Cancelar aula"));

async function renderCancel() {
  const onClose = vi.fn();
  const onCancelled = vi.fn();
  const view = await renderWithProviders(
    <CancelLessonDialog lessonId={LESSON_ID} onClose={onClose} onCancelled={onCancelled} />,
  );
  await screen.findByRole("dialog", { name: "Cancelar aula" });
  return { ...view, onClose, onCancelled };
}

describe("CancelLessonDialog", () => {
  describe("layout", () => {
    it("shows the warning, the reason and the danger button", async () => {
      await renderCancel();

      const dialog = screen.getByRole("dialog", { name: "Cancelar aula" });
      expect(dialog).toHaveClass("max-w-160");
      expect(within(dialog).getByText("Cancelar a aula estorna as horas")).toBeInTheDocument();
      expect(
        within(dialog).getByText(
          "As horas já lançadas para os membros presentes são estornadas. A aula continua no calendário, marcada como cancelada.",
        ),
      ).toBeInTheDocument();
      expect(reasonField()).toBeRequired();
      expect(reasonField()).toHaveAccessibleDescription(
        "Obrigatório. Aparece na ficha da aula e no calendário da turma.",
      );
      expect(within(dialog).getByRole("button", { name: "Voltar" })).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Cancelar aula" })).toHaveClass(
        "button--danger",
      );
      expect(within(dialog).getByRole("button", { name: "Fechar" })).toBeInTheDocument();
    });

    it("shows the warning as a static alert, not as a live region read with the title", async () => {
      await renderCancel();

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("draws no asterisk of its own: a required field draws its own", async () => {
      await renderCancel();

      expect(screen.getByRole("dialog").textContent).not.toContain("*");
    });

    it("focuses the reason when the dialog opens", async () => {
      await renderCancel();

      expect(reasonField()).toHaveFocus();
    });
  });

  describe("the reason is required", () => {
    it.each([
      ["empty", ""],
      ["only spaces", "   "],
    ])(
      "shows the error on the reason field and sends nothing when the reason is %s",
      async (_label, reason) => {
        const onCall = vi.fn();
        server.use(cancelLessonHandler({ onCall }));
        const user = userEvent.setup();
        const { onClose } = await renderCancel();
        if (reason) await user.type(reasonField(), reason);

        await submit(user);

        expect(await screen.findByText("Informe o motivo do cancelamento.")).toBeInTheDocument();
        expect(reasonField()).toHaveAttribute("aria-invalid", "true");
        expect(reasonField()).toHaveAccessibleDescription("Informe o motivo do cancelamento.");
        expect(reasonField()).toHaveFocus();
        expect(onCall).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
      },
    );

    it("refuses a reason longer than the maximum of the contract", async () => {
      const onCall = vi.fn();
      server.use(cancelLessonHandler({ onCall }));
      const user = userEvent.setup();
      await renderCancel();
      await user.click(reasonField());
      await user.paste("a".repeat(501));

      await submit(user);

      expect(
        await screen.findByText("O motivo pode ter no máximo 500 caracteres."),
      ).toBeInTheDocument();
      expect(onCall).not.toHaveBeenCalled();
    });

    it("clears the error when the person writes the reason", async () => {
      const user = userEvent.setup();
      await renderCancel();
      await submit(user);
      await screen.findByText("Informe o motivo do cancelamento.");

      await user.type(reasonField(), "Feriado");

      await waitFor(() => expect(reasonField()).not.toHaveAttribute("aria-invalid", "true"));
      expect(screen.queryByText("Informe o motivo do cancelamento.")).not.toBeInTheDocument();
    });
  });

  describe("cancelling", () => {
    it("PATCHes /cancel with the trimmed reason, shows the toast and closes", async () => {
      const onCall = vi.fn<(call: CancelLessonCall) => void>();
      const cancelled = buildCancelledLesson({ cancelReason: "Feriado municipal." });
      server.use(cancelLessonHandler({ response: cancelled, onCall }));
      const user = userEvent.setup();
      const { onClose, onCancelled, queryClient } = await renderCancel();
      await user.type(reasonField(), "  Feriado municipal.  ");

      await submit(user);

      expect(await screen.findByText("Aula cancelada")).toBeInTheDocument();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledExactlyOnceWith({
        id: LESSON_ID,
        body: { reason: "Feriado municipal." },
      });
      expect(onCancelled).toHaveBeenCalledWith(cancelled);
      expect(queryClient.getQueryData(getGetLessonQueryKey(LESSON_ID))).toMatchObject({
        status: LessonStatus.cancelled,
        cancelReason: "Feriado municipal.",
      });
    });

    it("refreshes the lists and the class, and leaves the other lessons alone", async () => {
      server.use(cancelLessonHandler());
      const user = userEvent.setup();
      const { queryClient } = await renderCancel();
      const listKey = ["/lessons", { page: 1 }] as const;
      const otherLessonKey = getGetLessonQueryKey("01952ef7-0000-7000-8000-0000000000f2");
      queryClient.setQueryData(listKey, { data: [] });
      queryClient.setQueryData(otherLessonKey, buildLesson());
      await user.type(reasonField(), "Feriado");

      await submit(user);

      await screen.findByText("Aula cancelada");
      expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(otherLessonKey)?.isInvalidated).toBe(false);
    });

    it("Voltar closes without sending anything", async () => {
      const onCall = vi.fn();
      server.use(cancelLessonHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderCancel();
      await user.type(reasonField(), "Feriado");

      await user.click(button("Voltar"));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onCall).not.toHaveBeenCalled();
    });

    it("Esc and the close button close it too", async () => {
      const user = userEvent.setup();
      const { onClose } = await renderCancel();

      await user.keyboard("{Escape}");
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

      await user.click(button("Fechar"));
      expect(onClose).toHaveBeenCalledTimes(2);
    });

    it("keeps the dialog shut and ignores a second press while the request is on its way", async () => {
      const response = createDeferred();
      const onCall = vi.fn<(call: CancelLessonCall) => void>();
      server.use(cancelLessonHandler({ delay: response.promise, onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderCancel();
      await user.type(reasonField(), "Feriado");

      await submit(user);
      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));

      await user.keyboard("{Escape}");
      await user.click(button("Fechar"));
      await user.click(button("Voltar"));
      await user.click(button(/Cancelando/));
      expect(onClose).not.toHaveBeenCalled();
      expect(button("Voltar")).toBeDisabled();
      expect(button(/Cancelando/)).toHaveTextContent("Cancelando…");
      expect(document.querySelector("form")).toHaveAttribute("aria-busy", "true");
      expect(onCall).toHaveBeenCalledTimes(1);

      response.resolve();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledTimes(1);
    });
  });

  describe("errors of the API", () => {
    it("maps a 400 VALIDATION_FAILED on reason to the field, with the focus on it", async () => {
      server.use(
        cancelLessonHandler({
          error: VALIDATION_ERROR([{ field: "reason", message: "must not be blank" }]),
        }),
      );
      const user = userEvent.setup();
      const { onClose } = await renderCancel();
      await user.type(reasonField(), "Feriado");

      await submit(user);

      expect(await screen.findByText("Revise este campo e tente de novo.")).toBeInTheDocument();
      expect(reasonField()).toHaveAttribute("aria-invalid", "true");
      expect(reasonField()).toHaveFocus();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("shows 409 CLASS_ARCHIVED as an alert, with the focus on it", async () => {
      server.use(cancelLessonHandler({ error: CLASS_ARCHIVED_ERROR }));
      const user = userEvent.setup();
      const { onClose } = await renderCancel();
      await user.type(reasonField(), "Feriado");

      await submit(user);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(
        "A turma está arquivada. As aulas de uma turma arquivada ficam só para leitura.",
      );
      await waitFor(() => expect(alert.parentElement).toHaveFocus());
      expect(onClose).not.toHaveBeenCalled();
    });

    it("shows a network failure as an alert, and the next attempt clears it and cancels", async () => {
      server.use(cancelLessonHandler({ networkError: true }));
      const user = userEvent.setup();
      const { onClose } = await renderCancel();
      await user.type(reasonField(), "Feriado");

      await submit(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível conectar. Verifique sua conexão e tente novamente.",
      );

      server.use(cancelLessonHandler());
      await submit(user);

      expect(await screen.findByText("Aula cancelada")).toBeInTheDocument();
      expect(within(screen.getByRole("dialog")).queryByRole("alert")).not.toBeInTheDocument();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("shows a 404 LESSON_NOT_FOUND as an alert and marks the lesson as out of date", async () => {
      server.use(cancelLessonHandler({ error: LESSON_NOT_FOUND_ERROR }));
      const user = userEvent.setup();
      const { queryClient } = await renderCancel();
      queryClient.setQueryData(getGetLessonQueryKey(LESSON_ID), buildLesson());
      await user.type(reasonField(), "Feriado");

      await submit(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Aula não encontrada. Ela pode ter sido removida.",
      );
      expect(queryClient.getQueryState(getGetLessonQueryKey(LESSON_ID))?.isInvalidated).toBe(true);
    });

    it("shows a lesson that is already cancelled as a warning with the focus, turns Cancelar aula off and marks the lesson as out of date", async () => {
      server.use(cancelLessonHandler({ error: LESSON_CANCELLED_ERROR }));
      const user = userEvent.setup();
      const { onClose, queryClient } = await renderCancel();
      queryClient.setQueryData(getGetLessonQueryKey(LESSON_ID), buildLesson());
      await user.type(reasonField(), "Feriado");

      await submit(user);

      const warning = await screen.findByText(
        "Esta aula está cancelada e não pode mais ser alterada.",
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      await waitFor(() => expect(warning.closest("[tabindex='-1']")).toHaveFocus());
      expect(button("Cancelar aula")).toBeDisabled();
      expect(onClose).not.toHaveBeenCalled();
      expect(queryClient.getQueryState(getGetLessonQueryKey(LESSON_ID))?.isInvalidated).toBe(true);
    });
  });
});
