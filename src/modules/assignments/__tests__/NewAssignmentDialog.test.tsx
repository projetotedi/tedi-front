import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getListLessonAssignmentsQueryKey } from "@api/generated/assignments/assignments";
import { getGetLessonQueryKey } from "@api/generated/lessons/lessons";
import {
  LessonStatus,
  MemberRegistrationStatus,
  MemberStatus,
  type ListLessons200,
} from "@api/generated/model";
import { getListMembersQueryKey } from "@api/generated/people/people";

import {
  NewAssignmentDialog,
  type AssignmentScope,
  type AssignmentLessonContext,
} from "../components/NewAssignmentDialog";
import ptBR from "../locales/pt-BR.json";
import {
  ASSIGNMENT_NOT_ACTIVE_ERROR,
  buildLessonAssignment,
  buildLessonListItem,
  buildLessonsPage,
  buildMemberListItem,
  buildMembersPage,
  CLASS_ID,
  CLASS_NAME,
  createAssignmentHandler,
  DUPLICATE_ROLE_ERROR,
  LESSON_CANCELLED_ERROR,
  LESSON_ID,
  LESSON_NOT_FOUND_ERROR,
  LESSON_OPTION,
  LESSON_TITLE,
  listLessonsHandler,
  listMembersHandler,
  MEMBER_ID,
  MEMBER_INACTIVE_ERROR,
  MEMBER_NAME,
  MEMBER_NOT_FOUND_ERROR,
  OTHER_CLASS_ID,
  OTHER_CLASS_NAME,
  OTHER_LESSON_ID,
  OTHER_MEMBER_ID,
  SERVER_ERROR,
  TEACHER_TAKEN_ERROR,
  THIRD_LESSON_ID,
  THIRD_MEMBER_ID,
  VALIDATION_ERROR,
  type CreateAssignmentCall,
  type ListLessonsCall,
  type ListMembersCall,
} from "./handlers";
import {
  createDeferred,
  expectQueryNeverRan,
  renderWithProviders,
  server,
  setupAssignmentsTestServer,
} from "./test-utils";

setupAssignmentsTestServer();

// The members the form can offer: three that can be assigned (out of order, one with an accent) and
// one whose registration still waits for validation, which the form does not offer.
const BEATRIZ = buildMemberListItem();
const RAFAEL = buildMemberListItem({ id: OTHER_MEMBER_ID, name: "Rafael Souza" });
const ALVARO = buildMemberListItem({
  id: "01952ef7-0000-7000-8000-0000000000b4",
  name: "Álvaro Lima",
});
const LUCAS_PENDING = buildMemberListItem({
  id: THIRD_MEMBER_ID,
  name: "Lucas Andrade",
  registrationStatus: MemberRegistrationStatus.pending,
});

// The lessons of the API: two of the class "Informática Básica — A" and one of "Redes Sociais — C".
const LESSON_A = buildLessonListItem();
const LESSON_A2 = buildLessonListItem({
  id: THIRD_LESSON_ID,
  title: "Teclado, mouse e janelas",
  date: "2026-03-17",
});
const LESSON_A2_OPTION = "17/03 · Teclado, mouse e janelas";
const LESSON_C = buildLessonListItem({
  id: OTHER_LESSON_ID,
  title: "Redes sociais",
  date: "2026-03-24",
  class: { id: OTHER_CLASS_ID, code: "REDES-C", name: OTHER_CLASS_NAME, colorIndex: 1 },
});
const LESSON_C_OPTION = "24/03 · Redes sociais";

/** What the API answers to the two uses of `GET /lessons` of the form: the classes, and the lessons of a class. */
function lessonsFor(call: ListLessonsCall): ListLessons200 {
  if (call.classId === null) return buildLessonsPage([LESSON_A, LESSON_A2, LESSON_C]);
  if (call.classId === CLASS_ID) return buildLessonsPage([LESSON_A, LESSON_A2]);
  return buildLessonsPage([LESSON_C]);
}

beforeEach(() => {
  server.use(
    listMembersHandler({ response: buildMembersPage([RAFAEL, BEATRIZ, LUCAS_PENDING, ALVARO]) }),
    listLessonsHandler({ response: lessonsFor }),
  );
});

const dialog = () => screen.getByRole("dialog", { name: "Nova alocação de membro" });
const memberSelect = () => screen.getByRole("button", { name: /\bMembro\b/ });
const classSelect = () => screen.getByRole("button", { name: /\bTurma\b/ });
const lessonSelect = () => screen.getByRole("button", { name: /\bAula\b/ });
const roleSelect = () => screen.getByRole("button", { name: /Papel na aula/ });
const statusSelect = () => screen.getByRole("button", { name: /Status da alocação/ });
const cancelButton = () => screen.getByRole("button", { name: "Cancelar" });
const saveButton = () => screen.getByRole("button", { name: /^(Salvar alocação|Salvando…)$/ });

const optionLabels = () => screen.getAllByRole("option").map((option) => option.textContent);

const retryButton = () => screen.getByRole("button", { name: "Tentar de novo" });

/**
 * Waits for "Tentar de novo" to go away, which is the answer of the list: the message of the failure
 * goes as soon as the list is asked again (the query is pending then), so it says nothing about the
 * answer, while the button is kept on the screen until the answer comes.
 */
