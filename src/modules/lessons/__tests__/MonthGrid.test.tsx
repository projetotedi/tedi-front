import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LessonStatus } from "@api/generated/model";

import { MonthGrid } from "../components/MonthGrid";
import { buildLessonListItem, CLASS_NAME, LESSON_ID, OTHER_LESSON_ID } from "./handlers";
import { renderWithProviders, setupLessonsTestServer } from "./test-utils";

setupLessonsTestServer();

const TODAY = "2026-03-10";

async function renderGrid(
  lessons = [buildLessonListItem()],
  { anchor = "2026-03-10", onShowDay = vi.fn() }: { anchor?: string; onShowDay?: () => void } = {},
) {
  const view = await renderWithProviders(
    <MonthGrid anchor={anchor} today={TODAY} lessons={lessons} onShowDay={onShowDay} />,
  );
  return { ...view, onShowDay };
}

describe("MonthGrid", () => {
  it("draws 42 days with today marked", async () => {
    await renderGrid();

    expect(screen.getAllByRole("cell")).toHaveLength(42);
    expect(screen.getAllByRole("row")).toHaveLength(7);
    const today = document.querySelectorAll('[aria-current="date"]');
    expect(today).toHaveLength(1);
    expect(today[0]).toHaveTextContent("10");
    expect(today[0]).toHaveTextContent("terça-feira, 10 de março");
    expect(today[0]).toHaveClass("bg-accent", "text-accent-foreground");
  });

  it("has the month as the caption and a header for each day of the week, from Sunday", async () => {
    await renderGrid();

    expect(screen.getByRole("table")).toHaveAccessibleName("março de 2026");
    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(7);
    expect(headers.map((header) => header.getAttribute("scope"))).toEqual(Array(7).fill("col"));
    expect(headers[0]).toHaveAccessibleName("domingo");
    expect(headers[1]).toHaveAccessibleName("segunda-feira");
    expect(headers[6]).toHaveAccessibleName("sábado");
  });

  it("starts the grid on the Sunday before the 1st and ends 42 days later", async () => {
    await renderGrid([], { anchor: "2026-04-15" });

    const cells = screen.getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("domingo, 29 de março");
    expect(cells[3]).toHaveTextContent("quarta-feira, 1 de abril");
    expect(cells[41]).toHaveTextContent("sábado, 9 de maio");
  });

  it("paints the days of the neighbor months paler than the days of the month", async () => {
    await renderGrid([], { anchor: "2026-04-15" });

    const cells = screen.getAllByRole("cell");
    // March 29th, April 1st, April 30th and May 1st.
    expect(cells[0].querySelector("span")).toHaveClass("text-muted");
    expect(cells[3].querySelector("span")).toHaveClass("text-foreground");
    expect(cells[32].querySelector("span")).toHaveClass("text-foreground");
    expect(cells[33].querySelector("span")).toHaveClass("text-muted");
  });

  it("each event is a link named by time, title, class and status", async () => {
    await renderGrid([
      buildLessonListItem(),
      buildLessonListItem({
        id: OTHER_LESSON_ID,
        title: "Senhas e privacidade",
        date: "2026-03-17",
        startTime: "14:00",
        endTime: "15:30",
        status: LessonStatus.confirmed,
      }),
    ]);

    const first = screen.getByRole("link", {
      name: `09:00–11:00, Teclado, mouse e janelas, turma ${CLASS_NAME}, Planejada`,
    });
    expect(first).toHaveAttribute("href", `/lessons/${LESSON_ID}`);
    expect(first.closest("td")).toHaveTextContent("terça-feira, 10 de março");
    const second = screen.getByRole("link", {
      name: `14:00–15:30, Senhas e privacidade, turma ${CLASS_NAME}, Confirmada`,
    });
    expect(second.closest("td")).toHaveTextContent("terça-feira, 17 de março");
  });

  it("puts the events of a day in the order they start", async () => {
    await renderGrid([
      buildLessonListItem({ id: "late", title: "Tarde", startTime: "14:00", endTime: "16:00" }),
      buildLessonListItem({ id: "early", title: "Manhã", startTime: "08:00", endTime: "09:00" }),
    ]);

    const links = within(screen.getByRole("list")).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/lessons/early",
      "/lessons/late",
    ]);
  });

  it("gives each class its color, by the slot the API gave it", async () => {
    const lesson = buildLessonListItem();
    await renderGrid([{ ...lesson, class: { ...lesson.class, colorIndex: 3 } }]);

    expect(screen.getByRole("link")).toHaveClass("bg-tedi-calendar-event-3");
  });

  it("a cancelled event says Cancelada in text", async () => {
    await renderGrid([buildLessonListItem({ status: LessonStatus.cancelled })]);

    const link = screen.getByRole("link");
    expect(within(link).getByText("Cancelada")).toBeInTheDocument();
    expect(within(link).getByText("Teclado, mouse e janelas")).toHaveClass("line-through");
  });

  it("shows up to three events in a day and no +N mais for three", async () => {
    await renderGrid(["a", "b", "c"].map((id) => buildLessonListItem({ id, title: `Aula ${id}` })));

    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("+N mais shows the day: it keeps three events and asks the screen to open the day", async () => {
    const user = userEvent.setup();
    const { onShowDay } = await renderGrid(
      ["a", "b", "c", "d", "e"].map((id, index) =>
        buildLessonListItem({
          id,
          title: `Aula ${id}`,
          startTime: `0${index + 6}:00`,
          endTime: `0${index + 7}:00`,
        }),
      ),
    );

    expect(screen.getAllByRole("link")).toHaveLength(3);
    const more = screen.getByRole("button", { name: /^\+2 mais/ });
    expect(more).toHaveTextContent("+2 mais");
    expect(more).toHaveClass("text-accent", "underline");
    expect(more).toHaveAccessibleName("+2 mais: ver as aulas de 10 de março na semana");
    await user.click(more);

    expect(onShowDay).toHaveBeenCalledExactlyOnceWith("2026-03-10");
  });

  it("says +1 mais, in the singular, for the fourth event", async () => {
    await renderGrid(["a", "b", "c", "d"].map((id) => buildLessonListItem({ id })));

    expect(screen.getByRole("button", { name: /^\+1 mais/ })).toHaveAccessibleName(
      "+1 mais: ver a aula de 10 de março na semana",
    );
  });

  it("draws the lessons of the days of the neighbor months that the grid shows", async () => {
    await renderGrid([buildLessonListItem({ date: "2026-04-02" })], { anchor: "2026-03-10" });

    expect(screen.getByRole("link").closest("td")).toHaveTextContent("quinta-feira, 2 de abril");
  });

  it("scrolls sideways on a narrow screen instead of squeezing the days", async () => {
    await renderGrid();

    expect(screen.getByRole("table")).toHaveClass("min-w-176");
    // `relative` so the sr-only dates of the days are clipped with it, and do not widen the page.
    expect(screen.getByRole("table").parentElement).toHaveClass("relative", "overflow-x-auto");
  });
});
