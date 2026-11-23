import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LessonStatus } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { LessonsCalendarPage } from "../pages/LessonsCalendarPage";
import {
  buildLessonListItem,
  buildMeUser,
  CLASS_ID,
  CLASS_NAME,
  COURSE_ID,
  LESSON_ID,
  LESSON_PLAN_ID,
  listClassesHandler,
  listCoursesHandler,
  listLessonPlansHandler,
  listLessonsCalendarHandler,
  listLessonsHandler,
  OTHER_CLASS_ID,
  OTHER_CLASS_NAME,
  OTHER_LESSON_ID,
  type ListCall,
} from "./handlers";
import { createDeferred, renderWithProviders, server, setupLessonsTestServer } from "./test-utils";

setupLessonsTestServer();

/** Tuesday, March 10th 2026, at noon in Brasília: the month of the grid is March. */
const NOW = new Date("2026-03-10T12:00:00-03:00");

beforeEach(() => {
  // Only the clock is frozen: the timers, the requests and the debounces run as they are. The time
  // zone is fixed by `setupLessonsTestServer`.
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
});
afterEach(() => {
  vi.useRealTimers();
});

function LocationProbe() {
  const location = useLocation();
  // Not an `<output>`: it has the role "status", which is the role of the region this page announces in.
  return <span data-testid="current-location">{`${location.pathname}${location.search}`}</span>;
}

const location = () => screen.getByTestId("current-location").textContent;

const KEYBOARD = buildLessonListItem();
const PASSWORDS = buildLessonListItem({
  id: OTHER_LESSON_ID,
  title: "Senhas e privacidade",
  date: "2026-03-17",
  startTime: "14:00",
  endTime: "15:30",
  status: LessonStatus.confirmed,
  class: { ...KEYBOARD.class, id: OTHER_CLASS_ID, name: OTHER_CLASS_NAME, colorIndex: 1 },
});

interface Spies {
  calendar: ListCall[];
  list: ListCall[];
  classes: ListCall[];
  courses: ListCall[];
  plans: ListCall[];
}

async function renderPage({
  route = "/lessons/calendar",
  role = Role.coordinator,
  lessons = [KEYBOARD, PASSWORDS],
}: {
  route?: string;
  role?: Role;
  lessons?: ReturnType<typeof buildLessonListItem>[];
} = {}) {
  const spies: Spies = { calendar: [], list: [], classes: [], courses: [], plans: [] };
  server.use(
    listLessonsHandler({ onCall: (call) => spies.list.push(call) }),
    listClassesHandler({ onCall: (call) => spies.classes.push(call) }),
    listCoursesHandler({ onCall: (call) => spies.courses.push(call) }),
    listLessonPlansHandler({ onCall: (call) => spies.plans.push(call) }),
    listLessonsCalendarHandler({ response: lessons, onCall: (call) => spies.calendar.push(call) }),
  );
  const view = await renderWithProviders(
    <>
      <LessonsCalendarPage />
      <LocationProbe />
    </>,
    { route, user: buildMeUser(role) },
  );
  return { ...view, spies };
}

const button = (name: string | RegExp) => screen.getByRole("button", { name });
const viewButton = (name: "Lista" | "Mês" | "Semana") =>
  within(screen.getByRole("group", { name: "Visualização" })).getByRole("button", { name });
const gridTable = () => screen.getByRole("table");
const settle = () => new Promise((resolve) => setTimeout(resolve, 250));

async function choose(user: UserEvent, name: RegExp, option: string) {
  await user.click(button(name));
  await user.click(await screen.findByRole("option", { name: option }));
}

