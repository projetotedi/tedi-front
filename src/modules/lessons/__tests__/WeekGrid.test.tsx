import { createRef } from "react";
import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LessonStatus } from "@api/generated/model";

import { WeekGrid } from "../components/WeekGrid";
import { buildLessonListItem, CLASS_NAME, LESSON_ID, OTHER_LESSON_ID } from "./handlers";
import { renderWithProviders, setupLessonsTestServer } from "./test-utils";

setupLessonsTestServer();

const TODAY = "2026-03-10";

async function renderWeek(lessons = [buildLessonListItem()], anchor = "2026-03-10") {
  return renderWithProviders(<WeekGrid anchor={anchor} today={TODAY} lessons={lessons} />);
}

const days = () => within(screen.getByRole("list", { name: /março/ })).getAllByRole("heading");

describe("WeekGrid", () => {
  it("has one column for each of the seven days of the week, from Sunday", async () => {
    await renderWeek();

    expect(screen.getByRole("list", { name: /8\s.\s14 de março de 2026/ })).toBeInTheDocument();
    expect(days().map((day) => day.textContent)).toEqual([
      expect.stringContaining("domingo, 8 de março"),
      expect.stringContaining("segunda-feira, 9 de março"),
      expect.stringContaining("terça-feira, 10 de março"),
      expect.stringContaining("quarta-feira, 11 de março"),
      expect.stringContaining("quinta-feira, 12 de março"),
      expect.stringContaining("sexta-feira, 13 de março"),
      expect.stringContaining("sábado, 14 de março"),
    ]);
  });

  it("writes the weekday and the number of each day, and marks today", async () => {
    await renderWeek();

    const today = document.querySelector('[aria-current="date"]');
    expect(document.querySelectorAll('[aria-current="date"]')).toHaveLength(1);
    expect(today).toHaveTextContent("10");
    expect(today).toHaveClass("bg-accent", "text-accent-foreground");
    expect(today?.closest("h3")).toHaveTextContent("terça-feira, 10 de março");
  });

  it("reads the full date inside the element that says it is today, not next to it", async () => {
    await renderWeek();

    // `aria-current="date"` on a bare number that is hidden from the screen reader would say
    // nothing: the date is the text of the element itself.
    const today = document.querySelector('[aria-current="date"]') as HTMLElement;
    expect(within(today).getByText("terça-feira, 10 de março")).toHaveClass("sr-only");
    expect(within(today).getByText("10")).toHaveAttribute("aria-hidden", "true");
    // The other days read their date by the same rule, in the same place.
    const monday = days()[1].querySelector("span:not([aria-hidden])") as HTMLElement;
    expect(within(monday).getByText("segunda-feira, 9 de março")).toHaveClass("sr-only");
  });

  it("gives the list the focus by the ref it was given, and Tab does not stop at it", async () => {
    const listRef = createRef<HTMLOListElement>();
    await renderWithProviders(
      <WeekGrid
        anchor="2026-03-10"
        today={TODAY}
        lessons={[buildLessonListItem()]}
        listRef={listRef}
      />,
    );
    const list = screen.getByRole("list", { name: /8\s.\s14 de março de 2026/ });

    expect(listRef.current).toBe(list);
    expect(list).toHaveAttribute("tabindex", "-1");
    act(() => listRef.current?.focus());
    expect(list).toHaveFocus();
    expect(list).toHaveClass("focus-visible:ring-3", "focus-visible:ring-focus");
  });

  it("a week across two months names the days of both", async () => {
    await renderWeek([], "2026-03-31");

    expect(days()[0]).toHaveTextContent("domingo, 29 de março");
    expect(days()[6]).toHaveTextContent("sábado, 4 de abril");
  });

  it("puts the lessons of each day under it, in the order they start, with the class", async () => {
    await renderWeek([
      buildLessonListItem({ id: "late", title: "Tarde", startTime: "14:00", endTime: "16:00" }),
      buildLessonListItem({ id: OTHER_LESSON_ID, title: "Quinta", date: "2026-03-12" }),
      buildLessonListItem({ id: LESSON_ID, title: "Manhã", startTime: "08:00", endTime: "09:00" }),
    ]);

    const tuesday = days()[2].closest("li") as HTMLElement;
    const links = within(tuesday).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      `/lessons/${LESSON_ID}`,
      "/lessons/late",
    ]);
    expect(within(links[0]).getByText(CLASS_NAME)).toBeInTheDocument();
    expect(
      within(days()[4].closest("li") as HTMLElement).getByRole("link", { name: /Quinta/ }),
    ).toHaveAttribute("href", `/lessons/${OTHER_LESSON_ID}`);
  });

  it("names each event by time, title, class and status", async () => {
    await renderWeek([buildLessonListItem({ status: LessonStatus.cancelled })]);

    expect(screen.getByRole("link")).toHaveAccessibleName(
      `09:00–11:00, Teclado, mouse e janelas, turma ${CLASS_NAME}, Cancelada`,
    );
    expect(within(screen.getByRole("link")).getByText("Cancelada")).toBeInTheDocument();
  });

  it("is one list on a narrow screen, with the days that have no lesson left out of it", async () => {
    await renderWeek();

    const items = within(screen.getByRole("list", { name: /março/ })).getAllByRole("listitem", {
      hidden: true,
    });
    const days7 = items.filter((item) => item.querySelector("h3"));
    expect(days7).toHaveLength(7);
    // Tuesday has the lesson: shown on every width. The others are hidden below md.
    expect(days7[2]).toHaveClass("flex");
    expect(days7[2]).not.toHaveClass("hidden");
    for (const day of days7.filter((_, index) => index !== 2)) {
      expect(day).toHaveClass("hidden", "md:flex");
    }
    expect(screen.getByRole("list", { name: /março/ })).toHaveClass(
      "grid-cols-1",
      "md:grid-cols-7",
    );
  });
});
