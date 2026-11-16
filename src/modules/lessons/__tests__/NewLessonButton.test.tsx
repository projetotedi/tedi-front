import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Role } from "@shared/lib/role";

import { NewLessonButton } from "../components/NewLessonButton";
import type { LessonClassContext } from "../components/LessonFormDialog";
import {
  buildLesson,
  buildMeUser,
  CLASS_ID,
  CLASS_NAME,
  CLASS_PERIOD,
  COURSE_ID,
  createLessonHandler,
  listCourseLessonPlansHandler,
} from "./handlers";
import { renderWithProviders, server, setupLessonsTestServer } from "./test-utils";

setupLessonsTestServer();

const LESSON_CLASS: LessonClassContext = {
  id: CLASS_ID,
  label: CLASS_NAME,
  courseId: COURSE_ID,
  ...CLASS_PERIOD,
};

const newLessonButton = () => screen.getByRole("button", { name: "Nova aula" });

describe("NewLessonButton", () => {
  it("member does not see the button", async () => {
    await renderWithProviders(<NewLessonButton lessonClass={LESSON_CLASS} />, {
      user: buildMeUser(Role.member),
    });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/Nova aula/)).not.toBeInTheDocument();
  });

  it("does not see it without a session either", async () => {
    await renderWithProviders(<NewLessonButton lessonClass={LESSON_CLASS} />, { user: null });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each([
    ["director", Role.director],
    ["coordinator", Role.coordinator],
  ])(
    "the %s sees the button, named Nova aula, with the plus sign as decoration",
    async (_label, role) => {
      await renderWithProviders(<NewLessonButton lessonClass={LESSON_CLASS} />, {
        user: buildMeUser(role),
      });

      const button = newLessonButton();
      expect(button).toHaveClass("button--primary");
      expect(button).toHaveTextContent("+ Nova aula");
      expect(button.querySelector("[aria-hidden='true']")).toHaveTextContent("+");
    },
  );

  it("opens the Nova aula dialog with the class fixed", async () => {
    server.use(listCourseLessonPlansHandler());
    const user = userEvent.setup();
    await renderWithProviders(<NewLessonButton lessonClass={LESSON_CLASS} />);

    await user.click(newLessonButton());

    expect(await screen.findByRole("dialog", { name: "Nova aula" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Turma/)).toHaveValue(CLASS_NAME);
    expect(screen.getByLabelText(/^Turma/)).toHaveAttribute("readonly");
  });

  it("asks the plans of the course of the class", async () => {
    const onCall = vi.fn();
    server.use(listCourseLessonPlansHandler({ onCall }));
    const user = userEvent.setup();
    await renderWithProviders(<NewLessonButton lessonClass={LESSON_CLASS} />);

    await user.click(newLessonButton());

    await waitFor(() => expect(onCall).toHaveBeenCalledExactlyOnceWith({ id: COURSE_ID }));
  });

  it("gives the focus back to the button when Esc closes the dialog", async () => {
    server.use(listCourseLessonPlansHandler());
    const user = userEvent.setup();
    await renderWithProviders(<NewLessonButton lessonClass={LESSON_CLASS} />);
    await user.click(newLessonButton());
    await screen.findByRole("dialog", { name: "Nova aula" });

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(newLessonButton()).toHaveFocus());
  });

  it("gives the focus back to the button when Cancelar closes the dialog", async () => {
    server.use(listCourseLessonPlansHandler());
    const user = userEvent.setup();
    await renderWithProviders(<NewLessonButton lessonClass={LESSON_CLASS} />);
    await user.click(newLessonButton());
    await screen.findByRole("dialog", { name: "Nova aula" });

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(newLessonButton()).toHaveFocus());
  });

  it("opens a fresh dialog each time: what was typed before Cancelar is not kept", async () => {
    server.use(listCourseLessonPlansHandler());
    const user = userEvent.setup();
    await renderWithProviders(<NewLessonButton lessonClass={LESSON_CLASS} />);
    await user.click(newLessonButton());
    await user.type(await screen.findByRole("textbox", { name: "Título da aula" }), "Aula");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(newLessonButton());

    expect(await screen.findByRole("textbox", { name: "Título da aula" })).toHaveValue("");
  });

  it("creates the lesson, gives it to onSaved and closes the dialog", async () => {
    const created = buildLesson({ title: "Aula de teclado" });
    const onSaved = vi.fn();
    server.use(listCourseLessonPlansHandler(), createLessonHandler({ response: created }));
    const user = userEvent.setup();
    await renderWithProviders(<NewLessonButton lessonClass={LESSON_CLASS} onSaved={onSaved} />);
    await user.click(newLessonButton());
    await user.type(
      await screen.findByRole("textbox", { name: "Título da aula" }),
      "Aula de teclado",
    );
    fireEvent.change(screen.getByLabelText(/^Data da aula/), { target: { value: "2026-03-10" } });
    fireEvent.change(screen.getByLabelText(/^Hora de início/), { target: { value: "09:00" } });
    fireEvent.change(screen.getByLabelText(/^Hora de término/), { target: { value: "11:00" } });

    await user.click(screen.getByRole("button", { name: "Salvar aula" }));

    expect(await screen.findByText("Aula criada")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onSaved).toHaveBeenCalledWith(created);
    await waitFor(() => expect(newLessonButton()).toHaveFocus());
  });
});