describe("LessonsCalendarPage", () => {
  describe("the period on the screen", () => {
    it("opens the month of today, asking the 42 days of its grid", async () => {
      const { spies } = await renderPage();

      expect(await screen.findByRole("table", { name: "março de 2026" })).toBeInTheDocument();
      expect(spies.calendar).toEqual([{ from: "2026-03-01", to: "2026-04-11" }]);
      expect(screen.getByText("março de 2026", { selector: "p" })).toBeInTheDocument();
      expect(viewButton("Mês")).toHaveAttribute("aria-pressed", "true");
      expect(document.querySelector('[aria-current="date"]')).toHaveTextContent("10");
    });

    it("shows the lessons of the month as links to their screens, in the color of their class", async () => {
      await renderPage();

      const keyboard = await screen.findByRole("link", { name: /Teclado, mouse e janelas/ });
      expect(keyboard).toHaveAttribute("href", `/lessons/${LESSON_ID}`);
      expect(keyboard).toHaveClass("bg-tedi-calendar-event-0");
      expect(screen.getByRole("link", { name: /Senhas e privacidade/ })).toHaveClass(
        "bg-tedi-calendar-event-1",
      );
    });

    it("does not ask the list of lessons: the calendar has its own request", async () => {
      const { spies } = await renderPage();
      await screen.findByRole("table", { name: "março de 2026" });
      await settle();

      expect(spies.list).toHaveLength(0);
    });

    it("shows the legend Monitores abaixo do esperado, with no mark on the events", async () => {
      await renderPage();

      expect(await screen.findByText("Monitores abaixo do esperado")).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /Teclado, mouse e janelas/ }).textContent,
      ).not.toMatch(/abaixo/i);
    });

    it("the member sees the calendar too", async () => {
      await renderPage({ role: Role.member });

      expect(
        await screen.findByRole("link", { name: /Teclado, mouse e janelas/ }),
      ).toBeInTheDocument();
    });
  });

  describe("changing the period", () => {
    it("next month makes exactly one calendar request, for the 42 days of the grid, and none to /lessons", async () => {
      const user = userEvent.setup();
      const { spies } = await renderPage();
      await screen.findByRole("table", { name: "março de 2026" });
      await waitFor(() => expect(spies.classes).toHaveLength(1));
      expect(spies.calendar).toHaveLength(1);

      await user.click(button("Próximo mês"));

      expect(await screen.findByRole("table", { name: "abril de 2026" })).toBeInTheDocument();
      await settle();
      expect(spies.calendar).toEqual([
        { from: "2026-03-01", to: "2026-04-11" },
        { from: "2026-03-29", to: "2026-05-09" },
      ]);
      expect(spies.list).toHaveLength(0);
      // The options of the filters stay: nothing but the calendar was asked again.
      expect(spies.classes).toHaveLength(1);
      expect(spies.courses).toHaveLength(1);
      expect(spies.plans).toHaveLength(1);
      expect(location()).toBe("/lessons/calendar?view=month&date=2026-04-01");
    });

    it("does not read the neighbor months ahead", async () => {
      const { spies } = await renderPage();
      await screen.findByRole("table", { name: "março de 2026" });
      await settle();

      expect(spies.calendar).toHaveLength(1);
    });

    it("switching month ↔ list does not ask again", async () => {
      const user = userEvent.setup();
      const { spies } = await renderPage();
      await screen.findByRole("table", { name: "março de 2026" });

      await user.click(viewButton("Lista"));
      expect(
        await screen.findByRole("heading", { name: "terça-feira, 10 de março" }),
      ).toBeInTheDocument();
      await user.click(viewButton("Mês"));
      expect(await screen.findByRole("table", { name: "março de 2026" })).toBeInTheDocument();
      await settle();

      expect(spies.calendar).toHaveLength(1);
    });

    it("‹ and › cross the end of the year", async () => {
      const user = userEvent.setup();
      const { spies } = await renderPage({ route: "/lessons/calendar?view=month&date=2026-12-01" });
      await screen.findByRole("table", { name: "dezembro de 2026" });

      await user.click(button("Próximo mês"));
      await screen.findByRole("table", { name: "janeiro de 2027" });
      await user.click(button("Mês anterior"));
      await screen.findByRole("table", { name: "dezembro de 2026" });

      expect(location()).toBe("/lessons/calendar?view=month&date=2026-12-01");
      // The test client keeps no data fresh, so December is asked once more when it comes back;
      // what matters is which periods were asked.
      expect(new Set(spies.calendar.map((call) => call.from))).toEqual(
        new Set(["2026-11-29", "2026-12-27"]),
      );
    });

    it("‹ in the week view goes back 7 days", async () => {
      const user = userEvent.setup();
      const { spies } = await renderPage({ route: "/lessons/calendar?view=week&date=2026-03-08" });
      await screen.findByRole("list", { name: /8\s.\s14 de março de 2026/ });

      await user.click(button("Semana anterior"));

      expect(
        await screen.findByRole("list", { name: /1\s.\s7 de março de 2026/ }),
      ).toBeInTheDocument();
      expect(location()).toBe("/lessons/calendar?view=week&date=2026-03-01");
      expect(spies.calendar).toEqual([
        { from: "2026-03-08", to: "2026-03-14" },
        { from: "2026-03-01", to: "2026-03-07" },
      ]);
    });

    it("› in the week view goes forward 7 days, across the month", async () => {
      const user = userEvent.setup();
      await renderPage({ route: "/lessons/calendar?view=week&date=2026-03-29" });
      await screen.findByRole("list", { name: /29 de março\s.\s4 de abril de 2026/ });

      await user.click(button("Próxima semana"));

      expect(
        await screen.findByRole("list", { name: /5\s.\s11 de abril de 2026/ }),
      ).toBeInTheDocument();
      expect(location()).toBe("/lessons/calendar?view=week&date=2026-04-05");
    });

    it("Hoje goes back to the period of today", async () => {
      const user = userEvent.setup();
      const { spies } = await renderPage({ route: "/lessons/calendar?view=month&date=2026-07-01" });
      await screen.findByRole("table", { name: "julho de 2026" });

      await user.click(button("Hoje"));

      expect(await screen.findByRole("table", { name: "março de 2026" })).toBeInTheDocument();
      expect(location()).toBe("/lessons/calendar?view=month&date=2026-03-01");
      expect(spies.calendar.at(-1)).toEqual({ from: "2026-03-01", to: "2026-04-11" });
    });

    it("Hoje in the week view goes to the week of today", async () => {
      const user = userEvent.setup();
      await renderPage({ route: "/lessons/calendar?view=week&date=2026-07-05" });
      await screen.findByRole("list", { name: /julho/ });

      await user.click(button("Hoje"));

      expect(
        await screen.findByRole("list", { name: /8\s.\s14 de março de 2026/ }),
      ).toBeInTheDocument();
      expect(location()).toBe("/lessons/calendar?view=week&date=2026-03-08");
    });

    it("Voltar of the browser goes back to the period before", async () => {
      const user = userEvent.setup();
      const { router } = await renderPage();
      await screen.findByRole("table", { name: "março de 2026" });
      await user.click(button("Próximo mês"));
      await screen.findByRole("table", { name: "abril de 2026" });

      await act(() => router.navigate(-1));

      expect(await screen.findByRole("table", { name: "março de 2026" })).toBeInTheDocument();
      expect(location()).toBe("/lessons/calendar");
    });

    it("keeps the grid on the screen, busy, while the next month comes, and does not call it empty", async () => {
      const pending = createDeferred();
      const user = userEvent.setup();
      await renderPage();
      await screen.findByRole("link", { name: /Teclado, mouse e janelas/ });

      server.use(listLessonsCalendarHandler({ response: [], delay: pending.promise }));
      await user.click(button("Próximo mês"));

      expect(await screen.findByRole("table", { name: "abril de 2026" })).toBeInTheDocument();
      expect(gridTable().closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");
      expect(screen.queryByText("Nenhuma aula neste período")).not.toBeInTheDocument();
      pending.resolve();
      expect(await screen.findByText("Nenhuma aula neste período")).toBeInTheDocument();
      expect(gridTable().closest("[aria-busy]")).toHaveAttribute("aria-busy", "false");
    });
  });

  describe("the URL", () => {
    it("switching the view writes ?view= and keeps the filters", async () => {
      const user = userEvent.setup();
      await renderPage({ route: `/lessons/calendar?classId=${CLASS_ID}&status=planned` });
      await screen.findByRole("table", { name: "março de 2026" });

      await user.click(viewButton("Semana"));

      expect(
        await screen.findByRole("list", { name: /8\s.\s14 de março de 2026/ }),
      ).toBeInTheDocument();
      expect(new URLSearchParams(location()?.split("?")[1])).toEqual(
        new URLSearchParams(`classId=${CLASS_ID}&status=planned&view=week&date=2026-03-08`),
      );
      expect(viewButton("Semana")).toHaveAttribute("aria-pressed", "true");
    });

    it("a URL with view, date and filters opens that period", async () => {
      const { spies } = await renderPage({
        route: `/lessons/calendar?view=week&date=2026-03-08&classId=${OTHER_CLASS_ID}&courseId=${COURSE_ID}&status=confirmed&lessonPlanId=${LESSON_PLAN_ID}`,
      });

      expect(
        await screen.findByRole("list", { name: /8\s.\s14 de março de 2026/ }),
      ).toBeInTheDocument();
      await waitFor(() =>
        expect(spies.calendar).toEqual([
          {
            from: "2026-03-08",
            to: "2026-03-14",
            classId: OTHER_CLASS_ID,
            courseId: COURSE_ID,
            lessonPlanId: LESSON_PLAN_ID,
            status: "confirmed",
          },
        ]),
      );
      await waitFor(() => expect(button(/^Turma/)).toHaveTextContent(`Turma: ${OTHER_CLASS_NAME}`));
      expect(button(/^Status/)).toHaveTextContent("Status: Confirmada");
      await waitFor(() => expect(button(/^Curso/)).toHaveTextContent("Curso: Informática Básica"));
    });

    it("sends class, course, status and plan to the calendar when they are chosen, and nothing else", async () => {
      const user = userEvent.setup();
      const { spies } = await renderPage();
      await screen.findByRole("table", { name: "março de 2026" });

      await choose(user, /^Turma/, CLASS_NAME);
      await choose(user, /^Curso/, "Informática Básica");
      await choose(user, /^Status/, "Planejada");
      await choose(user, /^Plano de aula/, "Senhas e privacidade");

      await waitFor(() =>
        expect(spies.calendar.at(-1)).toEqual({
          from: "2026-03-01",
          to: "2026-04-11",
          classId: CLASS_ID,
          courseId: COURSE_ID,
          lessonPlanId: expect.any(String),
          status: "planned",
        }),
      );
      expect(spies.list).toHaveLength(0);
    });

    it("has no search box and no period: the calendar is read by the days on the screen", async () => {
      await renderPage();
      await screen.findByRole("table", { name: "março de 2026" });

      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "Período" })).not.toBeInTheDocument();
    });

    it("a view and a date that do not exist fall back to the month of today", async () => {
      const { spies } = await renderPage({ route: "/lessons/calendar?view=year&date=2026-02-31" });

      expect(await screen.findByRole("table", { name: "março de 2026" })).toBeInTheDocument();
      expect(spies.calendar).toEqual([{ from: "2026-03-01", to: "2026-04-11" }]);
    });

    it("drops an id that is not a UUID, which the API would refuse", async () => {
      const { spies } = await renderPage({ route: "/lessons/calendar?classId=banana" });

      await screen.findByRole("table", { name: "março de 2026" });
      expect(spies.calendar).toEqual([{ from: "2026-03-01", to: "2026-04-11" }]);
    });
  });

  describe("opening a lesson", () => {
    it("clicking an event opens /lessons/:id", async () => {
      const user = userEvent.setup();
      await renderPage();

      await user.click(await screen.findByRole("link", { name: /Senhas e privacidade/ }));

      expect(location()).toBe(`/lessons/${OTHER_LESSON_ID}`);
    });

    it("an event of the week and of the agenda opens it too", async () => {
      const user = userEvent.setup();
      await renderPage({ route: "/lessons/calendar?view=week&date=2026-03-08" });

      await user.click(await screen.findByRole("link", { name: /Teclado, mouse e janelas/ }));

      expect(location()).toBe(`/lessons/${LESSON_ID}`);
    });

    it("+N mais opens the week of that day, with all its events", async () => {
      const user = userEvent.setup();
      const lessons = ["a", "b", "c", "d"].map((id, index) =>
        buildLessonListItem({
          id,
          title: `Aula ${id}`,
          startTime: `0${index + 6}:00`,
          endTime: `0${index + 7}:00`,
        }),
      );
      await renderPage({ lessons });

      await user.click(await screen.findByRole("button", { name: /^\+1 mais/ }));

      expect(
        await screen.findByRole("list", { name: /8\s.\s14 de março de 2026/ }),
      ).toBeInTheDocument();
      expect(location()).toBe("/lessons/calendar?view=week&date=2026-03-08");
      expect(screen.getAllByRole("link")).toHaveLength(4);
    });
  });

  describe("the focus", () => {
    const FOUR_LESSONS = ["a", "b", "c", "d"].map((id, index) =>
      buildLessonListItem({
        id,
        title: `Aula ${id}`,
        startTime: `0${index + 6}:00`,
        endTime: `0${index + 7}:00`,
      }),
    );

    it("after +N mais, with the keyboard, goes to the week and does not fall to the page", async () => {
      const user = userEvent.setup();
      await renderPage({ lessons: FOUR_LESSONS });
      const more = await screen.findByRole("button", { name: /^\+1 mais/ });
      act(() => more.focus());
      expect(more).toHaveFocus();

      await user.keyboard("{Enter}");

      const week = await screen.findByRole("list", { name: /8\s.\s14 de março de 2026/ });
      await waitFor(() => expect(week).toHaveFocus());
      expect(document.body).not.toHaveFocus();
    });

    it("after +N mais, with the mouse, goes to the week too", async () => {
      const user = userEvent.setup();
      await renderPage({ lessons: FOUR_LESSONS });

      await user.click(await screen.findByRole("button", { name: /^\+1 mais/ }));

      const week = await screen.findByRole("list", { name: /8\s.\s14 de março de 2026/ });
      await waitFor(() => expect(week).toHaveFocus());
    });

    it("does not take the focus to the week when it is the person who changes to the week", async () => {
      const user = userEvent.setup();
      await renderPage();
      await screen.findByRole("table", { name: "março de 2026" });

      await user.click(viewButton("Semana"));

      const week = await screen.findByRole("list", { name: /8\s.\s14 de março de 2026/ });
      expect(week).not.toHaveFocus();
      expect(viewButton("Semana")).toHaveFocus();
    });

    it("after Limpar filtros goes to the first filter, since its button leaves with the message", async () => {
      const user = userEvent.setup();
      await renderPage({
        lessons: [],
        route: `/lessons/calendar?view=week&date=2026-03-08&status=done&classId=${CLASS_ID}`,
      });
      await screen.findByText("Nenhuma aula neste período");

      await user.click(screen.getByRole("button", { name: "Limpar filtros" }));

      await waitFor(() =>
        expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument(),
      );
      expect(button(/^Turma/)).toHaveTextContent("Turma: todas");
      expect(button(/^Turma/)).toHaveFocus();
    });
  });

  describe("views", () => {
    it("the agenda lists the days of the month that have a lesson, and leaves out the lessons of the neighbor days", async () => {
      await renderPage({
        route: "/lessons/calendar?view=list&date=2026-03-01",
        lessons: [
          KEYBOARD,
          buildLessonListItem({ id: "next-month", date: "2026-04-02", title: "De abril" }),
        ],
      });

      expect(
        await screen.findByRole("heading", { name: "terça-feira, 10 de março" }),
      ).toBeInTheDocument();
      expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
      expect(screen.queryByRole("link", { name: /De abril/ })).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Teclado, mouse e janelas/ })).toHaveTextContent(
        CLASS_NAME,
      );
    });

    it("the agenda of a month with lessons only in the neighbor days is an empty period", async () => {
      await renderPage({
        route: "/lessons/calendar?view=list&date=2026-03-01",
        lessons: [buildLessonListItem({ id: "next-month", date: "2026-04-02" })],
      });

      expect(await screen.findByText("Nenhuma aula neste período")).toBeInTheDocument();
    });
  });

  describe("states", () => {
    it("shows the loading state while the first period comes", async () => {
      const pending = createDeferred();
      server.use(
        listClassesHandler(),
        listCoursesHandler(),
        listLessonPlansHandler(),
        listLessonsCalendarHandler({ delay: pending.promise }),
      );
      await renderWithProviders(<LessonsCalendarPage />);

      expect(await screen.findByText("Carregando o calendário…")).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      pending.resolve();
      await screen.findByRole("table", { name: "março de 2026" });
    });

    it("shows the error and Tentar de novo asks again", async () => {
      server.use(
        listClassesHandler(),
        listCoursesHandler(),
        listLessonPlansHandler(),
        listLessonsCalendarHandler({ networkError: true }),
      );
      const user = userEvent.setup();
      await renderWithProviders(<LessonsCalendarPage />);

      const retry = await screen.findByRole("button", { name: "Tentar de novo" });
      expect(screen.getByText("Não foi possível carregar o calendário")).toBeInTheDocument();
      server.use(listLessonsCalendarHandler({ response: [KEYBOARD] }));
      await user.click(retry);

      expect(
        await screen.findByRole("link", { name: /Teclado, mouse e janelas/ }),
      ).toBeInTheDocument();
    });

    it("the message of an empty period comes in a status region that was already on the page", async () => {
      const user = userEvent.setup();
      await renderPage();
      await screen.findByRole("table", { name: "março de 2026" });
      // A region that is born full is not announced: this one is there, empty, before the message.
      const region = screen.getByRole("status");
      expect(region).toBeEmptyDOMElement();

      server.use(listLessonsCalendarHandler({ response: [] }));
      await user.click(button("Próximo mês"));

      await waitFor(() => expect(region).toHaveTextContent("Nenhuma aula neste período"));
      expect(screen.getByRole("status")).toBe(region);
    });

    it("an empty period shows the empty grid and says so, with no Limpar filtros when no filter is on", async () => {
      await renderPage({ lessons: [] });

      expect(await screen.findByText("Nenhuma aula neste período")).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Nenhuma aula neste período");
      expect(gridTable()).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
    });

    it("an empty period with filters offers Limpar filtros, which keeps the view and the date", async () => {
      const user = userEvent.setup();
      await renderPage({
        lessons: [],
        route: `/lessons/calendar?view=week&date=2026-03-08&status=done&classId=${CLASS_ID}`,
      });
      await screen.findByText("Nenhuma aula neste período");

      server.use(listLessonsCalendarHandler({ response: [KEYBOARD] }));
      await user.click(screen.getByRole("button", { name: "Limpar filtros" }));

      expect(
        await screen.findByRole("link", { name: /Teclado, mouse e janelas/ }),
      ).toBeInTheDocument();
      expect(location()).toBe("/lessons/calendar?view=week&date=2026-03-08");
      expect(button(/^Status/)).toHaveTextContent("Status: todos");
      expect(screen.queryByText("Nenhuma aula neste período")).not.toBeInTheDocument();
    });
  });
});
