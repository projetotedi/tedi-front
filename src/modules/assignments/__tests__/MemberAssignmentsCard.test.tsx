import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  getListLessonAssignmentsQueryKey,
  getListMemberAssignmentsQueryKey,
} from "@api/generated/assignments/assignments";
import { getGetLessonQueryKey } from "@api/generated/lessons/lessons";
import {
  AssignmentRole,
  AssignmentSource,
  AssignmentStatus,
  LessonStatus,
} from "@api/generated/model";
import { Role } from "@shared/lib/role";

import {
  MEMBER_ASSIGNMENTS_PREVIEW_LIMIT,
  MemberAssignmentsCard,
} from "../components/MemberAssignmentsCard";
import ptBR from "../locales/pt-BR.json";
import {
  ASSIGNMENT_ID,
  ASSIGNMENT_NOT_ACTIVE_ERROR,
  ASSIGNMENT_NOT_FOUND_ERROR,
  buildLessonAssignment,
  buildMeUser,
  buildMeUserWith,
  buildMemberAssignment,
  cancelAssignmentHandler,
  FORBIDDEN_SCOPE_ERROR,
  LESSON_ID,
  listMemberAssignmentsHandler,
  MEMBER_ID,
  OTHER_ASSIGNMENT_ID,
  OTHER_LESSON_ID,
  SERVER_ERROR,
  THIRD_LESSON_ID,
  type IdCall,
} from "./handlers";
import {
  createDeferred,
  expectNoRequestBesidesSession,
  renderWithProviders,
  server,
  setupAssignmentsTestServer,
} from "./test-utils";

setupAssignmentsTestServer();

const TITLE = "Alocações em aulas";
const THIRD_ASSIGNMENT_ID = "01952ef7-0000-7000-8000-0000000000a3";
const CANCEL_SENHAS = "Cancelar a alocação em Senhas e privacidade de 24/03";

const lessonRef = (id: string, title: string, date: string) => ({
  id,
  title,
  date,
  startTime: "09:00",
  endTime: "11:00",
  status: LessonStatus.planned,
});

// The member of the Figma: the three assignments of her sheet, the latest lesson first as the API
// gives them. The last one came from an application that waits for an answer: "Inscrita".
const SENHAS = buildMemberAssignment({
  id: ASSIGNMENT_ID,
  lesson: lessonRef(LESSON_ID, "Senhas e privacidade", "2026-03-24"),
  role: AssignmentRole.monitor,
  status: AssignmentStatus.pending,
  source: AssignmentSource.application,
});
const TECLADO = buildMemberAssignment({
  id: OTHER_ASSIGNMENT_ID,
  lesson: lessonRef(OTHER_LESSON_ID, "Teclado, mouse e janelas", "2026-03-10"),
});
const CONHECENDO = buildMemberAssignment({
  id: THIRD_ASSIGNMENT_ID,
  lesson: lessonRef(THIRD_LESSON_ID, "Conhecendo o computador", "2026-03-03"),
});
const FIGMA_ROWS = [SENHAS, TECLADO, CONHECENDO];

/** The card (the root with `data-slot="card"`) whose `<h2>` is the title. */
function card(): HTMLElement {
  const root = screen.getByRole("heading", { name: TITLE }).closest("[data-slot='card']");
  if (!(root instanceof HTMLElement)) throw new Error("No card");
  return root;
}

const findTable = () => screen.findByRole("table", { name: "Alocações do membro em aulas" });
const region = () => screen.getByRole("region", { name: TITLE });

/** The cells of each row of the table, as text, header left out. */
function cellsOf(table: HTMLElement): string[][] {
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent ?? ""),
    );
}

const rowOf = (table: HTMLElement, title: string) =>
  within(table).getByText(title).closest("tr") as HTMLElement;

async function renderCard(user = buildMeUser(Role.coordinator)) {
  return renderWithProviders(<MemberAssignmentsCard memberId={MEMBER_ID} />, { user });
}

