import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClassesRoutes } from "@modules/classes";
import {
  buildArchivedClassDetail,
  buildClassCourse,
  buildClassDetail,
  CLASS_ID,
  CLASS_NAME,
  getClassHandler,
  getCourseHandler,
  listCourseClassesHandler,
} from "@modules/classes/__tests__/handlers";
import {
  buildLesson,
  buildMeUser,
  createLessonHandler,
  listCourseLessonPlansHandler,
  type CreateLessonCall,
} from "@modules/lessons/__tests__/handlers";
import {
  renderRoutes,
  server,
  setupLessonsTestServer,
} from "@modules/lessons/__tests__/test-utils";
import { Role } from "@shared/lib/role";

import { classesRouteSlots } from "../classes-slots";

setupLessonsTestServer();

const routes = createClassesRoutes(classesRouteSlots);
const CLASS_ROUTE = `/classes/${CLASS_ID}`;
const OTHER_COURSE_ID = "01952ef7-0000-7000-8000-0000000000c9";

// "Curso de origem" asks for the course and the total of its classes by itself (GUS-134).
beforeEach(() => {
  server.use(getCourseHandler(), listCourseClassesHandler());
});

/** The card (the root with `data-slot="card"`) whose `<h2>` is `name`. */
function card(name: string): HTMLElement {
  const root = screen.getByRole("heading", { name }).closest("[data-slot='card']");
  if (!(root instanceof HTMLElement)) throw new Error(`No card titled "${name}"`);
  return root;
}

const newLessonButton = () => within(card(CLASS_NAME)).getByRole("button", { name: "Nova aula" });

describe("the slots of the classes, filled by the app", () => {
  it("coordinator opens Nova aula from the class screen with the class fixed", async () => {
    const onPlans = vi.fn();
    server.use(
      getClassHandler({
        response: buildClassDetail({ course: buildClassCourse({ id: OTHER_COURSE_ID }) }),
      }),
      listCourseLessonPlansHandler({ onCall: onPlans }),
    );
    const user = userEvent.setup();
    await renderRoutes(routes, { route: CLASS_ROUTE, user: buildMeUser(Role.coordinator) });
    await screen.findByRole("heading", { name: CLASS_NAME });

    await user.click(newLessonButton());

    const dialog = await screen.findByRole("dialog", { name: "Nova aula" });
    expect(within(dialog).getByLabelText(/^Turma/)).toHaveValue(CLASS_NAME);
    expect(within(dialog).getByLabelText(/^Turma/)).toHaveAttribute("readonly");
    // The period of the class of the screen is the one the date is asked to be in.
    expect(within(dialog).getByLabelText(/^Data da aula/)).toHaveAccessibleDescription(
      "Período da turma: 03/03/2026 a 27/06/2026",
    );
    // The plans offered are the sequence of the course of the class of the screen.
    await waitFor(() => expect(onPlans).toHaveBeenCalledExactlyOnceWith({ id: OTHER_COURSE_ID }));
  });

  it("puts + Nova aula in the header of the class, next to its name", async () => {
    server.use(getClassHandler());
    await renderRoutes(routes, { route: CLASS_ROUTE, user: buildMeUser(Role.director) });
    await screen.findByRole("heading", { name: CLASS_NAME });

    expect(newLessonButton()).toHaveClass("button--primary");
    expect(newLessonButton()).toHaveTextContent("+ Nova aula");
  });

  it("member does not see + Nova aula on the class screen", async () => {
    server.use(getClassHandler());
    await renderRoutes(routes, { route: CLASS_ROUTE, user: buildMeUser(Role.member) });
    await screen.findByRole("heading", { name: CLASS_NAME });

    expect(screen.queryByRole("button", { name: /Nova aula/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("an archived class has no + Nova aula, even for the coordinator", async () => {
    server.use(getClassHandler({ response: buildArchivedClassDetail() }));
    await renderRoutes(routes, { route: CLASS_ROUTE, user: buildMeUser(Role.coordinator) });
    await screen.findByRole("heading", { name: CLASS_NAME });

    expect(screen.queryByRole("button", { name: /Nova aula/ })).not.toBeInTheDocument();
  });

  it("creates the lesson of the class of the screen, and the class screen reads the class again", async () => {
    const onCreate = vi.fn<(call: CreateLessonCall) => void>();
    const onGetClass = vi.fn();
    const created = buildLesson({ title: "Aula de teclado" });
    server.use(
      getClassHandler({ onCall: onGetClass }),
      listCourseLessonPlansHandler(),
      createLessonHandler({ response: created, onCall: onCreate }),
    );
    const user = userEvent.setup();
    await renderRoutes(routes, { route: CLASS_ROUTE, user: buildMeUser(Role.coordinator) });
    await screen.findByRole("heading", { name: CLASS_NAME });
    expect(onGetClass).toHaveBeenCalledTimes(1);
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
    expect(onCreate.mock.calls[0]?.[0].body).toMatchObject({
      classId: CLASS_ID,
      lessonPlanId: null,
      title: "Aula de teclado",
      date: "2026-03-10",
    });
    // The summary and the lessons of the class changed: the screen asks for the class again.
    await waitFor(() => expect(onGetClass).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(newLessonButton()).toHaveFocus());
  });
});
