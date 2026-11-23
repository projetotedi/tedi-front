import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LessonStatus } from "@api/generated/model";

import { CalendarEvent } from "../components/CalendarEvent";
import { buildLessonListItem, CLASS_NAME, LESSON_ID } from "./handlers";
import { renderWithProviders, setupLessonsTestServer } from "./test-utils";

setupLessonsTestServer();

const link = () => screen.getByRole("link");

describe("CalendarEvent", () => {
  it("is a link to the lesson, named by time, title, class and status", async () => {
    await renderWithProviders(<CalendarEvent lesson={buildLessonListItem()} />);

    expect(link()).toHaveAttribute("href", `/lessons/${LESSON_ID}`);
    expect(link()).toHaveAccessibleName(
      `09:00–11:00, Teclado, mouse e janelas, turma ${CLASS_NAME}, Planejada`,
    );
    expect(within(link()).getByText("09:00–11:00")).toBeInTheDocument();
    expect(within(link()).getByText("Teclado, mouse e janelas")).toBeInTheDocument();
  });

  it.each([0, 1, 2, 3, 4, 5, 6, 7])("has the color of the slot %i of its class", async (slot) => {
    const lesson = buildLessonListItem();
    await renderWithProviders(
      <CalendarEvent lesson={{ ...lesson, class: { ...lesson.class, colorIndex: slot } }} />,
    );

    expect(link()).toHaveClass(
      `bg-tedi-calendar-event-${slot}`,
      `text-tedi-calendar-event-${slot}-foreground`,
    );
  });

  it("shows the name of the class only when asked", async () => {
    const { unmount } = await renderWithProviders(<CalendarEvent lesson={buildLessonListItem()} />);
    expect(within(link()).queryByText(CLASS_NAME)).not.toBeInTheDocument();
    unmount();

    await renderWithProviders(<CalendarEvent lesson={buildLessonListItem()} showClass />);
    expect(within(link()).getByText(CLASS_NAME)).toBeInTheDocument();
  });

  it("a cancelled lesson is struck through and says Cancelada in text, not only in color", async () => {
    await renderWithProviders(
      <CalendarEvent lesson={buildLessonListItem({ status: LessonStatus.cancelled })} />,
    );

    expect(within(link()).getByText("Teclado, mouse e janelas")).toHaveClass("line-through");
    expect(within(link()).getByText("Cancelada")).toBeInTheDocument();
    expect(link()).toHaveAccessibleName(/Cancelada$/);
  });

  it("a lesson that is not cancelled has no strike and no tag", async () => {
    await renderWithProviders(
      <CalendarEvent lesson={buildLessonListItem({ status: LessonStatus.confirmed })} />,
    );

    expect(within(link()).getByText("Teclado, mouse e janelas")).not.toHaveClass("line-through");
    expect(within(link()).queryByText("Cancelada")).not.toBeInTheDocument();
    expect(link()).toHaveAccessibleName(/Confirmada$/);
  });

  it("writes the name of the class and the word Cancelada in 14px, never smaller", async () => {
    await renderWithProviders(
      <CalendarEvent lesson={buildLessonListItem({ status: LessonStatus.cancelled })} showClass />,
    );

    expect(link()).toHaveClass("text-sm");
    for (const text of [CLASS_NAME, "Cancelada", "09:00–11:00", "Teclado, mouse e janelas"]) {
      const part = within(link()).getByText(text);
      expect(part, text).not.toHaveClass("text-xs");
    }
    expect(within(link()).getByText(CLASS_NAME)).toHaveClass("text-sm");
    expect(within(link()).getByText("Cancelada")).toHaveClass("text-sm");
  });

  it("is at least 44px high and shows a ring with the focus", async () => {
    await renderWithProviders(<CalendarEvent lesson={buildLessonListItem()} />);

    expect(link()).toHaveClass("min-h-11", "focus-visible:ring-3", "focus-visible:ring-focus");
  });
});
