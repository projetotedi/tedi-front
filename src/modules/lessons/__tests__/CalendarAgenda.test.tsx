import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CalendarAgenda } from "../components/CalendarAgenda";
import { monthDays } from "../lib/calendar-period";
import { buildLessonListItem, CLASS_NAME, LESSON_ID, OTHER_LESSON_ID } from "./handlers";
import { renderWithProviders, setupLessonsTestServer } from "./test-utils";

setupLessonsTestServer();

const MARCH = monthDays("2026-03-10");

describe("CalendarAgenda", () => {
  it("lists only the days that have a lesson, each under a heading with the full date", async () => {
    await renderWithProviders(
      <CalendarAgenda
        days={MARCH}
        lessons={[
          buildLessonListItem({
            id: OTHER_LESSON_ID,
            title: "Senhas e privacidade",
            date: "2026-03-17",
          }),
          buildLessonListItem(),
        ]}
      />,
    );

    expect(
      screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(["terça-feira, 10 de março", "terça-feira, 17 de março"]);
  });

  it("puts the lessons of a day under its heading, in the order they start, with the class", async () => {
    await renderWithProviders(
      <CalendarAgenda
        days={MARCH}
        lessons={[
          buildLessonListItem({ id: "late", title: "Tarde", startTime: "14:00", endTime: "16:00" }),
          buildLessonListItem({
            id: LESSON_ID,
            title: "Manhã",
            startTime: "08:00",
            endTime: "09:00",
          }),
        ]}
      />,
    );

    const day = screen.getByRole("region", { name: "terça-feira, 10 de março" });
    const links = within(day).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      `/lessons/${LESSON_ID}`,
      "/lessons/late",
    ]);
    expect(within(links[0]).getByText(CLASS_NAME)).toBeInTheDocument();
  });

  it("leaves out a lesson of a day that is not one of the days it was given", async () => {
    await renderWithProviders(
      <CalendarAgenda
        days={MARCH}
        lessons={[buildLessonListItem({ date: "2026-04-02" }), buildLessonListItem({ id: "in" })]}
      />,
    );

    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByText(/de abril/)).not.toBeInTheDocument();
  });

  it("draws nothing when no day has a lesson", async () => {
    const { container } = await renderWithProviders(<CalendarAgenda days={MARCH} lessons={[]} />);

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(container.querySelector("section")).toBeNull();
  });
});