const waitForRetryToEnd = () =>
  waitFor(() =>
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument(),
  );

interface RenderOptions {
  /** Waits for the lists of the selects to arrive. Off for a test that holds an answer back on purpose. */
  waitForOptions?: boolean;
}

async function renderDialog(
  scope: AssignmentScope = {},
  { waitForOptions = true }: RenderOptions = {},
) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const view = await renderWithProviders(
    <NewAssignmentDialog {...scope} onClose={onClose} onSaved={onSaved} />,
  );
  await screen.findByRole("dialog", { name: "Nova alocação de membro" });

  if (waitForOptions) {
    // A select with no options does not open, so a test waits until the lists are there.
    await waitFor(() => {
      expect(screen.queryByText("Carregando os membros…")).not.toBeInTheDocument();
      expect(screen.queryByText("Carregando as turmas…")).not.toBeInTheDocument();
    });
  }

  return { ...view, onClose, onSaved };
}

async function choose(user: UserEvent, select: () => HTMLElement, option: string) {
  await user.click(select());
  await user.click(await screen.findByRole("option", { name: option }));
}

/** The lessons of a class arrive after the class is chosen, and the select does not open before. */
async function waitForLessons() {
  await waitFor(() => expect(screen.queryByText("Carregando as aulas…")).not.toBeInTheDocument());
}

/** Fills the form of the list of members: Beatriz, the class "Informática Básica — A", "10/03 · Senhas e privacidade" and a role. */
async function fillWholeForm(user: UserEvent, role = "Professor(a)") {
  await choose(user, memberSelect, MEMBER_NAME);
  await choose(user, classSelect, CLASS_NAME);
  await waitForLessons();
  await choose(user, lessonSelect, LESSON_OPTION);
  await choose(user, roleSelect, role);
}

const CLASS_CONTEXT = { id: CLASS_ID, label: CLASS_NAME };

const LESSON_CONTEXT: AssignmentLessonContext = {
  id: LESSON_ID,
  title: LESSON_TITLE,
  date: "2026-03-10",
  lessonClass: { id: CLASS_ID, label: CLASS_NAME },
};

