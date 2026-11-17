import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssignmentRole, AssignmentStatus } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { MyLessonsPage } from "../pages/MyLessonsPage";
import {
  buildAssignmentLesson,
  buildCoverage,
  buildDefaultOpenLessons,
  buildMeUser,
  buildMyAssignment,
  buildMyAssignments,
  buildOpenLesson,
  createApplicationsBackend,
  LESSON_IDS,
  listMyAssignmentsHandler,
  listOpenLessonsHandler,
  listPendingApplicationsHandler,
  type PeriodCall,
  type PendingApplicationsCall,
} from "./handlers";
import {
  createDeferred,
  expectNoRequestTo,
  renderWithProviders,
  server,
  setupAssignmentsTestServer,
} from "./test-utils";

setupAssignmentsTestServer();

// The Figma, unless a test says another one: registered first, so a handler a test adds later wins.
beforeEach(() => {
  server.use(
    listMyAssignmentsHandler(),
    listOpenLessonsHandler(),
    listPendingApplicationsHandler(),
  );
});

const UPCOMING_TABLE = "Suas próximas aulas, com data, horário, turma, aula, papel e situação";
const OPEN_TABLE =
  "Aulas com vaga para candidatura, com data, horário, turma, aula, vagas e o botão Candidatar-se";

const upcomingTable = () => screen.getByRole("table", { name: UPCOMING_TABLE });
const openTable = () => screen.getByRole("table", { name: OPEN_TABLE });
const summary = () => screen.getByRole("region", { name: "Resumo das suas aulas" });
const cellsOf = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    );
const tiles = () =>
  within(summary())
    .getAllByRole("listitem")
    .map((tile) => tile.textContent);
/** A role of the dialog: the table behind it has the same words, so it is looked up inside it. */
const roleOption = (name: string) =>
  within(screen.getByRole("dialog", { name: "Candidatar-se à aula" })).getByText(name);
const applyButton = (lesson: string, day: string) =>
  screen.getByRole("button", { name: `Candidatar-se à ${lesson}, ${day}` });

async function renderPage(role: Role = Role.member) {
  const view = await renderWithProviders(<MyLessonsPage />, { user: buildMeUser(role) });
  await screen.findByRole("table", { name: UPCOMING_TABLE });
  await screen.findByRole("table", { name: OPEN_TABLE });
  return view;
}

