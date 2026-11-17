import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MeResponseDto } from "@api/generated/model";
import {
  buildMemberListItem,
  buildMembersPage,
  buildMeUserWith as buildAllocatorUserWith,
  createAssignmentHandler,
  listMembersHandler,
  MEMBER_ID,
  MEMBER_NAME,
  type CreateAssignmentCall,
} from "@modules/assignments/__tests__/handlers";
import { createClassesRoutes } from "@modules/classes";
import {
  buildArchivedClassDetail,
  buildClassCourse,
  buildClassDetail,
  buildClassSummary,
  buildMeUser as buildClassesMeUser,
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
  buildGeneratedLessons,
  buildLessonListItem,
  buildLessonsPage,
  buildPreviewFor,
  generateClassLessonsHandler,
  listLessonsHandler,
  previewClassLessonsHandler,
  type ListLessonsCall,
} from "@modules/lessons/__tests__/generate-handlers";
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

// "Curso de origem" asks for the course and the total of its classes by itself (GUS-134), and
// "Aulas da turma" asks for the lessons of the class (GUS-157). A test that needs other lessons
// overrides this handler.
beforeEach(() => {
  server.use(
    getCourseHandler(),
    listCourseClassesHandler(),
    listLessonsHandler({ response: buildLessonsPage([]) }),
  );
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

/** The period of the class of the `classes` handlers: the preview has to judge the lessons by it. */
const CLASS_PERIOD = { classStartDate: "2026-03-03", classEndDate: "2026-06-27" };

/** The user of the classes tests, who can also see the lessons, and manage them unless a member. */
function buildUser(role: Role = Role.coordinator): MeResponseDto {
  const user = buildClassesMeUser(role);
  const canManage = role !== Role.member;
  return {
    ...user,
    permissions: {
      ...user.permissions,
      "lessons.view": "all",
      "lessons.manage": canManage ? "all" : "none",
    },
  };
}

describe("Gerar aulas and Aulas da turma, filled by the app", () => {
  it("puts Gerar aulas in the header and Aulas da turma among the cards", async () => {
    server.use(
      getClassHandler(),
      listLessonsHandler({ response: buildLessonsPage([buildLessonListItem(0)]) }),
    );
    await renderRoutes(routes, { route: CLASS_ROUTE, user: buildUser() });

    const header = (await screen.findByRole("heading", { level: 2, name: CLASS_NAME })).closest(
      "[data-slot='card']",
    );
    expect(header).not.toBeNull();
    expect(within(header as HTMLElement).getByRole("button", { name: "Gerar aulas" })).toHaveClass(
      "button--tertiary",
    );

    const titles = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(titles.indexOf("Aulas da turma")).toBe(titles.indexOf("Dados da turma") + 1);
    expect(titles.indexOf("Alunos matriculados")).toBe(titles.indexOf("Aulas da turma") + 1);
    expect(await within(card("Aulas da turma")).findByRole("table")).toBeInTheDocument();
  });

  it("asks the lessons of the class of the route, five of them", async () => {
    const onCall = vi.fn<(call: ListLessonsCall) => void>();
    server.use(getClassHandler(), listLessonsHandler({ onCall }));
    await renderRoutes(routes, { route: CLASS_ROUTE, user: buildUser() });
    await screen.findByText("Nenhuma aula ainda.");

    expect(onCall).toHaveBeenCalledExactlyOnceWith({ classId: CLASS_ID, page: null, limit: 5 });
  });

  it("after generating, Aulas da turma lists the lessons with no reload", async () => {
    const onGetClass = vi.fn();
    const lessons = [0, 1, 2].map((index) => buildLessonListItem(index));
    server.use(
      getClassHandler({ response: buildClassDetail(), onCall: onGetClass }),
      listLessonsHandler({ response: buildLessonsPage([]) }),
      previewClassLessonsHandler({
        response: (call) => buildPreviewFor(call.body, CLASS_PERIOD),
      }),
      generateClassLessonsHandler({
        response: buildGeneratedLessons(3),
        // From the moment the API creates the lessons, it answers as a class that has them.
        onCall: () =>
          server.use(
            getClassHandler({
              response: buildClassDetail({
                summary: buildClassSummary({ lessonsDone: 0, lessonsTotal: 3 }),
              }),
              onCall: onGetClass,
            }),
            listLessonsHandler({ response: buildLessonsPage(lessons, 3) }),
          ),
      }),
    );
    const user = userEvent.setup();
    const { router } = await renderRoutes(routes, { route: CLASS_ROUTE, user: buildUser() });

    // Before: the card says there is no lesson yet, and the summary has no number of lessons.
    expect(await screen.findByText("Nenhuma aula ainda.")).toBeVisible();
    expect(within(card("Aulas da turma")).queryByRole("table")).not.toBeInTheDocument();
    expect(onGetClass).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Gerar aulas" }));
    await screen.findByRole("dialog", { name: "Gerar aulas da turma" });
    await user.click(screen.getByRole("button", { name: /Dia da semana/ }));
    await user.click(await screen.findByRole("option", { name: "Terça-feira" }));
    await user.type(screen.getByLabelText("Hora de início"), "09:00");
    await user.type(screen.getByLabelText("Hora de término"), "11:00");
    // The first date starts with the first day of the class, which is the one of the Figma.
    expect(screen.getByLabelText("Data da primeira aula")).toHaveValue("2026-03-03");
    await user.click(await screen.findByRole("button", { name: "Gerar 3 aulas" }));

    // After: the toast, the dialog gone and the card listing the lessons, on the same page.
    expect(await screen.findByText("3 aulas geradas")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const table = await within(card("Aulas da turma")).findByRole("table");
    expect(
      within(table)
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getAllByRole("cell")[2].textContent),
    ).toEqual(["Conhecendo o computador", "Teclado, mouse e janelas", "Navegando na internet"]);
    expect(
      within(card("Aulas da turma")).getByRole("link", {
        name: "Ver todas as 3 aulas desta turma",
      }),
    ).toBeVisible();
    // The class itself was asked again: the summary now counts the lessons.
    await waitFor(() => expect(onGetClass).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        within(card("Resumo")).getByText("Aulas realizadas", { selector: "dt" }).nextElementSibling,
      ).toHaveTextContent(/^0 de 3$/),
    );
    expect(router.state.location.pathname).toBe(CLASS_ROUTE);
  });

  it("a member sees the lessons card but not Gerar aulas", async () => {
    server.use(
      getClassHandler(),
      listLessonsHandler({ response: buildLessonsPage([buildLessonListItem(0)]) }),
    );
    await renderRoutes(routes, { route: CLASS_ROUTE, user: buildUser(Role.member) });
    await screen.findByRole("heading", { level: 2, name: CLASS_NAME });

    expect(await within(card("Aulas da turma")).findByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gerar aulas" })).not.toBeInTheDocument();
  });

  it("an archived class lists its lessons, but has no Gerar aulas (RN-27)", async () => {
    const onCall = vi.fn<(call: ListLessonsCall) => void>();
    server.use(
      getClassHandler({ response: buildArchivedClassDetail() }),
      listLessonsHandler({
        response: buildLessonsPage([buildLessonListItem(0)]),
        onCall,
      }),
    );
    await renderRoutes(routes, { route: CLASS_ROUTE, user: buildUser() });
    await screen.findByRole("heading", { level: 2, name: CLASS_NAME });

    expect(await within(card("Aulas da turma")).findByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Arquivada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gerar aulas" })).not.toBeInTheDocument();
    expect(onCall).toHaveBeenCalledWith({ classId: CLASS_ID, page: null, limit: 5 });
  });

  it("without lessons.view shows the class with neither the card nor the button, and asks no lessons", async () => {
    const onCall = vi.fn();
    server.use(getClassHandler(), listLessonsHandler({ onCall }));
    const user = buildUser(Role.coordinator);
    await renderRoutes(routes, {
      route: CLASS_ROUTE,
      user: {
        ...user,
        permissions: { ...user.permissions, "lessons.view": "none", "lessons.manage": "none" },
      },
    });

    expect(await screen.findByRole("heading", { level: 2, name: CLASS_NAME })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Dados da turma" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Aulas da turma" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gerar aulas" })).not.toBeInTheDocument();
    expect(onCall).not.toHaveBeenCalled();
  });

  it("keeps the class on the screen when only the lessons fail, and the card shows its own error", async () => {
    server.use(getClassHandler(), listLessonsHandler({ networkError: true }));
    await renderRoutes(routes, { route: CLASS_ROUTE, user: buildUser() });

    expect(await screen.findByText("Não foi possível carregar as aulas da turma.")).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: CLASS_NAME })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dados da turma" })).toBeInTheDocument();
    // The error of the card is the card's: the one of the class screen did not appear.
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });
});

/** The user of the allocation tests: the coordination, who has `assignments.create`, or a member, who has not. */
const buildAllocatorUser = (role: Role = Role.coordinator) => buildAllocatorUserWith({}, role);

const newAssignmentButton = () =>
  within(card(CLASS_NAME)).getByRole("button", { name: "Nova alocação" });

/** Opens the select whose name matches `trigger` and chooses the option, in the dialog that is open. */
async function pick(user: UserEvent, trigger: RegExp, option: string) {
  await user.click(screen.getByRole("button", { name: trigger }));
  await user.click(await screen.findByRole("option", { name: option }));
}

/** The text of the column Professor of "Aulas da turma", one per lesson. */
const teachersOf = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[3].textContent);

describe("+ Nova alocação, filled by the app", () => {
  it("coordinator opens Nova alocação from the class with the class fixed", async () => {
    const onLessons = vi.fn<(call: ListLessonsCall) => void>();
    server.use(
      getClassHandler(),
      listLessonsHandler({
        response: buildLessonsPage([buildLessonListItem(0)]),
        onCall: onLessons,
      }),
      listMembersHandler(),
    );
    const user = userEvent.setup();
    await renderRoutes(routes, { route: CLASS_ROUTE, user: buildAllocatorUser(Role.coordinator) });
    await screen.findByRole("heading", { name: CLASS_NAME });

    await user.click(newAssignmentButton());

    const dialog = await screen.findByRole("dialog", { name: "Nova alocação de membro" });
    expect(within(dialog).getByLabelText(/^Turma/)).toHaveValue(CLASS_NAME);
    expect(within(dialog).getByLabelText(/^Turma/)).toHaveAttribute("readonly");
    // The lessons offered are the ones of the class of the screen, and the member is to be chosen.
    await waitFor(() =>
      expect(onLessons).toHaveBeenCalledWith({ classId: CLASS_ID, page: null, limit: 100 }),
    );
    expect(within(dialog).getByRole("button", { name: /\bMembro\b/ })).toBeEnabled();
  });

  it("puts + Nova alocação in the header of the class, after + Nova aula", async () => {
    server.use(getClassHandler());
    await renderRoutes(routes, {
      route: CLASS_ROUTE,
      user: buildAllocatorUserWith({ "lessons.manage": "all" }, Role.director),
    });
    await screen.findByRole("heading", { name: CLASS_NAME });

    const header = within(card(CLASS_NAME));

    expect(header.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Gerar aulas",
      "+ Nova aula",
      "+ Nova alocação",
    ]);
    expect(newAssignmentButton()).toHaveClass("button--primary");
  });

  it("member does not see Nova alocação on the class screen", async () => {
    server.use(getClassHandler());
    await renderRoutes(routes, { route: CLASS_ROUTE, user: buildAllocatorUser(Role.member) });
    await screen.findByRole("heading", { name: CLASS_NAME });

    expect(screen.queryByRole("button", { name: /Nova alocação/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("an archived class has no + Nova alocação, even for the coordinator", async () => {
    server.use(getClassHandler({ response: buildArchivedClassDetail() }));
    await renderRoutes(routes, { route: CLASS_ROUTE, user: buildAllocatorUser(Role.coordinator) });
    await screen.findByRole("heading", { name: CLASS_NAME });

    expect(screen.queryByRole("button", { name: /Nova alocação/ })).not.toBeInTheDocument();
  });

  it("Aulas da turma shows the confirmed teacher after allocating, with no reload", async () => {
    let isAllocated = false;
    const onCreate = vi.fn<(call: CreateAssignmentCall) => void>();
    const lessons = [0, 1, 2].map((index) => buildLessonListItem(index));
    const lessonsWithTeacher = lessons.map((lesson, index) =>
      index === 0 ? { ...lesson, teacher: { id: MEMBER_ID, name: MEMBER_NAME } } : lesson,
    );
    server.use(
      getClassHandler(),
      listLessonsHandler({
        response: () => buildLessonsPage(isAllocated ? lessonsWithTeacher : lessons),
      }),
      listMembersHandler({ response: buildMembersPage([buildMemberListItem()]) }),
      createAssignmentHandler({
        onCall: (call) => {
          // From the moment the API creates the assignment, the lessons come with the teacher.
          isAllocated = true;
          onCreate(call);
        },
      }),
    );
    const user = userEvent.setup();
    const { router } = await renderRoutes(routes, {
      route: CLASS_ROUTE,
      user: buildAllocatorUser(Role.coordinator),
    });
    // `card()` is looked up on every try: the card only exists once the class is loaded.
    const table = await waitFor(() => within(card("Aulas da turma")).getByRole("table"));
    // Before: no lesson has a teacher yet, so the column shows the dash that is read as Não informado.
    expect(teachersOf(table)).toEqual(["—Não informado", "—Não informado", "—Não informado"]);

    await user.click(newAssignmentButton());
    await screen.findByRole("dialog", { name: "Nova alocação de membro" });
    await waitFor(() => {
      expect(screen.queryByText("Carregando os membros…")).not.toBeInTheDocument();
      expect(screen.queryByText("Carregando as aulas…")).not.toBeInTheDocument();
    });
    await pick(user, /\bMembro\b/, MEMBER_NAME);
    await pick(user, /\bAula\b/, "07/04 · Conhecendo o computador");
    await pick(user, /Papel na aula/, "Professor(a)");
    await user.click(screen.getByRole("button", { name: "Salvar alocação" }));

    // After: the toast, the dialog gone and the column with the teacher, on the same page.
    expect(await screen.findByText("Alocação salva")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(teachersOf(table)).toEqual(["Beatriz Nunes", "—Não informado", "—Não informado"]),
    );
    expect(within(card("Aulas da turma")).getByRole("table")).toBe(table);
    expect(router.state.location.pathname).toBe(CLASS_ROUTE);
    expect(onCreate).toHaveBeenCalledExactlyOnceWith({
      id: lessons[0].id,
      body: { personId: MEMBER_ID, role: "teacher", status: "confirmed" },
    });
  });
});
