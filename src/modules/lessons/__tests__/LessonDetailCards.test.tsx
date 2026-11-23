import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LessonStatus } from "@api/generated/model";

import { LessonBreadcrumb } from "../components/LessonBreadcrumb";
import { LessonDetailHeader } from "../components/LessonDetailHeader";
import { buildLesson, CLASS_NAME, COURSE_NAME } from "./handlers";
import { renderWithProviders, setupLessonsTestServer } from "./test-utils";

setupLessonsTestServer();

const LESSON_TITLE = "Teclado, mouse e janelas";

const tags = () => screen.getAllByRole("listitem").map((tag) => tag.textContent);

describe("LessonDetailHeader", () => {
  it("shows the title of the lesson as a heading of level 2", async () => {
    await renderWithProviders(<LessonDetailHeader lesson={buildLesson()} />);

    expect(screen.getByRole("heading", { level: 2, name: LESSON_TITLE })).toBeInTheDocument();
  });

  it("shows the tags: status, class, course, day and time, duration and location, in this order", async () => {
    await renderWithProviders(<LessonDetailHeader lesson={buildLesson()} />);

    expect(tags()).toEqual([
      "Planejada",
      `Turma ${CLASS_NAME}`,
      COURSE_NAME,
      "10/03/2026 · 09:00–11:00",
      "2h de aula",
      "Laboratório 2 — Bloco B",
    ]);
  });

  it("leaves the location out for a lesson that has none, with no empty tag", async () => {
    await renderWithProviders(<LessonDetailHeader lesson={buildLesson({ location: null })} />);

    expect(tags()).toEqual([
      "Planejada",
      `Turma ${CLASS_NAME}`,
      COURSE_NAME,
      "10/03/2026 · 09:00–11:00",
      "2h de aula",
    ]);
  });

  it("names a class that has no name by its code", async () => {
    const lesson = buildLesson();
    await renderWithProviders(
      <LessonDetailHeader lesson={{ ...lesson, class: { ...lesson.class, name: null } }} />,
    );

    expect(tags()[1]).toBe("Turma INFO-A");
  });

  it.each([
    [LessonStatus.planned, "Planejada", "bg-tedi-neutral"],
    [LessonStatus.confirmed, "Confirmada", "bg-tedi-badge"],
    [LessonStatus.done, "Realizada", "bg-tedi-badge-success"],
    [LessonStatus.cancelled, "Cancelada", "bg-danger-soft"],
  ])(
    "tags a %s lesson as %s, with the tone of the other lesson screens",
    async (status, label, tone) => {
      await renderWithProviders(<LessonDetailHeader lesson={buildLesson({ status })} />);

      expect(tags()[0]).toBe(label);
      expect(screen.getByText(label)).toHaveClass(tone);
    },
  );

  it.each([
    [60, "1h de aula"],
    [90, "1h30 de aula"],
    [120, "2h de aula"],
    [45, "0h45 de aula"],
  ])("says a duration of %s minutes as %s", async (durationMinutes, label) => {
    await renderWithProviders(<LessonDetailHeader lesson={buildLesson({ durationMinutes })} />);

    expect(tags()[4]).toBe(label);
  });

  it("writes the day as the locale does, from the calendar date and not from a time zone", async () => {
    await renderWithProviders(<LessonDetailHeader lesson={buildLesson({ date: "2026-12-01" })} />);

    expect(tags()[3]).toBe("01/12/2026 · 09:00–11:00");
  });

  it("draws nothing on the right of the title without the actions prop", async () => {
    await renderWithProviders(<LessonDetailHeader lesson={buildLesson()} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(document.querySelector("[data-slot='card'] .flex-wrap.gap-3")).toBeNull();
  });

  it("draws the given actions on the right of the title, in one container, in the order they come", async () => {
    await renderWithProviders(
      <LessonDetailHeader
        lesson={buildLesson()}
        actions={
          <>
            <button type="button">Remarcar aula</button>
            <button type="button">Cancelar aula</button>
            <button type="button">Editar aula</button>
          </>
        }
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Remarcar aula",
      "Cancelar aula",
      "Editar aula",
    ]);
    expect(buttons[0].parentElement).toBe(buttons[2].parentElement);
    expect(buttons[0].parentElement).toHaveClass("flex", "flex-wrap", "gap-3");
    const title = screen.getByRole("heading", { level: 2, name: LESSON_TITLE });
    expect(
      title.compareDocumentPosition(buttons[0]) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("puts the actions beside the title from the medium width on, and under it on a phone", async () => {
    await renderWithProviders(
      <LessonDetailHeader
        lesson={buildLesson()}
        actions={<button type="button">Editar aula</button>}
      />,
    );

    const row = screen.getByRole("button", { name: "Editar aula" }).parentElement?.parentElement;
    expect(row).toHaveClass("flex-col", "md:flex-row", "md:justify-between");
  });
});

describe("LessonBreadcrumb", () => {
  it("is a navigation named Trilha de navegação, with two steps: Aulas and the lesson", async () => {
    await renderWithProviders(<LessonBreadcrumb lesson={buildLesson()} />);

    const trail = screen.getByRole("navigation", { name: "Trilha de navegação" });
    expect(within(trail).getAllByRole("listitem")).toHaveLength(2);
  });

  it("takes Aulas to the lessons, with a target of at least 44px", async () => {
    await renderWithProviders(<LessonBreadcrumb lesson={buildLesson()} />);

    const link = screen.getByRole("link", { name: "Aulas" });
    expect(link).toHaveAttribute("href", "/lessons");
    expect(link).toHaveClass("min-h-11");
  });

  it("says the lesson by its day and its title, as the current page and not as a link", async () => {
    await renderWithProviders(<LessonBreadcrumb lesson={buildLesson()} />);

    const current = screen.getByText(`10/03/2026 · ${LESSON_TITLE}`);
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current.closest("a")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("hides the separator from who listens", async () => {
    await renderWithProviders(<LessonBreadcrumb lesson={buildLesson()} />);

    expect(screen.getByText("›")).toHaveAttribute("aria-hidden", "true");
  });
});