describe("NewAssignmentDialog", () => {
  describe("layout", () => {
    it("is the dialog of the Figma, with Cancelar and Salvar alocação in the footer and a close button", async () => {
      await renderDialog();

      expect(dialog()).toHaveClass("max-w-160");
      expect(within(dialog()).getByRole("button", { name: "Fechar" })).toBeInTheDocument();
      expect(cancelButton()).toHaveClass("button--secondary", "min-h-11");
      expect(saveButton()).toHaveClass("button--primary", "min-h-11");
      expect(saveButton()).toHaveAttribute("type", "submit");
    });

    it("has the five fields in the order of the Figma: member, class and lesson, role and status", async () => {
      await renderDialog();

      const controls = [
        memberSelect(),
        classSelect(),
        lessonSelect(),
        roleSelect(),
        statusSelect(),
      ];
      controls.slice(1).forEach((control, index) => {
        const isAfter = controls[index].compareDocumentPosition(control);
        expect(isAfter & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      });
    });

    it("starts with nothing chosen but the status, which is Confirmada and can be seen", async () => {
      await renderDialog();

      expect(memberSelect()).toHaveTextContent("Escolha o membro");
      expect(classSelect()).toHaveTextContent("Escolha a turma");
      expect(lessonSelect()).toHaveTextContent("Escolha a aula");
      expect(roleSelect()).toHaveTextContent("Escolha o papel");
      expect(statusSelect()).toHaveTextContent("Confirmada");
    });

    it("marks the member, the class, the lesson and the role as required, and not the status", async () => {
      await renderDialog();

      for (const select of [memberSelect, classSelect, lessonSelect, roleSelect]) {
        expect(select().closest("[data-required='true']")).not.toBeNull();
      }
      expect(statusSelect().closest("[data-required='true']")).toBeNull();
    });

    it("keeps the 44px targets and the 16px font on the selects", async () => {
      await renderDialog();

      for (const select of [memberSelect, classSelect, lessonSelect, roleSelect, statusSelect]) {
        expect(select()).toHaveClass("min-h-11", "text-base");
      }
    });

    it("focuses the first field when it opens: the member", async () => {
      await renderDialog();

      await waitFor(() => expect(memberSelect()).toHaveFocus());
    });

    it("offers Professor(a) and Monitor(a) as the role, in Portuguese and in that order", async () => {
      const user = userEvent.setup();
      await renderDialog();

      await user.click(roleSelect());

      expect(optionLabels()).toEqual(["Professor(a)", "Monitor(a)"]);
    });

    it("offers Confirmada and Pendente as the status, and nothing else", async () => {
      const user = userEvent.setup();
      await renderDialog();

      await user.click(statusSelect());

      expect(optionLabels()).toEqual(["Confirmada", "Pendente"]);
    });
  });

  describe("the members", () => {
    it("offers the members that can be assigned, in alphabetical order, and not the one whose registration is pending", async () => {
      const user = userEvent.setup();
      await renderDialog();

      await user.click(memberSelect());

      expect(optionLabels()).toEqual(["Álvaro Lima", "Beatriz Nunes", "Rafael Souza"]);
    });

    it("asks the active members with access, up to a page of 100", async () => {
      const onCall = vi.fn<(call: ListMembersCall) => void>();
      server.use(listMembersHandler({ response: buildMembersPage([BEATRIZ]), onCall }));
      await renderDialog();

      expect(onCall).toHaveBeenCalledExactlyOnceWith({
        status: MemberStatus.active,
        enabled: "true",
        limit: 100,
      });
    });

    it("does not offer who the API would refuse: no access, no access role, or a refused registration", async () => {
      const user = userEvent.setup();
      server.use(
        listMembersHandler({
          response: buildMembersPage([
            BEATRIZ,
            buildMemberListItem({
              id: "01952ef7-0000-7000-8000-0000000000b5",
              name: "Sem acesso",
              accessEnabled: false,
            }),
            buildMemberListItem({
              id: "01952ef7-0000-7000-8000-0000000000b6",
              name: "Sem papel",
              role: null,
            }),
            buildMemberListItem({
              id: "01952ef7-0000-7000-8000-0000000000b7",
              name: "Recusada",
              registrationStatus: MemberRegistrationStatus.rejected,
            }),
          ]),
        }),
      );
      await renderDialog();

      await user.click(memberSelect());

      expect(optionLabels()).toEqual([MEMBER_NAME]);
    });

    it("says the members are loading while they are on their way", async () => {
      const deferred = createDeferred();
      server.use(listMembersHandler({ delay: deferred.promise }));
      await renderDialog({}, { waitForOptions: false });

      expect(screen.getByText("Carregando os membros…")).toBeVisible();

      deferred.resolve();
      await waitFor(() =>
        expect(screen.queryByText("Carregando os membros…")).not.toBeInTheDocument(),
      );
    });

    it("says there is nobody to assign when the list is empty", async () => {
      server.use(listMembersHandler({ response: buildMembersPage([]) }));
      await renderDialog();

      expect(await screen.findByText("Não há membro ativo para alocar.")).toBeInTheDocument();
    });

    it("says the members could not be loaded, in a status region that was already on the screen", async () => {
      server.use(listMembersHandler({ networkError: true }));
      await renderDialog();

      const message = await screen.findByText(ptBR.newAssignment.membersError);

      expect(message.closest("[role='status']")).not.toBeNull();
    });

    it("offers Tentar de novo when the members cannot be loaded, and the options and the focus come with the answer", async () => {
      let isFailing = true;
      server.use(
        listMembersHandler({
          response: buildMembersPage([BEATRIZ, RAFAEL]),
          error: () => (isFailing ? SERVER_ERROR : undefined),
        }),
      );
      const user = userEvent.setup();
      await renderDialog();
      await screen.findByText(ptBR.newAssignment.membersError);
      const retry = retryButton();
      expect(retry).toHaveClass("min-h-11");
      expect(retry).toHaveAccessibleDescription(ptBR.newAssignment.membersError);

      isFailing = false;
      await user.click(retry);

      await waitForRetryToEnd();
      expect(screen.queryByText(ptBR.newAssignment.membersError)).not.toBeInTheDocument();
      // The focus was on the button that went away: it goes to the select that has options now.
      await waitFor(() => expect(memberSelect()).toHaveFocus());
      await user.click(memberSelect());
      expect(optionLabels()).toEqual([MEMBER_NAME, "Rafael Souza"]);
    });

    it("draws no Tentar de novo for a list that loaded, empty or not", async () => {
      server.use(listMembersHandler({ response: buildMembersPage([]) }));
      await renderDialog();
      await screen.findByText("Não há membro ativo para alocar.");

      expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
    });
  });

  describe("the classes and the lessons", () => {
    it("offers the classes of the lessons from today on, once each, in alphabetical order", async () => {
      const user = userEvent.setup();
      await renderDialog();

      await user.click(classSelect());

      expect(optionLabels()).toEqual([CLASS_NAME, OTHER_CLASS_NAME]);
    });

    describe("the day the classes start from", () => {
      beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        vi.setSystemTime(new Date(2026, 2, 5, 12, 0));
      });
      afterEach(() => {
        vi.useRealTimers();
      });

      it("is today, and no class is asked for", async () => {
        const onCall = vi.fn<(call: ListLessonsCall) => void>();
        server.use(listLessonsHandler({ response: lessonsFor, onCall }));
        await renderDialog();

        expect(onCall).toHaveBeenCalledExactlyOnceWith({
          classId: null,
          from: "2026-03-05",
          limit: 100,
        });
      });
    });

    it("keeps the lesson off, and says why, until a class is chosen", async () => {
      await renderDialog();

      expect(lessonSelect()).toBeDisabled();
      expect(screen.getByText("Escolha a turma para ver as aulas.")).toBeVisible();
    });

    it("filters the lessons by the chosen class and clears the lesson when the class changes", async () => {
      const user = userEvent.setup();
      await renderDialog();

      await choose(user, classSelect, CLASS_NAME);
      await waitForLessons();
      expect(lessonSelect()).toBeEnabled();
      await user.click(lessonSelect());
      expect(optionLabels()).toEqual([LESSON_OPTION, LESSON_A2_OPTION]);
      await user.click(screen.getByRole("option", { name: LESSON_OPTION }));
      expect(lessonSelect()).toHaveTextContent(LESSON_OPTION);

      await choose(user, classSelect, OTHER_CLASS_NAME);

      expect(lessonSelect()).toHaveTextContent("Escolha a aula");
      expect(lessonSelect()).not.toHaveTextContent("Senhas e privacidade");
      await waitForLessons();
      await user.click(lessonSelect());
      expect(optionLabels()).toEqual([LESSON_C_OPTION]);
    });

    it("asks the lessons of the class that was chosen, up to a page of 100", async () => {
      const onCall = vi.fn<(call: ListLessonsCall) => void>();
      server.use(listLessonsHandler({ response: lessonsFor, onCall }));
      const user = userEvent.setup();
      await renderDialog();

      await choose(user, classSelect, OTHER_CLASS_NAME);

      await waitFor(() =>
        expect(onCall).toHaveBeenCalledWith({ classId: OTHER_CLASS_ID, from: null, limit: 100 }),
      );
    });

    it("leaves out the cancelled lessons and offers the ones that are done", async () => {
      server.use(
        listLessonsHandler({
          response: (call) =>
            call.classId === null
              ? buildLessonsPage([LESSON_A])
              : buildLessonsPage([
                  LESSON_A,
                  buildLessonListItem({
                    id: OTHER_LESSON_ID,
                    title: "Aula cancelada",
                    date: "2026-03-12",
                    status: LessonStatus.cancelled,
                  }),
                  buildLessonListItem({
                    id: THIRD_LESSON_ID,
                    title: "Aula feita",
                    date: "2026-02-03",
                    status: LessonStatus.done,
                  }),
                ]),
        }),
      );
      const user = userEvent.setup();
      await renderDialog();

      await choose(user, classSelect, CLASS_NAME);
      await waitForLessons();
      await user.click(lessonSelect());

      expect(optionLabels()).toEqual([LESSON_OPTION, "03/02 · Aula feita"]);
    });

    it("says the classes are loading while they are on their way", async () => {
      const deferred = createDeferred();
      server.use(listLessonsHandler({ delay: deferred.promise }));
      await renderDialog({}, { waitForOptions: false });

      expect(screen.getByText("Carregando as turmas…")).toBeVisible();

      deferred.resolve();
      await waitFor(() =>
        expect(screen.queryByText("Carregando as turmas…")).not.toBeInTheDocument(),
      );
    });

    it("says no class has lessons ahead when the list is empty", async () => {
      server.use(listLessonsHandler({ response: buildLessonsPage([]) }));
      await renderDialog();

      expect(
        await screen.findByText("Nenhuma turma tem aulas a partir de hoje."),
      ).toBeInTheDocument();
    });

    it("says the classes could not be loaded", async () => {
      server.use(listLessonsHandler({ error: SERVER_ERROR }));
      await renderDialog();

      expect(await screen.findByText(ptBR.newAssignment.classesError)).toBeInTheDocument();
    });

    it("offers Tentar de novo when the classes cannot be loaded, and the options and the focus come with the answer", async () => {
      let isFailing = true;
      server.use(
        listLessonsHandler({
          response: lessonsFor,
          error: () => (isFailing ? SERVER_ERROR : undefined),
        }),
      );
      const user = userEvent.setup();
      await renderDialog();
      await screen.findByText(ptBR.newAssignment.classesError);

      isFailing = false;
      await user.click(retryButton());

      await waitForRetryToEnd();
      expect(screen.queryByText(ptBR.newAssignment.classesError)).not.toBeInTheDocument();
      await waitFor(() => expect(classSelect()).toHaveFocus());
      await user.click(classSelect());
      expect(optionLabels()).toEqual([CLASS_NAME, OTHER_CLASS_NAME]);
    });

    it("says the class has no lesson that takes an assignment when all of them are cancelled", async () => {
      server.use(
        listLessonsHandler({
          response: (call) =>
            call.classId === null
              ? buildLessonsPage([LESSON_A])
              : buildLessonsPage([buildLessonListItem({ status: LessonStatus.cancelled })]),
        }),
      );
      const user = userEvent.setup();
      await renderDialog();

      await choose(user, classSelect, CLASS_NAME);

      expect(
        await screen.findByText("Esta turma não tem aulas que recebam alocação."),
      ).toBeInTheDocument();
    });

    it("says the lessons of the class could not be loaded, and the classes still can be chosen", async () => {
      server.use(
        listLessonsHandler({
          response: lessonsFor,
          // Only the request for the lessons of a class fails: the one for the classes answers.
          error: (call) => (call.classId === null ? undefined : SERVER_ERROR),
        }),
      );
      const user = userEvent.setup();
      await renderDialog();

      await choose(user, classSelect, CLASS_NAME);

      expect(await screen.findByText(ptBR.newAssignment.lessonsError)).toBeInTheDocument();
      expect(
        screen.queryByText("Esta turma não tem aulas que recebam alocação."),
      ).not.toBeInTheDocument();
    });

    it("offers Tentar de novo when the lessons of the fixed class cannot be loaded, and the options come with the answer", async () => {
      let isFailing = true;
      server.use(
        listLessonsHandler({
          response: lessonsFor,
          error: () => (isFailing ? SERVER_ERROR : undefined),
        }),
      );
      const user = userEvent.setup();
      // From the screen of the class there is no class to choose again: the message cannot ask for it.
      await renderDialog({ lessonClass: CLASS_CONTEXT });
      expect(await screen.findByText(ptBR.newAssignment.lessonsError)).toBeInTheDocument();
      const retry = retryButton();
      expect(retry).toHaveClass("min-h-11");
      expect(retry).toHaveAccessibleDescription(ptBR.newAssignment.lessonsError);

      isFailing = false;
      await user.click(retry);

      await waitForRetryToEnd();
      expect(screen.queryByText(ptBR.newAssignment.lessonsError)).not.toBeInTheDocument();
      await waitFor(() => expect(lessonSelect()).toHaveFocus());
      await user.click(lessonSelect());
      expect(optionLabels()).toEqual([LESSON_OPTION, LESSON_A2_OPTION]);
    });

    it("keeps Tentar de novo, with the focus, while the list is asked again and when it fails again", async () => {
      server.use(listLessonsHandler({ response: lessonsFor, error: SERVER_ERROR }));
      const user = userEvent.setup();
      await renderDialog({ lessonClass: CLASS_CONTEXT });
      await screen.findByText(ptBR.newAssignment.lessonsError);
      const retry = retryButton();
      // The next answer is held back, and then it is a failure again.
      const answer = createDeferred();
      server.use(
        listLessonsHandler({ response: lessonsFor, error: SERVER_ERROR, delay: answer.promise }),
      );

      await user.click(retry);

      // Asked again: the list says it is loading and the message is gone, but the button stays, with
      // the focus, so it is not taken away from whoever pressed it.
      expect(await screen.findByText("Carregando as aulas…")).toBeInTheDocument();
      expect(screen.queryByText(ptBR.newAssignment.lessonsError)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Tentar de novo/ })).toBe(retry);
      expect(retry).toHaveFocus();

      answer.resolve();

      expect(await screen.findByText(ptBR.newAssignment.lessonsError)).toBeInTheDocument();
      expect(retryButton()).toBe(retry);
      expect(retry).toHaveFocus();
    });
  });

  describe("opened from the sheet of a member (CA1)", () => {
    const MEMBER = { id: MEMBER_ID, name: MEMBER_NAME };

    it("fills the member and keeps it read-only, without asking the list of members", async () => {
      const onMembers = vi.fn<(call: ListMembersCall) => void>();
      server.use(listMembersHandler({ onCall: onMembers }));
      const { queryClient } = await renderDialog({ member: MEMBER });

      const field = screen.getByLabelText(/^Membro/);
      expect(field).toHaveValue(MEMBER_NAME);
      expect(field).toHaveAttribute("readonly");
      expect(field).toBeRequired();
      expect(screen.queryByRole("button", { name: /\bMembro\b/ })).not.toBeInTheDocument();
      expect(onMembers).not.toHaveBeenCalled();
      expectQueryNeverRan(queryClient, getListMembersQueryKey());
    });

    it("focuses the first field that can be changed: the class", async () => {
      await renderDialog({ member: MEMBER });

      await waitFor(() => expect(classSelect()).toHaveFocus());
    });

    it("sends the member of the sheet with the role and the status", async () => {
      const onCall = vi.fn<(call: CreateAssignmentCall) => void>();
      server.use(createAssignmentHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog({ member: MEMBER });

      await choose(user, classSelect, CLASS_NAME);
      await waitForLessons();
      await choose(user, lessonSelect, LESSON_OPTION);
      await choose(user, roleSelect, "Monitor(a)");
      await user.click(saveButton());

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledWith({
        id: LESSON_ID,
        body: { personId: MEMBER_ID, role: "monitor", status: "confirmed" },
      });
    });

    it("does not ask for the member when the rest is filled: only the role is missing", async () => {
      const onCall = vi.fn();
      server.use(createAssignmentHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog({ member: MEMBER, lesson: LESSON_CONTEXT });

      await user.click(saveButton());

      await waitFor(() => expect(screen.getAllByText("Escolha uma opção.")).toHaveLength(1));
      expect(onCall).not.toHaveBeenCalled();
    });
  });

  describe("opened from the screen of a lesson", () => {
    it("fixes the class and the lesson as read-only fields, and asks neither list", async () => {
      const onLessons = vi.fn<(call: ListLessonsCall) => void>();
      server.use(listLessonsHandler({ onCall: onLessons }));
      await renderDialog({ lesson: LESSON_CONTEXT });

      expect(screen.getByLabelText(/^Turma/)).toHaveValue(CLASS_NAME);
      expect(screen.getByLabelText(/^Turma/)).toHaveAttribute("readonly");
      expect(screen.getByLabelText(/^Aula/)).toHaveValue(LESSON_OPTION);
      expect(screen.getByLabelText(/^Aula/)).toHaveAttribute("readonly");
      expect(screen.queryByRole("button", { name: /\bTurma\b/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /\bAula\b/ })).not.toBeInTheDocument();
      expect(onLessons).not.toHaveBeenCalled();
    });

    it("focuses the member, the first field that can be changed", async () => {
      await renderDialog({ lesson: LESSON_CONTEXT });

      await waitFor(() => expect(memberSelect()).toHaveFocus());
    });

    it("sends the assignment to the lesson of the screen", async () => {
      const onCall = vi.fn<(call: CreateAssignmentCall) => void>();
      server.use(createAssignmentHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog({ lesson: LESSON_CONTEXT });

      await choose(user, memberSelect, "Rafael Souza");
      await choose(user, roleSelect, "Monitor(a)");
      await choose(user, statusSelect, "Pendente");
      await user.click(saveButton());

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledWith({
        id: LESSON_ID,
        body: { personId: OTHER_MEMBER_ID, role: "monitor", status: "pending" },
      });
    });
  });

  describe("opened from the screen of a class", () => {
    it("fixes the class as a read-only field and offers the lessons of that class only", async () => {
      const onLessons = vi.fn<(call: ListLessonsCall) => void>();
      server.use(listLessonsHandler({ response: lessonsFor, onCall: onLessons }));
      const user = userEvent.setup();
      await renderDialog({ lessonClass: CLASS_CONTEXT });

      expect(screen.getByLabelText(/^Turma/)).toHaveValue(CLASS_NAME);
      expect(screen.getByLabelText(/^Turma/)).toHaveAttribute("readonly");
      expect(screen.queryByRole("button", { name: /\bTurma\b/ })).not.toBeInTheDocument();
      await waitForLessons();
      await user.click(lessonSelect());

      expect(optionLabels()).toEqual([LESSON_OPTION, LESSON_A2_OPTION]);
      // Only the lessons of the class were asked, and no list of classes.
      expect(onLessons).toHaveBeenCalledExactlyOnceWith({
        classId: CLASS_ID,
        from: null,
        limit: 100,
      });
    });

    it("sends the assignment to the lesson that was chosen", async () => {
      const onCall = vi.fn<(call: CreateAssignmentCall) => void>();
      server.use(createAssignmentHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog({ lessonClass: CLASS_CONTEXT });

      await choose(user, memberSelect, MEMBER_NAME);
      await waitForLessons();
      await choose(user, lessonSelect, LESSON_A2_OPTION);
      await choose(user, roleSelect, "Professor(a)");
      await user.click(saveButton());

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledWith({
        id: THIRD_LESSON_ID,
        body: { personId: MEMBER_ID, role: "teacher", status: "confirmed" },
      });
    });
  });

  describe("validation in the form", () => {
    it("asks for the member, the class, the lesson and the role, with the focus on the first, and sends nothing", async () => {
      const onCall = vi.fn();
      server.use(createAssignmentHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog();

      await user.click(saveButton());

      await waitFor(() => expect(screen.getAllByText("Escolha uma opção.")).toHaveLength(4));
      await waitFor(() => expect(memberSelect()).toHaveFocus());
      expect(onCall).not.toHaveBeenCalled();
    });

    it("takes the focus to the first field that is missing, not to the first of the form", async () => {
      const onCall = vi.fn();
      server.use(createAssignmentHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog();
      await choose(user, memberSelect, MEMBER_NAME);
      await choose(user, classSelect, CLASS_NAME);
      await waitForLessons();

      await user.click(saveButton());

      await waitFor(() => expect(screen.getAllByText("Escolha uma opção.")).toHaveLength(2));
      await waitFor(() => expect(lessonSelect()).toHaveFocus());
      expect(onCall).not.toHaveBeenCalled();
    });

    it("clears the message of a field when the person chooses it", async () => {
      const user = userEvent.setup();
      await renderDialog();
      await user.click(saveButton());
      await waitFor(() => expect(screen.getAllByText("Escolha uma opção.")).toHaveLength(4));

      await choose(user, roleSelect, "Professor(a)");

      await waitFor(() => expect(screen.getAllByText("Escolha uma opção.")).toHaveLength(3));
    });

    it("Cancelar closes without sending anything", async () => {
      const onCall = vi.fn();
      server.use(createAssignmentHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await user.click(cancelButton());

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onCall).not.toHaveBeenCalled();
    });
  });

  describe("saving", () => {
    it("sends the member, the role and the status to the lesson, and nothing else", async () => {
      const onCall = vi.fn<(call: CreateAssignmentCall) => void>();
      server.use(createAssignmentHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog();

      await fillWholeForm(user);
      await user.click(saveButton());

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledWith({
        id: LESSON_ID,
        body: { personId: MEMBER_ID, role: "teacher", status: "confirmed" },
      });
      expect(Object.keys(onCall.mock.calls[0]?.[0].body ?? {}).sort()).toEqual([
        "personId",
        "role",
        "status",
      ]);
    });

    it("sends the status that was chosen: Pendente", async () => {
      const onCall = vi.fn<(call: CreateAssignmentCall) => void>();
      server.use(createAssignmentHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog();

      await fillWholeForm(user, "Monitor(a)");
      await choose(user, statusSelect, "Pendente");
      await user.click(saveButton());

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall.mock.calls[0]?.[0].body).toEqual({
        personId: MEMBER_ID,
        role: "monitor",
        status: "pending",
      });
    });

    it("shows the toast Alocação salva, gives the assignment to onSaved and closes", async () => {
      const created = buildLessonAssignment({ role: "monitor" });
      server.use(createAssignmentHandler({ response: created }));
      const user = userEvent.setup();
      const { onClose, onSaved } = await renderDialog();

      await fillWholeForm(user);
      await user.click(saveButton());

      expect(await screen.findByText("Alocação salva")).toBeInTheDocument();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onSaved).toHaveBeenCalledExactlyOnceWith(created);
    });

    it("tells the cache: the assignments of the lesson, the lesson itself and the lists of lessons are out of date", async () => {
      server.use(createAssignmentHandler());
      const user = userEvent.setup();
      const { queryClient } = await renderDialog();
      queryClient.setQueryData(getListLessonAssignmentsQueryKey(LESSON_ID), []);
      queryClient.setQueryData(getGetLessonQueryKey(LESSON_ID), { id: LESSON_ID });
      queryClient.setQueryData(getGetLessonQueryKey(OTHER_LESSON_ID), { id: OTHER_LESSON_ID });

      await fillWholeForm(user);
      await user.click(saveButton());

      await screen.findByText("Alocação salva");
      const stateOf = (key: readonly unknown[]) => queryClient.getQueryState(key)?.isInvalidated;
      expect(stateOf(getListLessonAssignmentsQueryKey(LESSON_ID))).toBe(true);
      expect(stateOf(getGetLessonQueryKey(LESSON_ID))).toBe(true);
      expect(stateOf(getGetLessonQueryKey(OTHER_LESSON_ID))).toBe(false);
    });

    it("keeps the dialog shut and ignores a second press while the request is on its way", async () => {
      const response = createDeferred();
      const onCall = vi.fn<(call: CreateAssignmentCall) => void>();
      server.use(createAssignmentHandler({ delay: response.promise, onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();
      await fillWholeForm(user);

      await user.click(saveButton());
      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));

      await user.keyboard("{Escape}");
      await user.click(within(dialog()).getByRole("button", { name: "Fechar" }));
      await user.click(cancelButton());
      await user.click(saveButton());
      expect(onClose).not.toHaveBeenCalled();
      expect(cancelButton()).toBeDisabled();
      expect(saveButton()).toHaveTextContent("Salvando…");
      expect(dialog()).toBeInTheDocument();
      expect(document.querySelector("form")).toHaveAttribute("aria-busy", "true");
      expect(onCall).toHaveBeenCalledTimes(1);

      response.resolve();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledTimes(1);
    });
  });

  describe("refusals of the API", () => {
    it.each([
      ["DUPLICATE_ROLE_IN_LESSON", DUPLICATE_ROLE_ERROR, ptBR.warnings.duplicateRole],
      ["LESSON_TEACHER_TAKEN", TEACHER_TAKEN_ERROR, ptBR.warnings.teacherTaken],
      ["LESSON_CANCELLED", LESSON_CANCELLED_ERROR, ptBR.warnings.lessonCancelled],
      ["MEMBER_INACTIVE", MEMBER_INACTIVE_ERROR, ptBR.warnings.memberInactive],
    ])(
      "shows %s as a warning with the focus, and keeps the dialog open",
      async (_code, error, text) => {
        server.use(createAssignmentHandler({ error }));
        const user = userEvent.setup();
        const { onClose, onSaved } = await renderDialog();
        await fillWholeForm(user);

        await user.click(saveButton());

        const warning = await screen.findByText(text);
        await waitFor(() => expect(warning.closest("[tabindex='-1']")).toHaveFocus());
        // It is a warning, not the red alert: the rule is a decision of the system.
        expect(within(dialog()).queryByRole("alert")).not.toBeInTheDocument();
        expect(dialog()).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
        expect(onSaved).not.toHaveBeenCalled();
        expect(screen.queryByText("Alocação salva")).not.toBeInTheDocument();
      },
    );

    it("takes the warning away when the person changes a field, so she can decide again", async () => {
      server.use(createAssignmentHandler({ error: TEACHER_TAKEN_ERROR }));
      const user = userEvent.setup();
      await renderDialog();
      await fillWholeForm(user);
      await user.click(saveButton());
      await screen.findByText(ptBR.warnings.teacherTaken);

      await choose(user, roleSelect, "Monitor(a)");

      expect(screen.queryByText(ptBR.warnings.teacherTaken)).not.toBeInTheDocument();
    });

    it("takes the warning away on the next try, and saves if the rule no longer refuses", async () => {
      const created = buildLessonAssignment();
      server.use(createAssignmentHandler({ error: DUPLICATE_ROLE_ERROR }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();
      await fillWholeForm(user);
      await user.click(saveButton());
      await screen.findByText(ptBR.warnings.duplicateRole);

      server.use(createAssignmentHandler({ response: created }));
      await user.click(saveButton());

      expect(await screen.findByText("Alocação salva")).toBeInTheDocument();
      expect(screen.queryByText(ptBR.warnings.duplicateRole)).not.toBeInTheDocument();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("asks the lessons again after LESSON_CANCELLED: the lesson that was refused leaves the options and the field", async () => {
      const onLessons = vi.fn<(call: ListLessonsCall) => void>();
      server.use(createAssignmentHandler({ error: LESSON_CANCELLED_ERROR }));
      const user = userEvent.setup();
      await renderDialog();
      await fillWholeForm(user);
      expect(lessonSelect()).toHaveTextContent(LESSON_OPTION);
      // From now on the API says the lesson is cancelled.
      server.use(
        listLessonsHandler({
          onCall: onLessons,
          response: (call) =>
            call.classId === null
              ? buildLessonsPage([LESSON_A, LESSON_A2, LESSON_C])
              : buildLessonsPage([
                  buildLessonListItem({ status: LessonStatus.cancelled }),
                  LESSON_A2,
                ]),
        }),
      );

      await user.click(saveButton());

      expect(await screen.findByText(ptBR.warnings.lessonCancelled)).toBeInTheDocument();
      await waitFor(() =>
        expect(onLessons).toHaveBeenCalledWith({ classId: CLASS_ID, from: null, limit: 100 }),
      );
      // The refused lesson is no longer the one chosen, and the warning stays to say why.
      await waitFor(() => expect(lessonSelect()).toHaveTextContent("Escolha a aula"));
      expect(screen.getByText(ptBR.warnings.lessonCancelled)).toBeInTheDocument();
      await user.click(lessonSelect());
      expect(optionLabels()).toEqual([LESSON_A2_OPTION]);
    });

    it("shows MEMBER_NOT_FOUND on the member field, with the focus on it", async () => {
      server.use(createAssignmentHandler({ error: MEMBER_NOT_FOUND_ERROR }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();
      await fillWholeForm(user);
      // The focus is on the role, the last field chosen, and then on Salvar alocação when the answer comes.

      await user.click(saveButton());

      expect(
        await screen.findByText("Este membro não foi encontrado. Escolha outro."),
      ).toBeInTheDocument();
      await waitFor(() => expect(memberSelect()).toHaveFocus());
      expect(onClose).not.toHaveBeenCalled();
    });

    it("shows MEMBER_NOT_FOUND as the generic alert when the member is fixed: there is no field for it", async () => {
      server.use(createAssignmentHandler({ error: MEMBER_NOT_FOUND_ERROR }));
      const user = userEvent.setup();
      await renderDialog({ member: { id: MEMBER_ID, name: MEMBER_NAME }, lesson: LESSON_CONTEXT });
      await choose(user, roleSelect, "Professor(a)");

      await user.click(saveButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(ptBR.errors.unknown);
    });

    it("shows a 400 VALIDATION_FAILED on the fields it points at, with the focus on the first one on the screen", async () => {
      server.use(
        createAssignmentHandler({
          error: VALIDATION_ERROR([
            { field: "role", message: "invalid" },
            { field: "personId", message: "invalid" },
          ]),
        }),
      );
      const user = userEvent.setup();
      await renderDialog();
      await fillWholeForm(user);

      await user.click(saveButton());

      await waitFor(() =>
        expect(screen.getAllByText("Revise este campo e tente de novo.")).toHaveLength(2),
      );
      await waitFor(() => expect(memberSelect()).toHaveFocus());
    });

    it("shows 404 LESSON_NOT_FOUND as an alert with the focus on it", async () => {
      server.use(createAssignmentHandler({ error: LESSON_NOT_FOUND_ERROR }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();
      await fillWholeForm(user);

      await user.click(saveButton());

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Aula não encontrada. Ela pode ter sido removida.");
      await waitFor(() => expect(alert.parentElement).toHaveFocus());
      expect(onClose).not.toHaveBeenCalled();
    });

    it("shows a network failure as an alert, and the next attempt clears it and saves", async () => {
      server.use(createAssignmentHandler({ networkError: true }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();
      await fillWholeForm(user);

      await user.click(saveButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível conectar. Verifique sua conexão e tente novamente.",
      );

      server.use(createAssignmentHandler({ response: buildLessonAssignment() }));
      await user.click(saveButton());

      expect(await screen.findByText("Alocação salva")).toBeInTheDocument();
      expect(within(dialog()).queryByRole("alert")).not.toBeInTheDocument();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("shows any other error as the generic alert", async () => {
      server.use(createAssignmentHandler({ error: SERVER_ERROR }));
      const user = userEvent.setup();
      await renderDialog();
      await fillWholeForm(user);

      await user.click(saveButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível concluir a ação. Tente novamente.",
      );
    });

    it("does not read the refusal of cancelling as one of creating", async () => {
      server.use(createAssignmentHandler({ error: ASSIGNMENT_NOT_ACTIVE_ERROR }));
      const user = userEvent.setup();
      await renderDialog();
      await fillWholeForm(user);

      await user.click(saveButton());

      // ASSIGNMENT_NOT_ACTIVE is the refusal of cancelling: here it is a code nobody knows.
      expect(await screen.findByRole("alert")).toHaveTextContent(ptBR.errors.unknown);
      expect(screen.queryByText(ptBR.warnings.assignmentNotActive)).not.toBeInTheDocument();
    });
  });
});
