import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LessonStatus } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { ClassLessonsCard, CLASS_LESSONS_PREVIEW_LIMIT } from "../components/ClassLessonsCard";
import {
  buildLessonListItem,
  buildLessonsPage,
  buildMeUser,
  buildMeUserWithoutLessons,
  CLASS_ID,
  listLessonsHandler,
  type ListLessonsCall,
} from "./handlers";
import {
  createDeferred,
  expectNoRequestBesidesSession,
  renderWithProviders,
  server,
  setupLessonsTestServer,
} from "./test-utils";

setupLessonsTestServer();

const TITLE = "Aulas da turma";

/** The card (the root with `data-slot="card"`) whose `<h2>` is the title. */
function card(): HTMLElement {
  const root = screen.getByRole("heading", { name: TITLE }).closest("[data-slot='card']");
  if (!(root instanceof HTMLElement)) throw new Error("No card");
  return root;
}

async function renderCard(user = buildMeUser(Role.coordinator)) {
  return renderWithProviders(<ClassLessonsCard classId={CLASS_ID} />, { user });
}

describe("ClassLessonsCard", () => {
  it("asks listLessons for the class with limit 5, once", async () => {
    const onCall = vi.fn<(call: ListLessonsCall) => void>();
    server.use(listLessonsHandler({ onCall }));
    await renderCard();
    await screen.findByText("Nenhuma aula ainda.");

    expect(CLASS_LESSONS_PREVIEW_LIMIT).toBe(5);
    expect(onCall).toHaveBeenCalledExactlyOnceWith({ classId: CLASS_ID, page: null, limit: 5 });
  });

  it("lists date, time, title, teacher dash and status of each lesson", async () => {
    server.use(
      listLessonsHandler({
        response: buildLessonsPage([
          buildLessonListItem(0),
          buildLessonListItem(1, { status: LessonStatus.confirmed }),
          buildLessonListItem(2, { status: LessonStatus.done }),
          buildLessonListItem(3, { status: LessonStatus.cancelled }),
        ]),
      }),
    );
    await renderCard();

    const table = await screen.findByRole("table", { name: "Primeiras aulas da turma" });

    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Data", "Horário", "Aula", "Professor", "Status"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(
      rows.map((row) =>
        within(row)
          .getAllByRole("cell")
          .map((cell) => cell.textContent),
      ),
    ).toEqual([
      ["07/04/2026", "09:00–11:00", "Conhecendo o computador", "—Não informado", "Planejada"],
      ["14/04/2026", "09:00–11:00", "Teclado, mouse e janelas", "—Não informado", "Confirmada"],
      ["21/04/2026", "09:00–11:00", "Navegando na internet", "—Não informado", "Realizada"],
      ["28/04/2026", "09:00–11:00", "Segurança e privacidade", "—Não informado", "Cancelada"],
    ]);
  });

  it("shows the teacher as a dash that a screen reader reads as Não informado", async () => {
    server.use(listLessonsHandler({ response: buildLessonsPage([buildLessonListItem(0)]) }));
    await renderCard();

    const row = within(await screen.findByRole("table")).getAllByRole("row")[1];
    const teacher = within(row).getAllByRole("cell")[3];

    expect(within(teacher).getByText("—")).toHaveAttribute("aria-hidden", "true");
    expect(within(teacher).getByText("Não informado")).toHaveClass("sr-only");
  });

  it("shows the name of the teacher once the allocation gives one", async () => {
    server.use(
      listLessonsHandler({
        response: buildLessonsPage([
          buildLessonListItem(0, { teacher: { id: "teacher-1", name: "Helena Barbosa" } }),
        ]),
      }),
    );
    await renderCard();

    const row = within(await screen.findByRole("table")).getAllByRole("row")[1];

    expect(within(row).getAllByRole("cell")[3]).toHaveTextContent(/^Helena Barbosa$/);
    expect(within(row).queryByText("Não informado")).not.toBeInTheDocument();
  });

  it("gives each status the tone of the lesson screens", async () => {
    server.use(
      listLessonsHandler({
        response: buildLessonsPage([
          buildLessonListItem(0, { status: LessonStatus.planned }),
          buildLessonListItem(1, { status: LessonStatus.confirmed }),
          buildLessonListItem(2, { status: LessonStatus.done }),
          buildLessonListItem(3, { status: LessonStatus.cancelled }),
        ]),
      }),
    );
    await renderCard();
    await screen.findByRole("table");

    expect(screen.getByText("Planejada")).toHaveClass("bg-tedi-neutral");
    expect(screen.getByText("Confirmada")).toHaveClass("bg-tedi-badge");
    expect(screen.getByText("Realizada")).toHaveClass("bg-tedi-badge-success");
    expect(screen.getByText("Cancelada")).toHaveClass("bg-danger-soft");
  });

  it("says there is no lesson yet, with no table and no link", async () => {
    server.use(listLessonsHandler({ response: buildLessonsPage([]) }));
    await renderCard();

    expect(await screen.findByText("Nenhuma aula ainda.")).toBeVisible();
    expect(within(card()).queryByRole("table")).not.toBeInTheDocument();
    expect(within(card()).queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows a loading state while the lessons are on their way", async () => {
    const deferred = createDeferred();
    server.use(listLessonsHandler({ delay: deferred.promise }));
    await renderCard();

    expect(await screen.findByRole("status")).toHaveTextContent("Carregando as aulas da turma…");
    expect(within(card()).queryByRole("table")).not.toBeInTheDocument();

    deferred.resolve();
    expect(await screen.findByText("Nenhuma aula ainda.")).toBeVisible();
    expect(screen.queryByText("Carregando as aulas da turma…")).not.toBeInTheDocument();
  });

  it("shows the error with Tentar de novo, which asks again", async () => {
    server.use(listLessonsHandler({ error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" } }));
    const user = userEvent.setup();
    await renderCard();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as aulas da turma.",
    );
    expect(within(card()).queryByRole("table")).not.toBeInTheDocument();

    server.use(listLessonsHandler({ response: buildLessonsPage([buildLessonListItem(0)]) }));
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the same error when the request never gets an answer", async () => {
    server.use(listLessonsHandler({ networkError: true }));
    await renderCard();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as aulas da turma.",
    );
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });

  it.each([
    ["the member", Role.member],
    ["the director", Role.director],
    ["the coordinator", Role.coordinator],
  ])("shows the lessons to %s: everybody with lessons.view sees them", async (_label, role) => {
    server.use(listLessonsHandler({ response: buildLessonsPage([buildLessonListItem(0)]) }));
    await renderCard(buildMeUser(role));

    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("without lessons.view draws nothing and asks nothing", async () => {
    const onCall = vi.fn();
    server.use(listLessonsHandler({ onCall }));
    const { container, queryClient } = await renderCard(buildMeUserWithoutLessons());

    expect(screen.queryByRole("heading", { name: TITLE })).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
    expect(onCall).not.toHaveBeenCalled();
    expectNoRequestBesidesSession(queryClient);
  });

  describe("Ver todas", () => {
    it("leads to the lessons of the class, with the total in its name", async () => {
      server.use(
        listLessonsHandler({
          response: buildLessonsPage([buildLessonListItem(0)], 12),
        }),
      );
      await renderCard();

      const link = await screen.findByRole("link", { name: "Ver todas as 12 aulas desta turma" });

      expect(link).toHaveAttribute("href", `/lessons?classId=${CLASS_ID}`);
      expect(link).toHaveTextContent("Ver todas as 12");
      expect(link).toHaveClass("min-h-11");
    });

    it("says the single lesson in the singular", async () => {
      server.use(listLessonsHandler({ response: buildLessonsPage([buildLessonListItem(0)], 1) }));
      await renderCard();

      const link = await screen.findByRole("link", { name: "Ver a 1 aula desta turma" });

      expect(link).toHaveTextContent("Ver a 1 aula");
    });

    it("goes to the lessons screen when pressed", async () => {
      server.use(listLessonsHandler({ response: buildLessonsPage([buildLessonListItem(0)], 3) }));
      const user = userEvent.setup();
      const { router } = await renderCard();

      await user.click(await screen.findByRole("link", { name: /Ver todas as 3 aulas/ }));

      expect(router.state.location.pathname).toBe("/lessons");
      expect(router.state.location.search).toBe(`?classId=${CLASS_ID}`);
    });

    it("is not there while there is nothing to see", async () => {
      server.use(listLessonsHandler({ response: buildLessonsPage([]) }));
      await renderCard();
      await screen.findByText("Nenhuma aula ainda.");

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });
  });

  it("is a card of the screen of the class, with its title as a heading of level 2", async () => {
    server.use(listLessonsHandler());
    await renderCard();

    expect(await screen.findByRole("heading", { level: 2, name: TITLE })).toBeInTheDocument();
  });
});
