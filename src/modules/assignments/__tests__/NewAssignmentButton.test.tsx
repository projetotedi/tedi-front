import { screen, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemberRegistrationStatus } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import {
  NewAssignmentButton,
  type NewAssignmentButtonProps,
} from "../components/NewAssignmentButton";
import {
  buildLessonAssignment,
  buildLessonListItem,
  buildLessonsPage,
  buildMeUser,
  buildMeUserWith,
  buildMemberListItem,
  buildMembersPage,
  CLASS_ID,
  CLASS_NAME,
  createAssignmentHandler,
  LESSON_ID,
  LESSON_OPTION,
  LESSON_TITLE,
  listLessonsHandler,
  listMembersHandler,
  MEMBER_ID,
  MEMBER_NAME,
  OTHER_MEMBER_ID,
  THIRD_MEMBER_ID,
  type CreateAssignmentCall,
} from "./handlers";
import { renderWithProviders, server, setupAssignmentsTestServer } from "./test-utils";

setupAssignmentsTestServer();

const DIALOG = { name: "Nova alocação de membro" };

beforeEach(() => {
  server.use(
    listMembersHandler({
      response: buildMembersPage([
        buildMemberListItem({ id: OTHER_MEMBER_ID, name: "Rafael Souza" }),
        buildMemberListItem(),
        buildMemberListItem({
          id: THIRD_MEMBER_ID,
          name: "Lucas Andrade",
          registrationStatus: MemberRegistrationStatus.pending,
        }),
      ]),
    }),
    listLessonsHandler({ response: buildLessonsPage([buildLessonListItem()]) }),
  );
});

const newAssignmentButton = () => screen.getByRole("button", { name: "Nova alocação" });
const memberSelect = () => screen.getByRole("button", { name: /\bMembro\b/ });
const classSelect = () => screen.getByRole("button", { name: /\bTurma\b/ });
const lessonSelect = () => screen.getByRole("button", { name: /\bAula\b/ });
const roleSelect = () => screen.getByRole("button", { name: /Papel na aula/ });

function renderButton(props: NewAssignmentButtonProps = {}, user = buildMeUser(Role.coordinator)) {
  return renderWithProviders(<NewAssignmentButton {...props} />, { user });
}

/** Presses the button and waits for the dialog, and for the lists of its selects, which do not open before. */
async function openDialog(user: UserEvent) {
  await user.click(newAssignmentButton());
  await screen.findByRole("dialog", DIALOG);
  await waitFor(() => {
    expect(screen.queryByText("Carregando os membros…")).not.toBeInTheDocument();
    expect(screen.queryByText("Carregando as turmas…")).not.toBeInTheDocument();
  });
}

async function choose(user: UserEvent, select: () => HTMLElement, option: string) {
  await user.click(select());
  await user.click(await screen.findByRole("option", { name: option }));
}