describe("MyLessonsPage", () => {
  describe("the reads", () => {
    it("asks GET /me/assignments and GET /me/open-lessons once each, with no period", async () => {
      const agenda = vi.fn<(call: PeriodCall) => void>();
      const open = vi.fn<(call: PeriodCall) => void>();
      server.use(
        listMyAssignmentsHandler({ onCall: agenda }),
        listOpenLessonsHandler({ onCall: open }),
      );

      await renderPage();

      expect(agenda).toHaveBeenCalledExactlyOnceWith({ from: null, to: null });
      expect(open).toHaveBeenCalledExactlyOnceWith({ from: null, to: null });
    });

    it("has no title of its own: the title is the one of the topbar", async () => {
      await renderPage();

      expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    });
  });

  describe("the numbers", () => {
    it("shows the four totals of the agenda, in the order of the Figma", async () => {
      await renderPage();

      expect(tiles()).toEqual([
        "Próximas aulas (4 semanas)3",
        "Confirmadas2",
        "Aguardando confirmação1",
        "Aulas com vaga para você3",
      ]);
    });

    it("gives each number its color: white, green, yellow and blue", async () => {
      await renderPage();

      const [upcoming, confirmed, pending, open] = within(summary()).getAllByRole("listitem");
      expect(upcoming).toHaveClass("bg-surface");
      expect(confirmed).toHaveClass("bg-tedi-badge-success", "text-tedi-badge-success-foreground");
      expect(pending).toHaveClass("bg-tedi-warning", "text-tedi-warning-foreground");
      expect(open).toHaveClass("bg-tedi-badge", "text-tedi-badge-foreground");
    });

    it("writes the number big and the label in 16px", async () => {
      await renderPage();

      expect(within(summary()).getByText("Confirmadas")).toHaveClass("text-base");
      expect(within(summary()).getByText("2")).toHaveClass("text-3xl", "font-bold");
    });

    it("shows zeros as numbers, not as missing", async () => {
      server.use(
        listMyAssignmentsHandler({
          response: buildMyAssignments([], { openLessons: 0 }),
        }),
        listOpenLessonsHandler({ response: [] }),
      );
      await renderWithProviders(<MyLessonsPage />);
      await screen.findByText("Nenhuma aula com vaga para você nas próximas 4 semanas.");

      expect(tiles()).toEqual([
        "Próximas aulas (4 semanas)0",
        "Confirmadas0",
        "Aguardando confirmação0",
        "Aulas com vaga para você0",
      ]);
    });

    it("shows skeletons for the numbers while they load, with the label read as a status", async () => {
      const deferred = createDeferred();
      server.use(listMyAssignmentsHandler({ delay: deferred.promise }));
      await renderWithProviders(<MyLessonsPage />);

      expect(await screen.findByText("Carregando o resumo das suas aulas…")).toHaveClass("sr-only");
      expect(within(summary()).getAllByRole("listitem")).toHaveLength(4);
      expect(summary().querySelectorAll(".skeleton")).toHaveLength(4);

      deferred.resolve();
      await waitFor(() => expect(tiles()[0]).toBe("Próximas aulas (4 semanas)3"));
    });

    it("shows a dash read as Não informado when the agenda cannot be read", async () => {
      server.use(listMyAssignmentsHandler({ networkError: true }));
      await renderWithProviders(<MyLessonsPage />);
      await screen.findByText("Não foi possível carregar as suas próximas aulas.");

      for (const tile of within(summary()).getAllByRole("listitem")) {
        expect(within(tile).getByText("—")).toHaveAttribute("aria-hidden", "true");
        expect(within(tile).getByText("Não informado")).toHaveClass("sr-only");
      }
    });
  });

  describe("Minhas próximas aulas", () => {
    it("has the six columns of the Figma", async () => {
      await renderPage();

      expect(
        within(upcomingTable())
          .getAllByRole("columnheader")
          .map((header) => header.textContent),
      ).toEqual(["Data", "Horário", "Turma", "Aula", "Papel", "Situação"]);
      expect(screen.getByRole("heading", { name: "Minhas próximas aulas" })).toBeInTheDocument();
    });

    it("lists the lessons of the member with day, time, class, lesson, role and status", async () => {
      await renderPage();

      expect(cellsOf(upcomingTable())).toEqual([
        [
          "17/03 (ter)",
          "09:00–11:00",
          "Informática Básica — A",
          "Aula 3 · Arquivos e pastas",
          "Professor(a)",
          "Confirmada",
        ],
        [
          "19/03 (qui)",
          "14:00–16:00",
          "Redes Sociais — C",
          "Aula 4 · Privacidade no Facebook",
          "Monitor(a)",
          "Confirmada",
        ],
        [
          "26/03 (qui)",
          "14:00–16:00",
          "Smartphones no dia a dia — B",
          "Aula 5 · Chamadas de vídeo",
          "Monitor(a)",
          "Aguardando confirmação",
        ],
      ]);
    });

    it("gives each status its tag: green, yellow, red and quiet", async () => {
      server.use(
        listMyAssignmentsHandler({
          response: buildMyAssignments([
            buildMyAssignment(0, { status: AssignmentStatus.confirmed }),
            buildMyAssignment(1, { status: AssignmentStatus.pending }),
            buildMyAssignment(2, { status: AssignmentStatus.declined }),
            buildMyAssignment(3, { status: AssignmentStatus.cancelled }),
          ]),
        }),
      );
      await renderPage();

      const table = within(upcomingTable());
      expect(table.getByText("Confirmada")).toHaveClass("bg-tedi-badge-success");
      expect(table.getByText("Aguardando confirmação")).toHaveClass("bg-tedi-warning");
      expect(table.getByText("Recusada")).toHaveClass("bg-danger-soft");
      expect(table.getByText("Cancelada")).toHaveClass("bg-tedi-neutral");
    });

    it("lists a declined assignment too, with its tag, so the member sees what happened to it", async () => {
      server.use(
        listMyAssignmentsHandler({
          response: buildMyAssignments([
            buildMyAssignment(0, { role: AssignmentRole.teacher }),
            buildMyAssignment(1, { status: AssignmentStatus.declined }),
          ]),
        }),
      );
      await renderPage();

      expect(cellsOf(upcomingTable()).map((cells) => cells.at(-1))).toEqual([
        "Confirmada",
        "Recusada",
      ]);
      // Neither a declined nor a cancelled assignment is in a total.
      expect(tiles().slice(0, 3)).toEqual([
        "Próximas aulas (4 semanas)1",
        "Confirmadas1",
        "Aguardando confirmação0",
      ]);
    });

    it("shows only the title of a lesson that has no place in a sequence", async () => {
      server.use(
        listMyAssignmentsHandler({
          response: buildMyAssignments([
            buildMyAssignment(0, {
              lesson: buildAssignmentLesson(0, { sequenceOrder: null, title: "Aula de revisão" }),
            }),
          ]),
        }),
      );
      await renderPage();

      expect(cellsOf(upcomingTable())[0][3]).toBe("Aula de revisão");
    });

    it("says what the list is and links to the calendar of lessons, with the arrow as decoration", async () => {
      await renderPage();

      expect(
        screen.getByText(
          "Aulas em que você está alocado(a) ou se candidatou, nas próximas 4 semanas",
        ),
      ).toBeInTheDocument();
      const link = screen.getByRole("link", { name: "Ver calendário" });
      expect(link).toHaveAttribute("href", "/lessons/calendar");
      expect(link).toHaveClass("min-h-11");
      expect(within(link).getByText("›")).toHaveAttribute("aria-hidden", "true");
    });

    it("says there is nothing, with the link to the calendar still there", async () => {
      server.use(
        listMyAssignmentsHandler({ response: buildMyAssignments([], { openLessons: 3 }) }),
      );
      await renderWithProviders(<MyLessonsPage />);

      expect(
        await screen.findByText(
          "Você não está alocado(a) nem se candidatou a nenhuma aula nas próximas 4 semanas.",
        ),
      ).toBeVisible();
      expect(screen.queryByRole("table", { name: UPCOMING_TABLE })).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Ver calendário" })).toBeInTheDocument();
    });

    it("shows a loading state while the agenda is on its way", async () => {
      const deferred = createDeferred();
      server.use(listMyAssignmentsHandler({ delay: deferred.promise }));
      await renderWithProviders(<MyLessonsPage />);

      expect(await screen.findByText("Carregando as suas próximas aulas…")).toHaveClass("sr-only");
      expect(screen.queryByRole("table", { name: UPCOMING_TABLE })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Ver calendário" })).not.toBeInTheDocument();

      deferred.resolve();
      expect(await screen.findByRole("table", { name: UPCOMING_TABLE })).toBeInTheDocument();
    });

    it("shows the error with Tentar de novo, and the next attempt shows the agenda and the numbers", async () => {
      server.use(listMyAssignmentsHandler({ networkError: true }));
      const user = userEvent.setup();
      await renderWithProviders(<MyLessonsPage />);

      expect(
        await screen.findByText("Não foi possível carregar as suas próximas aulas."),
      ).toBeInTheDocument();
      expect(screen.queryByRole("table", { name: UPCOMING_TABLE })).not.toBeInTheDocument();

      server.use(listMyAssignmentsHandler());
      await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

      expect(await screen.findByRole("table", { name: UPCOMING_TABLE })).toBeInTheDocument();
      expect(tiles()[0]).toBe("Próximas aulas (4 semanas)3");
    });
  });

  describe("Aulas com vaga para candidatura", () => {
    it("has the six columns of the Figma and the number of lessons in the title", async () => {
      await renderPage();

      expect(
        within(openTable())
          .getAllByRole("columnheader")
          .map((header) => header.textContent),
      ).toEqual(["Data", "Horário", "Turma", "Aula", "Vagas", "Ações"]);
      expect(
        screen.getByRole("heading", { name: "Aulas com vaga para candidatura (3)" }),
      ).toBeInTheDocument();
    });

    it("lists the lessons with the vacancies, with the teacher only while the lesson has none, and Candidatar-se", async () => {
      await renderPage();

      expect(cellsOf(openTable())).toEqual([
        [
          "31/03 (ter)",
          "09:00–11:00",
          "Informática Básica — A",
          "Aula 5 · E-mail do zero",
          "Professor(a) 0 de 1 · Monitores 2 de 3",
          "Candidatar-se",
        ],
        [
          "02/04 (qui)",
          "14:00–16:00",
          "Redes Sociais — C",
          "Aula 6 · Golpes e segurança",
          "Monitores 0 de 2",
          "Candidatar-se",
        ],
        [
          "07/04 (ter)",
          "09:00–11:00",
          "Informática Básica — A",
          "Aula 6 · Compras on-line",
          "Monitores 1 de 3",
          "Candidatar-se",
        ],
      ]);
    });

    it("names each button by the lesson and the day, keeps the visible text in the name and a 44px target", async () => {
      await renderPage();

      const button = applyButton("Aula 5 · E-mail do zero", "31/03 (ter)");
      expect(button).toHaveTextContent(/^Candidatar-se$/);
      expect(button).toHaveClass("button--primary", "min-h-11");
      expect(applyButton("Aula 6 · Golpes e segurança", "02/04 (qui)")).toBeInTheDocument();
      expect(applyButton("Aula 6 · Compras on-line", "07/04 (ter)")).toBeInTheDocument();
    });

    it("says Equipe completa when only a vacancy that is not counted is left", async () => {
      server.use(
        listOpenLessonsHandler({
          response: [
            buildOpenLesson(3, {
              coverage: buildCoverage({
                teacher: { confirmed: 1 },
                monitors: { confirmed: 0, expected: null },
              }),
            }),
          ],
        }),
      );
      await renderPage();

      expect(cellsOf(openTable())[0][4]).toBe("Equipe completa");
    });

    it("says there is no lesson with a vacancy", async () => {
      server.use(listOpenLessonsHandler({ response: [] }));
      await renderWithProviders(<MyLessonsPage />);

      expect(
        await screen.findByText("Nenhuma aula com vaga para você nas próximas 4 semanas."),
      ).toBeVisible();
      expect(
        screen.getByRole("heading", { name: "Aulas com vaga para candidatura (0)" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("table", { name: OPEN_TABLE })).not.toBeInTheDocument();
    });

    it("shows a loading state, with the title without a number, while the lessons are on their way", async () => {
      const deferred = createDeferred();
      server.use(listOpenLessonsHandler({ delay: deferred.promise }));
      await renderWithProviders(<MyLessonsPage />);

      expect(await screen.findByText("Carregando as aulas com vaga…")).toHaveClass("sr-only");
      expect(
        screen.getByRole("heading", { name: "Aulas com vaga para candidatura" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("table", { name: OPEN_TABLE })).not.toBeInTheDocument();

      deferred.resolve();
      expect(await screen.findByRole("table", { name: OPEN_TABLE })).toBeInTheDocument();
    });

    it("shows the error with Tentar de novo, and the next attempt shows the lessons", async () => {
      server.use(listOpenLessonsHandler({ networkError: true }));
      const user = userEvent.setup();
      await renderWithProviders(<MyLessonsPage />);

      expect(
        await screen.findByText("Não foi possível carregar as aulas com vaga."),
      ).toBeInTheDocument();
      // The agenda is a card of its own: its failure is not this one's.
      expect(await screen.findByRole("table", { name: UPCOMING_TABLE })).toBeInTheDocument();

      server.use(listOpenLessonsHandler());
      await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

      expect(await screen.findByRole("table", { name: OPEN_TABLE })).toBeInTheDocument();
    });
  });

  describe("Candidatar-se", () => {
    it("opens the dialog of the lesson of that row", async () => {
      const user = userEvent.setup();
      await renderPage();

      await user.click(applyButton("Aula 6 · Golpes e segurança", "02/04 (qui)"));

      const dialog = await screen.findByRole("dialog", { name: "Candidatar-se à aula" });
      expect(within(dialog).getByText("Aula 6 · Golpes e segurança")).toBeInTheDocument();
      expect(
        within(dialog).getByText("Redes Sociais — C · 02/04 (qui) · 14:00–16:00"),
      ).toBeInTheDocument();
      expect(within(dialog).getByText("Vagas: Monitores 0 de 2")).toBeInTheDocument();
      // That lesson only has a place for a monitor: it is the role that comes chosen.
      expect(within(dialog).getByRole("radio", { name: "Professor(a)" })).toBeDisabled();
      expect(within(dialog).getByRole("radio", { name: "Monitor(a)" })).toBeChecked();
    });

    it("opens the dialog of the other lesson when another button is pressed", async () => {
      const user = userEvent.setup();
      await renderPage();

      await user.click(applyButton("Aula 5 · E-mail do zero", "31/03 (ter)"));

      const dialog = await screen.findByRole("dialog", { name: "Candidatar-se à aula" });
      expect(
        within(dialog).getByText("Vagas: Professor(a) 0 de 1 · Monitores 2 de 3"),
      ).toBeInTheDocument();
      expect(within(dialog).getByRole("radio", { name: "Professor(a)" })).toBeEnabled();
      expect(within(dialog).getByRole("radio", { name: "Monitor(a)" })).toBeEnabled();
    });

    it("gives the focus back to the button when Voltar closes the dialog", async () => {
      const user = userEvent.setup();
      await renderPage();
      const button = applyButton("Aula 5 · E-mail do zero", "31/03 (ter)");
      await user.click(button);
      const dialog = await screen.findByRole("dialog", { name: "Candidatar-se à aula" });

      await user.click(within(dialog).getByRole("button", { name: "Voltar" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() => expect(button).toHaveFocus());
    });

    it("gives the focus back to the button when Esc closes the dialog", async () => {
      const user = userEvent.setup();
      await renderPage();
      const button = applyButton("Aula 6 · Compras on-line", "07/04 (ter)");
      await user.click(button);
      await screen.findByRole("dialog", { name: "Candidatar-se à aula" });

      await user.keyboard("{Escape}");

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() => expect(button).toHaveFocus());
    });

    it("opens a fresh dialog each time: what was typed before Voltar is not kept", async () => {
      const user = userEvent.setup();
      await renderPage();
      await user.click(applyButton("Aula 5 · E-mail do zero", "31/03 (ter)"));
      await screen.findByRole("dialog", { name: "Candidatar-se à aula" });
      await user.click(roleOption("Monitor(a)"));
      await user.type(
        screen.getByRole("textbox", { name: "Observação para quem vai aprovar" }),
        "Posso chegar mais cedo.",
      );
      await user.click(screen.getByRole("button", { name: "Voltar" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      await user.click(applyButton("Aula 5 · E-mail do zero", "31/03 (ter)"));

      await screen.findByRole("dialog", { name: "Candidatar-se à aula" });
      expect(screen.getByRole("radio", { name: "Monitor(a)" })).not.toBeChecked();
      expect(screen.getByRole("textbox", { name: "Observação para quem vai aprovar" })).toHaveValue(
        "",
      );
    });
  });

  describe("after applying", () => {
    it("moves the lesson from the lessons with a vacancy to Minhas próximas aulas as Aguardando confirmação, and the numbers follow", async () => {
      const backend = createApplicationsBackend();
      server.use(...backend.handlers);
      const user = userEvent.setup();
      await renderPage();
      expect(tiles()).toEqual([
        "Próximas aulas (4 semanas)3",
        "Confirmadas2",
        "Aguardando confirmação1",
        "Aulas com vaga para você3",
      ]);
      expect(cellsOf(upcomingTable())).toHaveLength(3);
      expect(cellsOf(openTable())).toHaveLength(3);

      await user.click(applyButton("Aula 5 · E-mail do zero", "31/03 (ter)"));
      await screen.findByRole("dialog", { name: "Candidatar-se à aula" });
      await user.click(roleOption("Monitor(a)"));
      await user.click(screen.getByRole("button", { name: "Enviar candidatura" }));

      expect(await screen.findByText("Candidatura enviada")).toBeInTheDocument();
      expect(
        await screen.findByRole("heading", { name: "Aulas com vaga para candidatura (2)" }),
      ).toBeInTheDocument();
      await waitFor(() => expect(cellsOf(upcomingTable())).toHaveLength(4));

      // It left the lessons with a vacancy...
      expect(cellsOf(openTable()).map((cells) => cells[3])).toEqual([
        "Aula 6 · Golpes e segurança",
        "Aula 6 · Compras on-line",
      ]);
      // ...and entered Minhas próximas aulas, waiting for confirmation, in its place by date.
      expect(cellsOf(upcomingTable()).at(-1)).toEqual([
        "31/03 (ter)",
        "09:00–11:00",
        "Informática Básica — A",
        "Aula 5 · E-mail do zero",
        "Monitor(a)",
        "Aguardando confirmação",
      ]);
      expect(tiles()).toEqual([
        "Próximas aulas (4 semanas)4",
        "Confirmadas2",
        "Aguardando confirmação2",
        "Aulas com vaga para você2",
      ]);
      expect(backend.calls.applied).toEqual([
        { id: LESSON_IDS[3], body: { role: "monitor", note: null } },
      ]);
    });

    it("sends the role and the note the person chose, and the lesson comes in with that role", async () => {
      const backend = createApplicationsBackend();
      server.use(...backend.handlers);
      const user = userEvent.setup();
      await renderPage();

      await user.click(applyButton("Aula 5 · E-mail do zero", "31/03 (ter)"));
      await screen.findByRole("dialog", { name: "Candidatar-se à aula" });
      await user.click(roleOption("Professor(a)"));
      await user.type(
        screen.getByRole("textbox", { name: "Observação para quem vai aprovar" }),
        "Posso chegar 15 min antes.",
      );
      await user.click(screen.getByRole("button", { name: "Enviar candidatura" }));

      await waitFor(() => expect(cellsOf(upcomingTable())).toHaveLength(4));
      expect(backend.calls.applied).toEqual([
        { id: LESSON_IDS[3], body: { role: "teacher", note: "Posso chegar 15 min antes." } },
      ]);
      expect(cellsOf(upcomingTable()).at(-1)?.slice(4)).toEqual([
        "Professor(a)",
        "Aguardando confirmação",
      ]);
    });

    it("takes the focus to the card of the lessons with a vacancy, since the button that opened the dialog is gone", async () => {
      server.use(...createApplicationsBackend().handlers);
      const user = userEvent.setup();
      await renderPage();

      await user.click(applyButton("Aula 5 · E-mail do zero", "31/03 (ter)"));
      await screen.findByRole("dialog", { name: "Candidatar-se à aula" });
      await user.click(roleOption("Monitor(a)"));
      await user.click(screen.getByRole("button", { name: "Enviar candidatura" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() =>
        expect(
          screen.getByRole("region", { name: "Aulas com vaga para candidatura" }),
        ).toHaveFocus(),
      );
      // And it stays there when the list is read again and the row goes away.
      await screen.findByRole("heading", { name: "Aulas com vaga para candidatura (2)" });
      expect(screen.getByRole("region", { name: "Aulas com vaga para candidatura" })).toHaveFocus();
    });

    it("applies to the next lesson the same way, and the page keeps working", async () => {
      const backend = createApplicationsBackend();
      server.use(...backend.handlers);
      const user = userEvent.setup();
      await renderPage();

      await user.click(applyButton("Aula 5 · E-mail do zero", "31/03 (ter)"));
      await screen.findByRole("dialog", { name: "Candidatar-se à aula" });
      await user.click(roleOption("Monitor(a)"));
      await user.click(screen.getByRole("button", { name: "Enviar candidatura" }));
      await screen.findByRole("heading", { name: "Aulas com vaga para candidatura (2)" });
      await user.click(applyButton("Aula 6 · Compras on-line", "07/04 (ter)"));
      await user.click(await screen.findByRole("button", { name: "Enviar candidatura" }));

      await screen.findByRole("heading", { name: "Aulas com vaga para candidatura (1)" });
      await waitFor(() => expect(cellsOf(upcomingTable())).toHaveLength(5));
      expect(backend.calls.applied.map((call) => call.id)).toEqual([LESSON_IDS[3], LESSON_IDS[5]]);
      expect(tiles()[2]).toBe("Aguardando confirmação3");
    });
  });

  describe("Candidaturas pendentes", () => {
    it("the member does not see it, and the queue is not asked", async () => {
      const onCall = vi.fn<(call: PendingApplicationsCall) => void>();
      server.use(listPendingApplicationsHandler({ onCall }));

      const { queryClient } = await renderPage(Role.member);

      expect(
        screen.queryByRole("button", { name: /Candidaturas pendentes/ }),
      ).not.toBeInTheDocument();
      expectNoRequestTo(queryClient, "/applications");
      expect(onCall).not.toHaveBeenCalled();
    });

    it.each([
      ["director", Role.director],
      ["coordinator", Role.coordinator],
    ])(
      "the %s sees Candidaturas pendentes (3) at the top and opens the queue",
      async (_label, role) => {
        const user = userEvent.setup();
        await renderPage(role);

        const button = await screen.findByRole("button", { name: "Candidaturas pendentes (3)" });
        await user.click(button);

        expect(
          await screen.findByRole("dialog", { name: "Candidaturas pendentes (3)" }),
        ).toBeInTheDocument();
      },
    );

    it("keeps the agenda of who reviews, too: it is for every profile", async () => {
      await renderPage(Role.coordinator);

      expect(cellsOf(upcomingTable())).toHaveLength(3);
      expect(cellsOf(openTable())).toHaveLength(3);
    });

    it("takes no room at the top for a member: the button is the only thing in that row", async () => {
      await renderPage(Role.member);

      const row = summary().previousElementSibling;
      expect(row).toHaveClass("empty:hidden");
      expect(row).toBeEmptyDOMElement();
    });
  });

  describe("the lessons with a vacancy of the Figma", () => {
    it("is the default of the handlers: three lessons, and the first has both roles open", () => {
      const lessons = buildDefaultOpenLessons();

      expect(lessons.map((openLesson) => openLesson.openRoles)).toEqual([
        ["teacher", "monitor"],
        ["monitor"],
        ["monitor"],
      ]);
    });
  });
});
