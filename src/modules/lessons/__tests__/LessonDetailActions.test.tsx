import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { useGetLesson } from "@api/generated/lessons/lessons";
import type { LessonResponseDto } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { LessonDetailActions } from "../components/LessonDetailActions";
import {
  buildCancelledLesson,
  buildLesson,
  buildMeUser,
  cancelLessonHandler,
  getLessonHandler,
  LESSON_CANCELLED_ERROR,
  LESSON_ID,
} from "./handlers";
import { renderWithProviders, server, setupLessonsTestServer } from "./test-utils";

setupLessonsTestServer();

const button = (name: string) => screen.getByRole("button", { name });

const ACTIONS = ["Remarcar aula", "Cancelar aula", "Editar aula"] as const;

const CANCELLED_HINT = "Aula cancelada: não pode ser remarcada, cancelada nem editada.";
const ARCHIVED_HINT = "A turma está arquivada: as aulas dela ficam só para leitura.";

/** The class of the lesson, archived: its lessons are read-only (RN-27). */
function inArchivedClass(lesson: LessonResponseDto): LessonResponseDto {
  return { ...lesson, class: { ...lesson.class, archivedAt: "2026-10-10T13:00:00.000Z" } };
}

/** The way the screen of a lesson will use it: the lesson comes from the cache, so it follows a save. */
function DetailHarness() {
  const { data } = useGetLesson(LESSON_ID);
  return data ? <LessonDetailActions lesson={data} /> : null;
}

