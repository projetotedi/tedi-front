import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { MeResponseDto } from "@api/generated/model";
import { createClassesRoutes } from "@modules/classes";
import {
  buildArchivedClassDetail,
  buildClassDetail,
  buildClassSummary,
  buildMeUser,
  CLASS_ID,
  CLASS_NAME,
  getClassHandler,
  getCourseHandler,
  listCourseClassesHandler,
} from "@modules/classes/__tests__/handlers";
import {
  buildGeneratedLessons,
  buildLessonListItem,
  buildLessonsPage,
  buildPreviewFor,
  generateClassLessonsHandler,
  listLessonsHandler,
  previewClassLessonsHandler,
  type ListLessonsCall,
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

/** The period of the class of the `classes` handlers: the preview has to judge the lessons by it. */
const CLASS_PERIOD = { classStartDate: "2026-03-03", classEndDate: "2026-06-27" };

/** The user of the classes tests, who can also see the lessons, and manage them unless a member. */
function buildUser(role: Role = Role.coordinator): MeResponseDto {
  const user = buildMeUser(role);
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

function useClassHandlers() {
  server.use(getCourseHandler(), listCourseClassesHandler());
}

const card = (name: string): HTMLElement => {
  const root = screen.getByRole("heading", { level: 2, name }).closest("[data-slot='card']");
  if (!(root instanceof HTMLElement)) throw new Error(`No card titled "${name}"`);
  return root;
};

describe("the slots of the classes, filled by the app", () => {
  it("puts Gerar aulas in the header and Aulas da turma among the cards", async () => {
    useClassHandlers();
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
    useClassHandlers();
    const onCall = vi.fn<(call: ListLessonsCall) => void>();
    server.use(getClassHandler(), listLessonsHandler({ onCall }));
    await renderRoutes(routes, { route: CLASS_ROUTE, user: buildUser() });
    await screen.findByText("Nenhuma aula ainda.");

    expect(onCall).toHaveBeenCalledExactlyOnceWith({ classId: CLASS_ID, page: null, limit: 5 });
  });

  it("after generating, Aulas da turma lists the lessons with no reload", async () => {
    useClassHandlers();
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
    useClassHandlers();
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
    useClassHandlers();
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
    useClassHandlers();
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
    useClassHandlers();
    server.use(getClassHandler(), listLessonsHandler({ networkError: true }));
    await renderRoutes(routes, { route: CLASS_ROUTE, user: buildUser() });

    expect(await screen.findByText("Não foi possível carregar as aulas da turma.")).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: CLASS_NAME })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dados da turma" })).toBeInTheDocument();
    // The error of the card is the card's: the one of the class screen did not appear.
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });
});
