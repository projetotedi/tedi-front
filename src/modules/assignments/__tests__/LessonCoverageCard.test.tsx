import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getListLessonAssignmentsQueryKey } from "@api/generated/assignments/assignments";
import { AssignmentRole, AssignmentSource, AssignmentStatus } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { LessonCoverageCard } from "../components/LessonCoverageCard";
import { LessonTeacherName } from "../components/LessonTeacherName";
import { NewAssignmentButton } from "../components/NewAssignmentButton";
import {
  ASSIGNMENT_ID,
  buildClassDetail,
  buildCoverage,
  buildLesson,
  buildLessonAssignment,
  buildMeUser,
  buildMeUserWith,
  buildMemberListItem,
  buildMembersPage,
  CLASS_ID,
  CLASS_NAME,
  createAssignmentHandler,
  getClassHandler,
  getLessonHandler,
  LESSON_ID,
  LESSON_NOT_FOUND_ERROR,
  LESSON_TITLE,
  listLessonAssignmentsHandler,
  listMembersHandler,
  MEMBER_ID,
  MEMBER_NAME,
  OTHER_ASSIGNMENT_ID,
  OTHER_MEMBER_ID,
  SERVER_ERROR,
  THIRD_MEMBER_ID,
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

const TITLE = "Cobertura da aula";
const THIRD_ASSIGNMENT_ID = "01952ef7-0000-7000-8000-0000000000a3";
const FOURTH_ASSIGNMENT_ID = "01952ef7-0000-7000-8000-0000000000a4";

const RAFAEL = { id: OTHER_MEMBER_ID, name: "Rafael Souza" };
const CARLA = { id: "01952ef7-0000-7000-8000-0000000000b4", name: "Carla Menezes" };
const LUCAS = { id: THIRD_MEMBER_ID, name: "Lucas Andrade" };

/** The card (the root with `data-slot="card"`) whose `<h2>` is the title. */
function card(): HTMLElement {
  const root = screen.getByRole("heading", { name: TITLE }).closest("[data-slot='card']");
  if (!(root instanceof HTMLElement)) throw new Error("No card");
  return root;
}

/** The value (`<dd>`) of the pair of the card whose label (`<dt>`) is `label`. */
function valueOf(label: string): HTMLElement {
  const value = within(card()).getByText(label, { selector: "dt" }).nextElementSibling;
  if (!(value instanceof HTMLElement)) throw new Error(`No value for "${label}"`);
  return value;
}

async function renderCard(user = buildMeUser(Role.coordinator)) {
  return renderWithProviders(<LessonCoverageCard lessonId={LESSON_ID} />, { user });
}

/**
 * Waits for the card to leave the skeleton and for its students to be known. The pairs of label and
 * value are drawn as soon as the lesson and the assignments are there, and the students come from the
 * class, which is asked after the lesson and can answer later (the value is a skeleton until then),
 * so a test that looks at the whole card waits for that too.
 */
async function waitForCoverage() {
  // `card()` is looked up on every try: the skeleton and the loaded card are different elements, so a
  // root taken before the data arrives is left out of the document when the card is drawn.
  await waitFor(() => expect(within(card()).getByText("Alunos", { selector: "dt" })).toBeVisible());
  await waitFor(() =>
    expect(within(valueOf("Alunos")).queryByRole("status")).not.toBeInTheDocument(),
  );
}

/** The API as the Figma shows the lesson: 8 students, Beatriz teaching, 3 of 3 monitors, 1 application. */
function useFullCoverage() {
  server.use(
    getLessonHandler({
      response: buildLesson({
        coverage: buildCoverage({ teacher: 1, monitors: 3, expectedMonitors: 3 }),
      }),
    }),
    listLessonAssignmentsHandler({
      response: [
        buildLessonAssignment(),
        buildLessonAssignment({
          id: OTHER_ASSIGNMENT_ID,
          role: AssignmentRole.monitor,
          person: RAFAEL,
        }),
        buildLessonAssignment({
          id: THIRD_ASSIGNMENT_ID,
          role: AssignmentRole.monitor,
          person: CARLA,
        }),
        buildLessonAssignment({
          id: FOURTH_ASSIGNMENT_ID,
          role: AssignmentRole.monitor,
          person: { id: "01952ef7-0000-7000-8000-0000000000b5", name: "Diego Almeida" },
        }),
        buildLessonAssignment({
          id: "01952ef7-0000-7000-8000-0000000000a5",
          role: AssignmentRole.monitor,
          status: AssignmentStatus.pending,
          source: AssignmentSource.application,
          person: LUCAS,
        }),
      ],
    }),
    getClassHandler(),
  );
}

describe("LessonCoverageCard", () => {
  describe("what it shows", () => {
    it("shows students, confirmed teacher, monitors against expected and pending applications", async () => {
      useFullCoverage();
      await renderCard();
      await waitForCoverage();

      expect(valueOf("Alunos")).toHaveTextContent(/^8$/);
      expect(valueOf("Professor(a)")).toHaveTextContent(/^Beatriz Nunes$/);
      expect(valueOf("Monitores")).toHaveTextContent(/^3 de 3$/);
      expect(valueOf("Candidaturas")).toHaveTextContent(/^1$/);
    });

    it("is a card of the screen of the lesson, with its title as a heading of level 2", async () => {
      useFullCoverage();
      await renderCard();

      expect(await screen.findByRole("heading", { level: 2, name: TITLE })).toBeInTheDocument();
    });

    it("lists the four pairs in the order of the Figma", async () => {
      useFullCoverage();
      await renderCard();
      await waitForCoverage();

      expect(
        within(card())
          .getAllByRole("term")
          .map((term) => term.textContent),
      ).toEqual(["Alunos", "Professor(a)", "Monitores", "Candidaturas"]);
    });

    it("flags monitors below expected in text, and not by color alone", async () => {
      server.use(
        getLessonHandler({
          response: buildLesson({
            coverage: buildCoverage({ teacher: 1, monitors: 2, expectedMonitors: 3 }),
          }),
        }),
        listLessonAssignmentsHandler(),
        getClassHandler(),
      );
      await renderCard();
      await waitForCoverage();

      expect(valueOf("Monitores")).toHaveTextContent("2 de 3");
      const tag = within(valueOf("Monitores")).getByText("Abaixo do esperado");
      expect(tag).toHaveClass("bg-tedi-warning");
    });

    it("has no flag when the monitors reach what is expected", async () => {
      useFullCoverage();
      await renderCard();
      await waitForCoverage();

      expect(screen.queryByText("Abaixo do esperado")).not.toBeInTheDocument();
    });

    it("shows only the confirmed count when nothing is expected", async () => {
      server.use(
        getLessonHandler({
          response: buildLesson({
            coverage: buildCoverage({ monitors: 2, expectedMonitors: null }),
          }),
        }),
        listLessonAssignmentsHandler(),
        getClassHandler(),
      );
      await renderCard();
      await waitForCoverage();

      expect(valueOf("Monitores")).toHaveTextContent(/^2$/);
      expect(screen.queryByText(/ de /)).not.toBeInTheDocument();
      expect(screen.queryByText("Abaixo do esperado")).not.toBeInTheDocument();
    });

    it("shows a zero as a value, not as a missing one: no monitors confirmed of two expected", async () => {
      server.use(getLessonHandler(), listLessonAssignmentsHandler(), getClassHandler());
      await renderCard();
      await waitForCoverage();

      expect(valueOf("Monitores")).toHaveTextContent("0 de 2");
      expect(valueOf("Candidaturas")).toHaveTextContent(/^0$/);
    });

    it("takes the number of students from the class of the lesson, and a class with none is a zero", async () => {
      server.use(
        getLessonHandler(),
        listLessonAssignmentsHandler(),
        getClassHandler({
          response: buildClassDetail({
            summary: { ...buildClassDetail().summary, enrolledCount: 0 },
          }),
        }),
      );
      await renderCard();
      await waitForCoverage();

      expect(valueOf("Alunos")).toHaveTextContent(/^0$/);
    });

    it("shows the teacher as a dash that a screen reader reads as Não informado when there is none", async () => {
      server.use(getLessonHandler(), listLessonAssignmentsHandler(), getClassHandler());
      await renderCard();
      await waitForCoverage();

      const teacher = valueOf("Professor(a)");
      expect(within(teacher).getByText("—")).toHaveAttribute("aria-hidden", "true");
      expect(within(teacher).getByText("Não informado")).toHaveClass("sr-only");
    });

    it("does not take a pending teacher for the teacher: she is a candidate", async () => {
      server.use(
        getLessonHandler(),
        listLessonAssignmentsHandler({
          response: [buildLessonAssignment({ status: AssignmentStatus.pending })],
        }),
        getClassHandler(),
      );
      await renderCard();
      await waitForCoverage();

      expect(within(valueOf("Professor(a)")).getByText("Não informado")).toBeInTheDocument();
      expect(screen.queryByText(MEMBER_NAME)).not.toBeInTheDocument();
    });

    it("counts only the applications that wait for an answer", async () => {
      const application = (id: string, status: AssignmentStatus, source: AssignmentSource) =>
        buildLessonAssignment({ id, status, source, role: AssignmentRole.monitor, person: RAFAEL });
      server.use(
        getLessonHandler(),
        listLessonAssignmentsHandler({
          response: [
            application(ASSIGNMENT_ID, AssignmentStatus.pending, AssignmentSource.application),
            application(
              OTHER_ASSIGNMENT_ID,
              AssignmentStatus.pending,
              AssignmentSource.application,
            ),
            // None of these is an application that waits: one was made by a coordinator, the others were decided.
            application(THIRD_ASSIGNMENT_ID, AssignmentStatus.pending, AssignmentSource.direct),
            application(
              FOURTH_ASSIGNMENT_ID,
              AssignmentStatus.declined,
              AssignmentSource.application,
            ),
            application(
              "01952ef7-0000-7000-8000-0000000000a6",
              AssignmentStatus.confirmed,
              AssignmentSource.application,
            ),
          ],
        }),
        getClassHandler(),
      );
      await renderCard();
      await waitForCoverage();

      expect(valueOf("Candidaturas")).toHaveTextContent(/^2$/);
    });

    it("does not draw the link to the applications, which is GUS-161", async () => {
      useFullCoverage();
      await renderCard();
      await waitForCoverage();

      expect(within(card()).queryByRole("link")).not.toBeInTheDocument();
      expect(within(card()).queryByRole("button")).not.toBeInTheDocument();
    });

    it("draws the card with the lesson and the assignments while the class is on its way, with only the students pending", async () => {
      const classAnswer = createDeferred();
      useFullCoverage();
      server.use(getClassHandler({ delay: classAnswer.promise }));
      await renderCard();

      // The lesson and the assignments are there before the class: the card is not held in the skeleton.
      await waitFor(() => expect(valueOf("Professor(a)")).toHaveTextContent("Beatriz Nunes"));
      expect(valueOf("Monitores")).toHaveTextContent(/^3 de 3$/);
      expect(valueOf("Candidaturas")).toHaveTextContent(/^1$/);
      expect(screen.queryByText("Carregando a cobertura da aula…")).not.toBeInTheDocument();
      // Only the students wait, with a small skeleton that a screen reader reads as loading, and not as
      // a value that is missing.
      const pending = within(valueOf("Alunos")).getByRole("status");
      expect(pending).toHaveTextContent("Carregando os alunos…");
      expect(within(valueOf("Alunos")).queryByText("Não informado")).not.toBeInTheDocument();
      const cardWhilePending = card();

      classAnswer.resolve();

      await waitFor(() => expect(valueOf("Alunos")).toHaveTextContent(/^8$/));
      expect(within(valueOf("Alunos")).queryByRole("status")).not.toBeInTheDocument();
      // The same card, with the number where the skeleton was: nothing was mounted again.
      expect(card()).toBe(cardWhilePending);
    });

    it("keeps the rest of the card when the class cannot be read: the students are a dash", async () => {
      server.use(
        getLessonHandler({
          response: buildLesson({
            coverage: buildCoverage({ teacher: 1, monitors: 1, expectedMonitors: 3 }),
          }),
        }),
        listLessonAssignmentsHandler({ response: [buildLessonAssignment()] }),
        getClassHandler({ error: SERVER_ERROR }),
      );
      await renderCard();
      await waitForCoverage();

      const students = valueOf("Alunos");
      expect(within(students).getByText("—")).toHaveAttribute("aria-hidden", "true");
      expect(within(students).getByText("Não informado")).toHaveClass("sr-only");
      expect(valueOf("Professor(a)")).toHaveTextContent("Beatriz Nunes");
      expect(valueOf("Monitores")).toHaveTextContent("1 de 3");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("what it asks", () => {
    it("asks the lesson, its assignments and the class of the lesson, once each", async () => {
      const onLesson = vi.fn<(call: IdCall) => void>();
      const onAssignments = vi.fn<(call: IdCall) => void>();
      const onClass = vi.fn<(call: IdCall) => void>();
      server.use(
        getLessonHandler({ onCall: onLesson }),
        listLessonAssignmentsHandler({ onCall: onAssignments }),
        getClassHandler({ onCall: onClass }),
      );
      await renderCard();
      await waitForCoverage();

      expect(onLesson).toHaveBeenCalledExactlyOnceWith({ id: LESSON_ID });
      expect(onAssignments).toHaveBeenCalledExactlyOnceWith({ id: LESSON_ID });
      expect(onClass).toHaveBeenCalledExactlyOnceWith({ id: CLASS_ID });
    });

    it("asks the class only after it knows the lesson", async () => {
      const lesson = createDeferred();
      const onClass = vi.fn<(call: IdCall) => void>();
      server.use(
        getLessonHandler({ delay: lesson.promise }),
        listLessonAssignmentsHandler(),
        getClassHandler({ onCall: onClass }),
      );
      await renderCard();
      await screen.findByRole("status");

      expect(onClass).not.toHaveBeenCalled();

      lesson.resolve();
      await waitForCoverage();
      expect(onClass).toHaveBeenCalledExactlyOnceWith({ id: CLASS_ID });
    });

    it("shares the request of the assignments with the field Professor(a)", async () => {
      const onAssignments = vi.fn<(call: IdCall) => void>();
      server.use(
        getLessonHandler(),
        listLessonAssignmentsHandler({
          response: [buildLessonAssignment()],
          onCall: onAssignments,
        }),
        getClassHandler(),
      );
      await renderWithProviders(
        <>
          <LessonCoverageCard lessonId={LESSON_ID} />
          <LessonTeacherName lessonId={LESSON_ID} />
        </>,
      );
      await waitForCoverage();

      expect(onAssignments).toHaveBeenCalledTimes(1);
    });
  });

  describe("loading and errors", () => {
    it("shows a skeleton as a status while the coverage is on its way", async () => {
      const assignments = createDeferred();
      server.use(
        getLessonHandler(),
        listLessonAssignmentsHandler({ delay: assignments.promise }),
        getClassHandler(),
      );
      await renderCard();

      expect(await screen.findByRole("status")).toHaveTextContent(
        "Carregando a cobertura da aula…",
      );
      expect(within(card()).queryByRole("term")).not.toBeInTheDocument();

      assignments.resolve();
      await waitForCoverage();
      expect(screen.queryByText("Carregando a cobertura da aula…")).not.toBeInTheDocument();
    });

    it("shows the error with Tentar de novo, which asks again", async () => {
      server.use(
        getLessonHandler(),
        listLessonAssignmentsHandler({ error: SERVER_ERROR }),
        getClassHandler(),
      );
      const user = userEvent.setup();
      await renderCard();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar a cobertura da aula.",
      );
      expect(within(card()).queryByRole("term")).not.toBeInTheDocument();

      server.use(listLessonAssignmentsHandler({ response: [buildLessonAssignment()] }));
      await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

      await waitForCoverage();
      expect(valueOf("Professor(a)")).toHaveTextContent("Beatriz Nunes");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows the same error when the lesson is gone, and when the request never gets an answer", async () => {
      server.use(
        getLessonHandler({ error: LESSON_NOT_FOUND_ERROR }),
        listLessonAssignmentsHandler({ networkError: true }),
        getClassHandler(),
      );
      await renderCard();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar a cobertura da aula.",
      );
      expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
    });

    it("keeps the error of the card to the card: the heading is still there", async () => {
      server.use(getLessonHandler({ error: SERVER_ERROR }), listLessonAssignmentsHandler());
      await renderCard();

      await screen.findByRole("alert");

      expect(screen.getByRole("heading", { level: 2, name: TITLE })).toBeInTheDocument();
    });
  });

  describe("who sees it", () => {
    it.each([
      ["the member", Role.member],
      ["the director", Role.director],
      ["the coordinator", Role.coordinator],
    ])("shows the coverage to %s: everybody with lessons.view sees it", async (_label, role) => {
      useFullCoverage();
      await renderCard(buildMeUser(role));

      await waitForCoverage();
      expect(valueOf("Professor(a)")).toHaveTextContent("Beatriz Nunes");
    });

    it("without lessons.view draws nothing and asks nothing", async () => {
      const onLesson = vi.fn<(call: IdCall) => void>();
      const onAssignments = vi.fn<(call: IdCall) => void>();
      server.use(
        getLessonHandler({ onCall: onLesson }),
        listLessonAssignmentsHandler({ onCall: onAssignments }),
        getClassHandler(),
      );
      const { queryClient } = await renderCard(buildMeUserWith({ "lessons.view": "none" }));

      expect(screen.queryByRole("heading", { name: TITLE })).not.toBeInTheDocument();
      expect(onLesson).not.toHaveBeenCalled();
      expect(onAssignments).not.toHaveBeenCalled();
      expectNoRequestBesidesSession(queryClient);
    });
  });

  describe("after an assignment is saved (CA2)", () => {
    interface Coverage {
      lesson: ReturnType<typeof buildLesson>;
      assignments: ReturnType<typeof buildLessonAssignment>[];
    }

    /**
     * The screen of the lesson as the app will have it: the coverage, and the button that opens the
     * dialog for that lesson. The API answers `before` until the assignment is created, and `after`
     * from then on, as the real one does.
     */
    async function renderCoverageWithButton(
      after: Coverage,
      before: Coverage = {
        lesson: buildLesson({
          coverage: buildCoverage({ teacher: 0, monitors: 0, expectedMonitors: 2 }),
        }),
        assignments: [],
      },
    ) {
      let isSaved = false;
      const onLesson = vi.fn<(call: IdCall) => void>();
      const onAssignments = vi.fn<(call: IdCall) => void>();
      server.use(
        getLessonHandler({
          response: () => (isSaved ? after.lesson : before.lesson),
          onCall: onLesson,
        }),
        listLessonAssignmentsHandler({
          response: () => (isSaved ? after.assignments : before.assignments),
          onCall: onAssignments,
        }),
        getClassHandler(),
        listMembersHandler({ response: buildMembersPage([buildMemberListItem()]) }),
        createAssignmentHandler({
          onCall: () => {
            isSaved = true;
          },
        }),
      );

      await renderWithProviders(
        <>
          <LessonCoverageCard lessonId={LESSON_ID} />
          <NewAssignmentButton
            lesson={{
              id: LESSON_ID,
              title: LESSON_TITLE,
              date: "2026-03-10",
              lessonClass: { id: CLASS_ID, label: CLASS_NAME },
            }}
          />
        </>,
      );
      await waitForCoverage();

      return { onLesson, onAssignments };
    }

    async function allocate(user: UserEvent, role: string) {
      await user.click(screen.getByRole("button", { name: "Nova alocação" }));
      await screen.findByRole("dialog", { name: "Nova alocação de membro" });
      await waitFor(() =>
        expect(screen.queryByText("Carregando os membros…")).not.toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: /\bMembro\b/ }));
      await user.click(await screen.findByRole("option", { name: MEMBER_NAME }));
      await user.click(screen.getByRole("button", { name: /Papel na aula/ }));
      await user.click(await screen.findByRole("option", { name: role }));
      await user.click(screen.getByRole("button", { name: "Salvar alocação" }));
      await screen.findByText("Alocação salva");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    }

    it("updates the coverage after an assignment is saved, without remounting", async () => {
      const user = userEvent.setup();
      const { onLesson, onAssignments } = await renderCoverageWithButton({
        lesson: buildLesson({
          coverage: buildCoverage({ teacher: 1, monitors: 0, expectedMonitors: 2 }),
        }),
        assignments: [buildLessonAssignment()],
      });
      expect(within(valueOf("Professor(a)")).getByText("Não informado")).toBeInTheDocument();
      const cardBefore = card();

      await allocate(user, "Professor(a)");

      // The new teacher is on the card that was already on the screen: it was not mounted again, and
      // the page was not reloaded; the two queries it reads were asked again.
      await waitFor(() => expect(valueOf("Professor(a)")).toHaveTextContent(/^Beatriz Nunes$/));
      expect(card()).toBe(cardBefore);
      await waitFor(() => expect(onLesson).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(onAssignments).toHaveBeenCalledTimes(2));
    });

    it("updates the monitors against the expected: 1 de 2 after a monitor is allocated", async () => {
      const user = userEvent.setup();
      await renderCoverageWithButton({
        lesson: buildLesson({
          coverage: buildCoverage({ teacher: 0, monitors: 1, expectedMonitors: 2 }),
        }),
        assignments: [buildLessonAssignment({ role: AssignmentRole.monitor })],
      });
      expect(valueOf("Monitores")).toHaveTextContent("0 de 2");
      expect(within(valueOf("Monitores")).getByText("Abaixo do esperado")).toBeInTheDocument();

      await allocate(user, "Monitor(a)");

      await waitFor(() => expect(valueOf("Monitores")).toHaveTextContent("1 de 2"));
      // Still below the two that are expected, so the flag stays.
      expect(within(valueOf("Monitores")).getByText("Abaixo do esperado")).toBeInTheDocument();
    });

    it("takes the flag away when the last monitor that was missing is allocated", async () => {
      const user = userEvent.setup();
      await renderCoverageWithButton(
        {
          lesson: buildLesson({
            coverage: buildCoverage({ teacher: 0, monitors: 2, expectedMonitors: 2 }),
          }),
          assignments: [buildLessonAssignment({ role: AssignmentRole.monitor })],
        },
        {
          lesson: buildLesson({
            coverage: buildCoverage({ teacher: 0, monitors: 1, expectedMonitors: 2 }),
          }),
          assignments: [buildLessonAssignment({ role: AssignmentRole.monitor })],
        },
      );
      expect(valueOf("Monitores")).toHaveTextContent("1 de 2");
      expect(screen.getByText("Abaixo do esperado")).toBeInTheDocument();

      await allocate(user, "Monitor(a)");

      await waitFor(() => expect(valueOf("Monitores")).toHaveTextContent("2 de 2"));
      expect(screen.queryByText("Abaixo do esperado")).not.toBeInTheDocument();
    });
  });
});

describe("LessonTeacherName", () => {
  /** The field as the screen of the lesson draws it: the name is the value of the pair of the card. */
  function renderField(user = buildMeUser(Role.coordinator)) {
    return renderWithProviders(
      <dl>
        <dt>Professora</dt>
        <dd>
          <LessonTeacherName lessonId={LESSON_ID} />
        </dd>
      </dl>,
      { user },
    );
  }

  const field = () => screen.getByRole("definition");

  it("shows the name of the confirmed teacher", async () => {
    server.use(listLessonAssignmentsHandler({ response: [buildLessonAssignment()] }));
    await renderField();

    await waitFor(() => expect(field()).toHaveTextContent(/^Beatriz Nunes$/));
  });

  it("shows a dash that a screen reader reads as Não informado when there is no confirmed teacher", async () => {
    server.use(
      listLessonAssignmentsHandler({
        response: [
          buildLessonAssignment({ status: AssignmentStatus.pending }),
          buildLessonAssignment({ id: OTHER_ASSIGNMENT_ID, role: AssignmentRole.monitor }),
        ],
      }),
    );
    await renderField();

    await waitFor(() => expect(within(field()).getByText("Não informado")).toBeInTheDocument());
    expect(within(field()).getByText("—")).toHaveAttribute("aria-hidden", "true");
    expect(within(field()).getByText("Não informado")).toHaveClass("sr-only");
    expect(field()).not.toHaveTextContent("Beatriz Nunes");
  });

  it("asks the assignments of the lesson, and no more than that", async () => {
    const onCall = vi.fn<(call: IdCall) => void>();
    server.use(listLessonAssignmentsHandler({ onCall }));
    await renderField();

    await waitFor(() => expect(within(field()).getByText("Não informado")).toBeInTheDocument());
    expect(onCall).toHaveBeenCalledExactlyOnceWith({ id: LESSON_ID });
  });

  it("is a status with a skeleton while the assignments are on their way", async () => {
    const assignments = createDeferred();
    server.use(
      listLessonAssignmentsHandler({
        response: [buildLessonAssignment()],
        delay: assignments.promise,
      }),
    );
    await renderField();

    expect(await screen.findByRole("status")).toHaveTextContent("Carregando o(a) professor(a)…");
    expect(field()).not.toHaveTextContent("Beatriz Nunes");

    assignments.resolve();
    await waitFor(() => expect(field()).toHaveTextContent(/^Beatriz Nunes$/));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("is the dash, with the failure for the screen reader, when the assignments cannot be loaded", async () => {
    server.use(listLessonAssignmentsHandler({ error: SERVER_ERROR }));
    await renderField();

    await waitFor(() =>
      expect(within(field()).getByText("Não foi possível carregar o(a) professor(a).")).toHaveClass(
        "sr-only",
      ),
    );
    expect(within(field()).getByText("—")).toHaveAttribute("aria-hidden", "true");
  });

  it("without lessons.view asks nothing and is the dash", async () => {
    const onCall = vi.fn<(call: IdCall) => void>();
    server.use(listLessonAssignmentsHandler({ onCall }));
    const { queryClient } = await renderField(buildMeUserWith({ "lessons.view": "none" }));

    expect(within(field()).getByText("Não informado")).toBeInTheDocument();
    expect(onCall).not.toHaveBeenCalled();
    expectNoRequestBesidesSession(queryClient);
  });

  it("changes with the allocation: the teacher of the lesson is the one that is confirmed now", async () => {
    let isSaved = false;
    server.use(
      listLessonAssignmentsHandler({
        response: () => (isSaved ? [buildLessonAssignment()] : []),
      }),
    );
    const { queryClient } = await renderField();
    await waitFor(() => expect(within(field()).getByText("Não informado")).toBeInTheDocument());

    isSaved = true;
    await queryClient.invalidateQueries({ queryKey: getListLessonAssignmentsQueryKey(LESSON_ID) });

    await waitFor(() => expect(field()).toHaveTextContent(/^Beatriz Nunes$/));
  });

  it("names the person the assignment is for, and not the member of the session", async () => {
    server.use(
      listLessonAssignmentsHandler({
        response: [
          buildLessonAssignment({ person: { id: MEMBER_ID, name: "Beatriz Nunes Carvalho" } }),
        ],
      }),
    );
    await renderField(buildMeUser(Role.member));

    await waitFor(() => expect(field()).toHaveTextContent(/^Beatriz Nunes Carvalho$/));
  });
});