describe("MemberAssignmentsCard", () => {
  describe("the list", () => {
    it("lists lesson, date, role and status of each assignment, with the actions for who can assign", async () => {
      server.use(listMemberAssignmentsHandler({ response: FIGMA_ROWS }));
      await renderCard();

      const table = await findTable();

      expect(
        within(table)
          .getAllByRole("columnheader")
          .map((header) => header.textContent),
      ).toEqual(["Aula", "Data", "Papel", "Status", "Ações"]);
      expect(cellsOf(table)).toEqual([
        ["Senhas e privacidade", "24/03", "Monitor(a)", "Inscrita", ""],
        ["Teclado, mouse e janelas", "10/03", "Professor(a)", "Confirmada", ""],
        ["Conhecendo o computador", "03/03", "Professor(a)", "Confirmada", ""],
      ]);
    });

    it("is a card with its title as a heading of level 2, and has no column of the class (F7)", async () => {
      server.use(listMemberAssignmentsHandler({ response: FIGMA_ROWS }));
      await renderCard();
      await findTable();

      expect(screen.getByRole("heading", { level: 2, name: TITLE })).toBeInTheDocument();
      expect(screen.queryByRole("columnheader", { name: "Turma" })).not.toBeInTheDocument();
    });

    it("names the region of the table by the title of the card, and not by a copy of its text", async () => {
      server.use(listMemberAssignmentsHandler({ response: FIGMA_ROWS }));
      await renderCard();
      await findTable();

      const labelId = region().getAttribute("aria-labelledby");

      expect(labelId).not.toBeNull();
      // The element that names the region is inside the heading of the card, so the name is its text.
      const heading = screen.getByRole("heading", { level: 2, name: TITLE });
      expect(heading.querySelector(`[id="${labelId}"]`)).not.toBeNull();
      expect(region()).not.toHaveAttribute("aria-label");
    });

    it("asks the assignments of the member, once", async () => {
      const onCall = vi.fn<(call: IdCall) => void>();
      server.use(listMemberAssignmentsHandler({ response: FIGMA_ROWS, onCall }));
      await renderCard();
      await findTable();

      expect(onCall).toHaveBeenCalledExactlyOnceWith({ id: MEMBER_ID });
    });

    it("gives the role and the status the tones of the screens: teacher blue, monitor purple, and by status", async () => {
      const decided = (id: string, status: AssignmentStatus, title: string) =>
        buildMemberAssignment({ id, status, lesson: lessonRef(id, title, "2026-03-05") });
      server.use(
        listMemberAssignmentsHandler({
          response: [
            SENHAS,
            TECLADO,
            decided(
              "01952ef7-0000-7000-8000-0000000000a6",
              AssignmentStatus.declined,
              "Aula recusada",
            ),
            decided(
              "01952ef7-0000-7000-8000-0000000000a7",
              AssignmentStatus.cancelled,
              "Aula cancelada",
            ),
          ],
        }),
      );
      await renderCard();
      const table = await findTable();

      const senhas = rowOf(table, "Senhas e privacidade");
      expect(within(senhas).getByText("Monitor(a)")).toHaveClass("bg-tedi-highlight");
      expect(within(senhas).getByText("Inscrita")).toHaveClass("bg-tedi-warning");
      const teclado = rowOf(table, "Teclado, mouse e janelas");
      expect(within(teclado).getByText("Professor(a)")).toHaveClass("bg-tedi-badge");
      expect(within(teclado).getByText("Confirmada")).toHaveClass("bg-tedi-badge-success");
      expect(within(rowOf(table, "Aula recusada")).getByText("Recusada")).toHaveClass(
        "bg-danger-soft",
      );
      expect(within(rowOf(table, "Aula cancelada")).getByText("Cancelada")).toHaveClass(
        "bg-tedi-neutral",
      );
    });

    it("says Pendente for a pending assignment that a coordinator made, and Inscrita only for an application", async () => {
      server.use(
        listMemberAssignmentsHandler({
          response: [
            buildMemberAssignment({
              id: OTHER_ASSIGNMENT_ID,
              lesson: lessonRef(OTHER_LESSON_ID, "Feita pela coordenação", "2026-03-25"),
              status: AssignmentStatus.pending,
              source: AssignmentSource.direct,
            }),
            SENHAS,
          ],
        }),
      );
      await renderCard();
      const table = await findTable();

      expect(within(rowOf(table, "Feita pela coordenação")).getByText("Pendente")).toBeVisible();
      expect(within(rowOf(table, "Senhas e privacidade")).getByText("Inscrita")).toBeVisible();
    });

    it("says there is no assignment yet, with no table and no button", async () => {
      server.use(listMemberAssignmentsHandler({ response: [] }));
      await renderCard();

      expect(await screen.findByText("Nenhuma alocação ainda.")).toBeVisible();
      expect(within(card()).queryByRole("table")).not.toBeInTheDocument();
      expect(within(card()).queryByRole("button")).not.toBeInTheDocument();
    });

    it("shows a skeleton as a status while the assignments are on their way", async () => {
      const assignments = createDeferred();
      server.use(
        listMemberAssignmentsHandler({ response: FIGMA_ROWS, delay: assignments.promise }),
      );
      await renderCard();

      expect(await screen.findByRole("status")).toHaveTextContent(
        "Carregando as alocações do membro…",
      );
      expect(within(card()).queryByRole("table")).not.toBeInTheDocument();

      assignments.resolve();
      expect(await findTable()).toBeInTheDocument();
      expect(screen.queryByText("Carregando as alocações do membro…")).not.toBeInTheDocument();
    });

    it("shows the error with Tentar de novo, which asks again", async () => {
      server.use(listMemberAssignmentsHandler({ error: SERVER_ERROR }));
      const user = userEvent.setup();
      await renderCard();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar as alocações do membro.",
      );
      expect(within(card()).queryByRole("table")).not.toBeInTheDocument();

      server.use(listMemberAssignmentsHandler({ response: FIGMA_ROWS }));
      await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

      expect(await findTable()).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows the same error when the request never gets an answer", async () => {
      server.use(listMemberAssignmentsHandler({ networkError: true }));
      await renderCard();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar as alocações do membro.",
      );
      expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
    });

    it("tells a director that she reads the members of her own department only, and it is not an error (A14)", async () => {
      server.use(listMemberAssignmentsHandler({ error: FORBIDDEN_SCOPE_ERROR }));
      await renderCard(buildMeUser(Role.director));

      expect(
        await screen.findByText("Você só vê as alocações de membros do seu departamento."),
      ).toBeVisible();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
      expect(within(card()).queryByRole("table")).not.toBeInTheDocument();
    });
  });

  describe("the first five, and Ver todas", () => {
    /** Eight assignments, the latest lesson first, as the API gives the list of a busy member. */
    const EIGHT = Array.from({ length: 8 }, (_, index) =>
      buildMemberAssignment({
        id: `01952ef7-0000-7000-8000-0000000001${String(index).padStart(2, "0")}`,
        lesson: lessonRef(
          `01952ef7-0000-7000-8000-0000000002${String(index).padStart(2, "0")}`,
          `Aula ${index + 1}`,
          `2026-04-${String(20 - index).padStart(2, "0")}`,
        ),
      }),
    );

    it("lists only the first five, in the order of the API, and offers Ver todas as 8", async () => {
      server.use(listMemberAssignmentsHandler({ response: EIGHT }));
      await renderCard();
      const table = await findTable();

      expect(MEMBER_ASSIGNMENTS_PREVIEW_LIMIT).toBe(5);
      expect(cellsOf(table).map((cells) => cells[0])).toEqual([
        "Aula 1",
        "Aula 2",
        "Aula 3",
        "Aula 4",
        "Aula 5",
      ]);
      const viewAll = screen.getByRole("button", { name: "Ver todas as 8" });
      expect(viewAll).toHaveAttribute("aria-expanded", "false");
      expect(viewAll).toHaveAttribute("aria-controls", region().id);
    });

    it("opens the whole list on the same screen, and Ver menos goes back to five", async () => {
      server.use(listMemberAssignmentsHandler({ response: EIGHT }));
      const user = userEvent.setup();
      const { router } = await renderCard();
      const table = await findTable();

      await user.click(screen.getByRole("button", { name: "Ver todas as 8" }));

      expect(cellsOf(table)).toHaveLength(8);
      const viewLess = screen.getByRole("button", { name: "Ver menos" });
      expect(viewLess).toHaveAttribute("aria-expanded", "true");
      expect(screen.queryByRole("button", { name: "Ver todas as 8" })).not.toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/");

      await user.click(viewLess);

      expect(cellsOf(table)).toHaveLength(5);
      expect(screen.getByRole("button", { name: "Ver todas as 8" })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });

    it("draws no Ver todas when the list is not longer than five", async () => {
      server.use(listMemberAssignmentsHandler({ response: EIGHT.slice(0, 5) }));
      await renderCard();
      const table = await findTable();

      expect(cellsOf(table)).toHaveLength(5);
      expect(screen.queryByRole("button", { name: /Ver todas/ })).not.toBeInTheDocument();
    });
  });

  describe("who sees it, and who cancels (CA3)", () => {
    it("without members.view draws nothing and asks nothing", async () => {
      const onCall = vi.fn<(call: IdCall) => void>();
      server.use(listMemberAssignmentsHandler({ onCall }));
      const { queryClient } = await renderCard(buildMeUser(Role.member));

      expect(screen.queryByRole("heading", { name: TITLE })).not.toBeInTheDocument();
      expect(onCall).not.toHaveBeenCalled();
      expectNoRequestBesidesSession(queryClient);
    });

    it.each([
      ["the director", Role.director],
      ["the coordinator", Role.coordinator],
    ])(
      "shows the list to %s, with a button to cancel each assignment that is not final",
      async (_label, role) => {
        server.use(listMemberAssignmentsHandler({ response: FIGMA_ROWS }));
        await renderCard(buildMeUser(role));
        await findTable();

        expect(screen.getAllByRole("button", { name: /^Cancelar a alocação em / })).toHaveLength(3);
      },
    );

    it("cancel is offered only with assignments.create, and only for pending or confirmed", async () => {
      const decided = (id: string, status: AssignmentStatus, title: string) =>
        buildMemberAssignment({ id, status, lesson: lessonRef(id, title, "2026-03-05") });
      const rows = [
        SENHAS,
        TECLADO,
        decided("01952ef7-0000-7000-8000-0000000000a6", AssignmentStatus.declined, "Aula recusada"),
        decided(
          "01952ef7-0000-7000-8000-0000000000a7",
          AssignmentStatus.cancelled,
          "Aula cancelada",
        ),
      ];
      server.use(listMemberAssignmentsHandler({ response: rows }));
      await renderCard();
      const table = await findTable();

      // The pending one and the confirmed one, and not the declined and the cancelled.
      expect(
        screen
          .getAllByRole("button", { name: /^Cancelar a alocação em / })
          .map((button) => button.getAttribute("aria-label")),
      ).toEqual([CANCEL_SENHAS, "Cancelar a alocação em Teclado, mouse e janelas de 10/03"]);
      expect(within(rowOf(table, "Aula recusada")).queryByRole("button")).not.toBeInTheDocument();
      expect(within(rowOf(table, "Aula cancelada")).queryByRole("button")).not.toBeInTheDocument();
    });

    it("has no column of actions and no button for who cannot assign, even with members.view", async () => {
      server.use(listMemberAssignmentsHandler({ response: FIGMA_ROWS }));
      await renderCard(buildMeUserWith({ "assignments.create": "none" }));
      const table = await findTable();

      expect(
        within(table)
          .getAllByRole("columnheader")
          .map((header) => header.textContent),
      ).toEqual(["Aula", "Data", "Papel", "Status"]);
      expect(within(card()).queryByRole("button")).not.toBeInTheDocument();
    });

    it("names the button after the lesson and the day, a trash icon that is decoration", async () => {
      server.use(listMemberAssignmentsHandler({ response: [SENHAS] }));
      await renderCard();
      await findTable();

      const button = screen.getByRole("button", { name: CANCEL_SENHAS });

      expect(button).toHaveClass("min-h-11", "min-w-11");
      expect(button.querySelector("img")).toHaveAttribute("alt", "");
      expect(button.querySelector("img")).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("cancelling", () => {
    const dialog = () => screen.getByRole("dialog", { name: "Cancelar alocação" });
    const confirmButton = () => within(dialog()).getByRole("button", { name: "Cancelar alocação" });
    const backButton = () => within(dialog()).getByRole("button", { name: "Voltar" });

    /** The API as it is before and after the cancellation of the assignment of "Senhas e privacidade". */
    function useCancellation() {
      let isCancelled = false;
      const cancelled = buildMemberAssignment({
        ...SENHAS,
        status: AssignmentStatus.cancelled,
      });
      const onList = vi.fn<(call: IdCall) => void>();
      const onCancel = vi.fn<(call: IdCall) => void>();
      server.use(
        listMemberAssignmentsHandler({
          response: () => (isCancelled ? [cancelled, TECLADO, CONHECENDO] : FIGMA_ROWS),
          onCall: onList,
        }),
        cancelAssignmentHandler({
          onCall: (call) => {
            isCancelled = true;
            onCancel(call);
          },
        }),
      );
      return { onList, onCancel };
    }

    it("asks for the confirmation, saying which assignment it is and what happens", async () => {
      server.use(listMemberAssignmentsHandler({ response: FIGMA_ROWS }));
      const user = userEvent.setup();
      await renderCard();
      await findTable();

      await user.click(screen.getByRole("button", { name: CANCEL_SENHAS }));

      const opened = await screen.findByRole("dialog", { name: "Cancelar alocação" });
      expect(opened).toHaveAccessibleDescription(
        "Você vai cancelar a alocação de monitor(a) em “Senhas e privacidade”, de 24/03. O lugar fica livre e a cobertura da aula é atualizada.",
      );
      expect(backButton()).toHaveClass("button--secondary", "min-h-11");
      expect(confirmButton()).toHaveClass("button--danger", "min-h-11");
      expect(within(opened).getByRole("button", { name: "Fechar" })).toBeInTheDocument();
    });

    it("focuses Voltar when it opens: the safe answer", async () => {
      server.use(listMemberAssignmentsHandler({ response: FIGMA_ROWS }));
      const user = userEvent.setup();
      await renderCard();
      await findTable();

      await user.click(screen.getByRole("button", { name: CANCEL_SENHAS }));
      await screen.findByRole("dialog", { name: "Cancelar alocação" });

      await waitFor(() => expect(backButton()).toHaveFocus());
    });

    it("Voltar closes without cancelling, and the focus goes back to the button of the row", async () => {
      const { onCancel } = useCancellation();
      const user = userEvent.setup();
      await renderCard();
      await findTable();
      await user.click(screen.getByRole("button", { name: CANCEL_SENHAS }));
      await screen.findByRole("dialog", { name: "Cancelar alocação" });

      await user.click(backButton());

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() =>
        expect(screen.getByRole("button", { name: CANCEL_SENHAS })).toHaveFocus(),
      );
      expect(onCancel).not.toHaveBeenCalled();
      expect(screen.queryByText("Alocação cancelada")).not.toBeInTheDocument();
    });

    it("cancelling updates the row without reloading, with the toast and the focus in the table", async () => {
      const { onList, onCancel } = useCancellation();
      const user = userEvent.setup();
      const { router } = await renderCard();
      const table = await findTable();
      expect(cellsOf(table)[0]).toEqual([
        "Senhas e privacidade",
        "24/03",
        "Monitor(a)",
        "Inscrita",
        "",
      ]);
      await user.click(screen.getByRole("button", { name: CANCEL_SENHAS }));
      await screen.findByRole("dialog", { name: "Cancelar alocação" });

      await user.click(confirmButton());

      expect(await screen.findByText("Alocação cancelada")).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(onCancel).toHaveBeenCalledExactlyOnceWith({ id: ASSIGNMENT_ID });
      // The same table, with the row now cancelled and with no button: nothing was mounted again.
      await waitFor(() =>
        expect(cellsOf(table)[0]).toEqual([
          "Senhas e privacidade",
          "24/03",
          "Monitor(a)",
          "Cancelada",
          "",
        ]),
      );
      expect(screen.getByRole("table")).toBe(table);
      expect(
        within(rowOf(table, "Senhas e privacidade")).queryByRole("button"),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: CANCEL_SENHAS })).not.toBeInTheDocument();
      expect(onList).toHaveBeenCalledTimes(2);
      expect(router.state.location.pathname).toBe("/");
      // The button that had the focus is gone, so the focus is on the region of the table.
      await waitFor(() => expect(region()).toHaveFocus());
    });

    it("tells the cache: the list of the member, the assignments of the lesson and the lesson are out of date", async () => {
      const { onList } = useCancellation();
      const user = userEvent.setup();
      const { queryClient } = await renderCard();
      await findTable();
      queryClient.setQueryData(getListLessonAssignmentsQueryKey(LESSON_ID), [
        buildLessonAssignment(),
      ]);
      queryClient.setQueryData(getGetLessonQueryKey(LESSON_ID), { id: LESSON_ID });
      queryClient.setQueryData(getGetLessonQueryKey(OTHER_LESSON_ID), { id: OTHER_LESSON_ID });
      await user.click(screen.getByRole("button", { name: CANCEL_SENHAS }));
      await screen.findByRole("dialog", { name: "Cancelar alocação" });

      await user.click(confirmButton());

      await screen.findByText("Alocação cancelada");
      const stateOf = (key: readonly unknown[]) => queryClient.getQueryState(key)?.isInvalidated;
      expect(stateOf(getListLessonAssignmentsQueryKey(LESSON_ID))).toBe(true);
      expect(stateOf(getGetLessonQueryKey(LESSON_ID))).toBe(true);
      expect(stateOf(getGetLessonQueryKey(OTHER_LESSON_ID))).toBe(false);
      // The list of the member is on the screen, so it was asked again and not only marked.
      await waitFor(() => expect(onList).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(stateOf(getListMemberAssignmentsQueryKey(MEMBER_ID))).toBe(false));
    });

    it("keeps the dialog shut and ignores a second press while the request is on its way", async () => {
      const response = createDeferred();
      const onCancel = vi.fn<(call: IdCall) => void>();
      server.use(
        listMemberAssignmentsHandler({ response: FIGMA_ROWS }),
        cancelAssignmentHandler({ delay: response.promise, onCall: onCancel }),
      );
      const user = userEvent.setup();
      await renderCard();
      await findTable();
      await user.click(screen.getByRole("button", { name: CANCEL_SENHAS }));
      await screen.findByRole("dialog", { name: "Cancelar alocação" });

      await user.click(confirmButton());
      await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));

      await user.keyboard("{Escape}");
      await user.click(within(dialog()).getByRole("button", { name: "Fechar" }));
      await user.click(backButton());
      await user.click(within(dialog()).getByRole("button", { name: /Cancelando/ }));
      expect(dialog()).toBeInTheDocument();
      expect(backButton()).toBeDisabled();
      expect(onCancel).toHaveBeenCalledTimes(1);

      response.resolve();
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("shows ASSIGNMENT_NOT_ACTIVE as a warning with the focus, turns Cancelar alocação off and asks the list again", async () => {
      const onList = vi.fn<(call: IdCall) => void>();
      let isDecided = false;
      server.use(
        listMemberAssignmentsHandler({
          response: () =>
            isDecided
              ? [
                  buildMemberAssignment({ ...SENHAS, status: AssignmentStatus.declined }),
                  TECLADO,
                  CONHECENDO,
                ]
              : FIGMA_ROWS,
          onCall: onList,
        }),
        cancelAssignmentHandler({
          error: ASSIGNMENT_NOT_ACTIVE_ERROR,
          onCall: () => {
            // Somebody else refused the application first.
            isDecided = true;
          },
        }),
      );
      const user = userEvent.setup();
      await renderCard();
      const table = await findTable();
      await user.click(screen.getByRole("button", { name: CANCEL_SENHAS }));
      await screen.findByRole("dialog", { name: "Cancelar alocação" });

      await user.click(confirmButton());

      const warning = await screen.findByText(ptBR.warnings.assignmentNotActive);
      await waitFor(() => expect(warning.closest("[tabindex='-1']")).toHaveFocus());
      expect(within(dialog()).queryByRole("alert")).not.toBeInTheDocument();
      expect(confirmButton()).toBeDisabled();
      await waitFor(() => expect(onList).toHaveBeenCalledTimes(2));
      // Voltar is still there: the dialog is closed by the person, who has read what happened.
      await user.click(backButton());
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() => expect(cellsOf(table)[0]?.[3]).toBe("Recusada"));
      expect(screen.queryByRole("button", { name: CANCEL_SENHAS })).not.toBeInTheDocument();
      expect(screen.queryByText("Alocação cancelada")).not.toBeInTheDocument();
    });

    it("shows ASSIGNMENT_NOT_FOUND as an alert with the focus, and asks the list again", async () => {
      const onList = vi.fn<(call: IdCall) => void>();
      server.use(
        listMemberAssignmentsHandler({ response: FIGMA_ROWS, onCall: onList }),
        cancelAssignmentHandler({ error: ASSIGNMENT_NOT_FOUND_ERROR }),
      );
      const user = userEvent.setup();
      await renderCard();
      await findTable();
      await user.click(screen.getByRole("button", { name: CANCEL_SENHAS }));
      await screen.findByRole("dialog", { name: "Cancelar alocação" });

      await user.click(confirmButton());

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Alocação não encontrada. Ela pode ter sido removida.");
      await waitFor(() => expect(alert.parentElement).toHaveFocus());
      expect(confirmButton()).toBeDisabled();
      await waitFor(() => expect(onList).toHaveBeenCalledTimes(2));
    });

    it("shows a network failure as an alert, and the next attempt clears it and cancels", async () => {
      const onCancel = vi.fn<(call: IdCall) => void>();
      server.use(
        listMemberAssignmentsHandler({ response: FIGMA_ROWS }),
        cancelAssignmentHandler({ networkError: true }),
      );
      const user = userEvent.setup();
      await renderCard();
      await findTable();
      await user.click(screen.getByRole("button", { name: CANCEL_SENHAS }));
      await screen.findByRole("dialog", { name: "Cancelar alocação" });

      await user.click(confirmButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível conectar. Verifique sua conexão e tente novamente.",
      );
      expect(confirmButton()).toBeEnabled();

      server.use(cancelAssignmentHandler({ onCall: onCancel }));
      await user.click(confirmButton());

      expect(await screen.findByText("Alocação cancelada")).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(onCancel).toHaveBeenCalledExactlyOnceWith({ id: ASSIGNMENT_ID });
    });

    it("shows any other error as the generic alert", async () => {
      server.use(
        listMemberAssignmentsHandler({ response: FIGMA_ROWS }),
        cancelAssignmentHandler({ error: SERVER_ERROR }),
      );
      const user = userEvent.setup();
      await renderCard();
      await findTable();
      await user.click(screen.getByRole("button", { name: CANCEL_SENHAS }));
      await screen.findByRole("dialog", { name: "Cancelar alocação" });

      await user.click(confirmButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(ptBR.errors.unknown);
      expect(confirmButton()).toBeEnabled();
    });
  });
});