describe("NewAssignmentButton", () => {
  describe("who sees it (CA3)", () => {
    it("member does not see Nova alocação", async () => {
      await renderButton({}, buildMeUser(Role.member));

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.queryByText(/Nova alocação/)).not.toBeInTheDocument();
    });

    it("does not see it without a session either", async () => {
      await renderWithProviders(<NewAssignmentButton />, { user: null });

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("the permission decides, not the role: a coordinator without assignments.create does not see it", async () => {
      await renderButton({}, buildMeUserWith({ "assignments.create": "none" }));

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it.each([
      ["director", Role.director],
      ["coordinator", Role.coordinator],
    ])(
      "the %s sees the button, named Nova alocação, with the plus sign as decoration",
      async (_label, role) => {
        await renderButton({}, buildMeUser(role));

        const button = newAssignmentButton();
        expect(button).toHaveClass("button--primary", "min-h-11");
        expect(button).toHaveTextContent("+ Nova alocação");
        expect(button.querySelector("[aria-hidden='true']")).toHaveTextContent("+");
      },
    );

    it("draws no dialog until the button is pressed", async () => {
      await renderButton();

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("without a context, as in the list of members", () => {
    it("opens the dialog asking for everything: the member, the class, the lesson and the role", async () => {
      const user = userEvent.setup();
      await renderButton();

      await openDialog(user);

      expect(memberSelect()).toBeEnabled();
      expect(classSelect()).toBeEnabled();
      expect(lessonSelect()).toBeDisabled();
      expect(roleSelect()).toBeEnabled();
    });

    it("asks for the member among the members that can be assigned", async () => {
      const user = userEvent.setup();
      await renderButton();
      await openDialog(user);

      await user.click(memberSelect());

      expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
        MEMBER_NAME,
        "Rafael Souza",
      ]);
    });
  });

  describe("with the member of her sheet (CA1)", () => {
    it("opens the dialog with the member already filled in, and fixed", async () => {
      const user = userEvent.setup();
      await renderButton({ member: { id: MEMBER_ID, name: MEMBER_NAME } });

      await openDialog(user);

      expect(screen.getByLabelText(/^Membro/)).toHaveValue(MEMBER_NAME);
      expect(screen.getByLabelText(/^Membro/)).toHaveAttribute("readonly");
      expect(screen.queryByRole("button", { name: /\bMembro\b/ })).not.toBeInTheDocument();
    });
  });

  describe("with the class or the lesson of its screen", () => {
    it("opens the dialog with the class fixed", async () => {
      const user = userEvent.setup();
      await renderButton({ lessonClass: { id: CLASS_ID, label: CLASS_NAME } });

      await openDialog(user);

      expect(screen.getByLabelText(/^Turma/)).toHaveValue(CLASS_NAME);
      expect(screen.getByLabelText(/^Turma/)).toHaveAttribute("readonly");
      expect(screen.queryByRole("button", { name: /\bTurma\b/ })).not.toBeInTheDocument();
    });

    it("opens the dialog with the class and the lesson fixed", async () => {
      const user = userEvent.setup();
      await renderButton({
        lesson: {
          id: LESSON_ID,
          title: LESSON_TITLE,
          date: "2026-03-10",
          lessonClass: { id: CLASS_ID, label: CLASS_NAME },
        },
      });

      await openDialog(user);

      expect(screen.getByLabelText(/^Turma/)).toHaveValue(CLASS_NAME);
      expect(screen.getByLabelText(/^Aula/)).toHaveValue(LESSON_OPTION);
    });
  });

  describe("the dialog", () => {
    it("gives the focus back to the button when Esc closes it", async () => {
      const user = userEvent.setup();
      await renderButton();
      await openDialog(user);

      await user.keyboard("{Escape}");

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() => expect(newAssignmentButton()).toHaveFocus());
    });

    it("gives the focus back to the button when Cancelar closes it", async () => {
      const user = userEvent.setup();
      await renderButton();
      await openDialog(user);

      await user.click(screen.getByRole("button", { name: "Cancelar" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() => expect(newAssignmentButton()).toHaveFocus());
    });

    it("opens a fresh dialog each time: what was chosen before Cancelar is not kept", async () => {
      const user = userEvent.setup();
      await renderButton();
      await openDialog(user);
      await choose(user, roleSelect, "Monitor(a)");
      expect(roleSelect()).toHaveTextContent("Monitor(a)");
      await user.click(screen.getByRole("button", { name: "Cancelar" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      await openDialog(user);

      expect(roleSelect()).toHaveTextContent("Escolha o papel");
    });

    it("saves the assignment, gives it to onSaved and closes the dialog, with the focus back on the button", async () => {
      const created = buildLessonAssignment();
      const onSaved = vi.fn();
      const onCall = vi.fn<(call: CreateAssignmentCall) => void>();
      server.use(createAssignmentHandler({ response: created, onCall }));
      const user = userEvent.setup();
      await renderButton({
        member: { id: MEMBER_ID, name: MEMBER_NAME },
        lesson: {
          id: LESSON_ID,
          title: LESSON_TITLE,
          date: "2026-03-10",
          lessonClass: { id: CLASS_ID, label: CLASS_NAME },
        },
        onSaved,
      });
      await openDialog(user);
      await choose(user, roleSelect, "Professor(a)");

      await user.click(screen.getByRole("button", { name: "Salvar alocação" }));

      expect(await screen.findByText("Alocação salva")).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(onSaved).toHaveBeenCalledExactlyOnceWith(created);
      expect(onCall).toHaveBeenCalledExactlyOnceWith({
        id: LESSON_ID,
        body: { personId: MEMBER_ID, role: "teacher", status: "confirmed" },
      });
      await waitFor(() => expect(newAssignmentButton()).toHaveFocus());
    });
  });
});