describe("LessonDetailActions", () => {
  describe("who sees it", () => {
    it("member sees no button", async () => {
      await renderWithProviders(<LessonDetailActions lesson={buildLesson()} />, {
        user: buildMeUser(Role.member),
      });

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it.each([
      ["a cancelled lesson", buildCancelledLesson()],
      ["a lesson of an archived class", inArchivedClass(buildLesson())],
    ])("member sees no button, not even a turned-off one, for %s", async (_label, lesson) => {
      const { container } = await renderWithProviders(<LessonDetailActions lesson={lesson} />, {
        user: buildMeUser(Role.member),
      });

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.queryByText(CANCELLED_HINT)).not.toBeInTheDocument();
      expect(screen.queryByText(ARCHIVED_HINT)).not.toBeInTheDocument();
      expect(container).toBeEmptyDOMElement();
    });

    it.each([
      ["director", Role.director],
      ["coordinator", Role.coordinator],
    ])(
      "the %s sees Remarcar aula, Cancelar aula and Editar aula, in the order of the Figma",
      async (_label, role) => {
        await renderWithProviders(<LessonDetailActions lesson={buildLesson()} />, {
          user: buildMeUser(role),
        });

        expect(screen.getAllByRole("button").map((item) => item.textContent)).toEqual([
          "Remarcar aula",
          "Cancelar aula",
          "Editar aula",
        ]);
        expect(button("Remarcar aula")).toHaveClass("button--tertiary");
        expect(button("Cancelar aula")).toHaveClass("button--danger-soft");
        expect(button("Editar aula")).toHaveClass("button--secondary");
      },
    );

    it("keeps the three actions turned on, with no reason, for a lesson that can be changed", async () => {
      await renderWithProviders(<LessonDetailActions lesson={buildLesson()} />);

      for (const name of ACTIONS) {
        expect(button(name)).toBeEnabled();
        expect(button(name)).not.toHaveAccessibleDescription();
      }
      expect(screen.queryByText(CANCELLED_HINT)).not.toBeInTheDocument();
      expect(screen.queryByText(ARCHIVED_HINT)).not.toBeInTheDocument();
    });

    it("turns the three actions off for a cancelled lesson, with the reason", async () => {
      await renderWithProviders(<LessonDetailActions lesson={buildCancelledLesson()} />);

      expect(screen.getAllByRole("button").map((item) => item.textContent)).toEqual([...ACTIONS]);
      for (const name of ACTIONS) {
        expect(button(name)).toBeDisabled();
        expect(button(name)).toHaveAccessibleDescription(CANCELLED_HINT);
      }
    });

    it("turns the three actions off when the class is archived, with the reason (RN-27)", async () => {
      await renderWithProviders(<LessonDetailActions lesson={inArchivedClass(buildLesson())} />);

      expect(screen.getAllByRole("button").map((item) => item.textContent)).toEqual([...ACTIONS]);
      for (const name of ACTIONS) {
        expect(button(name)).toBeDisabled();
        expect(button(name)).toHaveAccessibleDescription(ARCHIVED_HINT);
      }
    });

    it("gives the reason of the lesson when it is cancelled and its class is archived too", async () => {
      await renderWithProviders(
        <LessonDetailActions lesson={inArchivedClass(buildCancelledLesson())} />,
      );

      for (const name of ACTIONS) {
        expect(button(name)).toBeDisabled();
        expect(button(name)).toHaveAccessibleDescription(CANCELLED_HINT);
      }
    });

    it("keeps the order and the variants of the Figma when the actions are turned off", async () => {
      await renderWithProviders(<LessonDetailActions lesson={buildCancelledLesson()} />);

      expect(button("Remarcar aula")).toHaveClass("button--tertiary");
      expect(button("Cancelar aula")).toHaveClass("button--danger-soft");
      expect(button("Editar aula")).toHaveClass("button--secondary");
    });

    it("opens no dialog when a turned-off action is pressed", async () => {
      const user = userEvent.setup();
      await renderWithProviders(<LessonDetailActions lesson={buildCancelledLesson()} />);

      for (const name of ACTIONS) await user.click(button(name));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("the dialogs", () => {
    it("Remarcar aula opens the reschedule dialog", async () => {
      server.use(getLessonHandler());
      const user = userEvent.setup();
      await renderWithProviders(<LessonDetailActions lesson={buildLesson()} />);

      await user.click(button("Remarcar aula"));

      const dialog = await screen.findByRole("dialog", { name: "Remarcar aula" });
      expect(await within(dialog).findByLabelText(/^Nova data/)).toBeInTheDocument();
    });

    it("Cancelar aula opens the cancel dialog", async () => {
      const user = userEvent.setup();
      await renderWithProviders(<LessonDetailActions lesson={buildLesson()} />);

      await user.click(button("Cancelar aula"));

      const dialog = await screen.findByRole("dialog", { name: "Cancelar aula" });
      expect(
        within(dialog).getByRole("textbox", { name: "Motivo do cancelamento" }),
      ).toBeInTheDocument();
    });

    it("Editar aula opens the edit dialog", async () => {
      server.use(getLessonHandler());
      const user = userEvent.setup();
      await renderWithProviders(<LessonDetailActions lesson={buildLesson()} />);

      await user.click(button("Editar aula"));

      const dialog = await screen.findByRole("dialog", { name: "Editar aula" });
      expect(await within(dialog).findByRole("textbox", { name: "Título da aula" })).toHaveValue(
        "Teclado, mouse e janelas",
      );
    });

    it.each([
      ["Remarcar aula", "Remarcar aula"],
      ["Cancelar aula", "Cancelar aula"],
      ["Editar aula", "Editar aula"],
    ])("gives the focus back to %s when the dialog closes", async (name, title) => {
      server.use(getLessonHandler());
      const user = userEvent.setup();
      await renderWithProviders(<LessonDetailActions lesson={buildLesson()} />);
      await user.click(button(name));
      await screen.findByRole("dialog", { name: title });

      await user.keyboard("{Escape}");

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() => expect(button(name)).toHaveFocus());
    });

    it("only one dialog is open at a time, and each opens a fresh one", async () => {
      server.use(getLessonHandler());
      const user = userEvent.setup();
      await renderWithProviders(<LessonDetailActions lesson={buildLesson()} />);

      await user.click(button("Cancelar aula"));
      await screen.findByRole("dialog", { name: "Cancelar aula" });
      await user.type(screen.getByRole("textbox", { name: "Motivo do cancelamento" }), "Feriado");
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await user.click(button("Cancelar aula"));

      expect(await screen.findAllByRole("dialog")).toHaveLength(1);
      expect(screen.getByRole("textbox", { name: "Motivo do cancelamento" })).toHaveValue("");
    });
  });

  describe("with the lesson read from the cache, as the screen of the lesson does", () => {
    it("cancelling shows the toast and closes the dialog, and then the actions turn off", async () => {
      const cancelled = buildCancelledLesson({ cancelReason: "Feriado municipal." });
      server.use(getLessonHandler(), cancelLessonHandler({ response: cancelled }));
      const user = userEvent.setup();
      const { queryClient } = await renderWithProviders(<DetailHarness />);
      await screen.findByRole("button", { name: "Cancelar aula" });

      await user.click(button("Cancelar aula"));
      await user.type(
        await screen.findByRole("textbox", { name: "Motivo do cancelamento" }),
        "Feriado municipal.",
      );
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar aula" }),
      );

      expect(await screen.findByText("Aula cancelada")).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      // The toast has its own close button, so the three actions are looked for by name.
      await waitFor(() => {
        for (const name of ACTIONS) {
          expect(button(name)).toBeDisabled();
          expect(button(name)).toHaveAccessibleDescription(CANCELLED_HINT);
        }
      });
      expect(queryClient.getQueryData<LessonResponseDto>(["/lessons/" + LESSON_ID])?.status).toBe(
        "cancelled",
      );
    });
  });

  describe("onCancelled", () => {
    async function cancelWithReason(user: ReturnType<typeof userEvent.setup>) {
      await user.click(button("Cancelar aula"));
      await user.type(
        await screen.findByRole("textbox", { name: "Motivo do cancelamento" }),
        "Feriado municipal.",
      );
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar aula" }),
      );
    }

    it("calls onCancelled with the lesson the API answered, once the lesson was cancelled", async () => {
      const cancelled = buildCancelledLesson({ cancelReason: "Feriado municipal." });
      server.use(cancelLessonHandler({ response: cancelled }));
      const onCancelled = vi.fn();
      const user = userEvent.setup();
      await renderWithProviders(
        <LessonDetailActions lesson={buildLesson()} onCancelled={onCancelled} />,
      );

      await cancelWithReason(user);

      await waitFor(() => expect(onCancelled).toHaveBeenCalledExactlyOnceWith(cancelled));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("does not call onCancelled when the API refuses to cancel", async () => {
      server.use(cancelLessonHandler({ error: LESSON_CANCELLED_ERROR }));
      const onCancelled = vi.fn();
      const user = userEvent.setup();
      await renderWithProviders(
        <LessonDetailActions lesson={buildLesson()} onCancelled={onCancelled} />,
      );

      await cancelWithReason(user);

      expect(
        await screen.findByText("Esta aula está cancelada e não pode mais ser alterada."),
      ).toBeInTheDocument();
      expect(onCancelled).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog", { name: "Cancelar aula" })).toBeInTheDocument();
    });

    it("works without onCancelled, as before", async () => {
      server.use(cancelLessonHandler());
      const user = userEvent.setup();
      await renderWithProviders(<LessonDetailActions lesson={buildLesson()} />);

      await cancelWithReason(user);

      expect(await screen.findByText("Aula cancelada")).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });
  });
});
