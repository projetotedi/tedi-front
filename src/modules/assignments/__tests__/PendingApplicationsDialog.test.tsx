import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getListMyAssignmentsQueryKey,
  getListPendingApplicationsQueryKey,
} from "@api/generated/assignments/assignments";
import { getGetLessonQueryKey } from "@api/generated/lessons/lessons";
import { LessonStatus } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { PendingApplicationsDialog } from "../components/PendingApplicationsDialog";
import { PENDING_APPLICATIONS_PARAMS } from "../lib/assignment-queries";
import {
  APPLICATION_IDS,
  APPLICATION_NOT_FOUND_ERROR,
  APPLICATION_NOT_PENDING_ERROR,
  approveApplicationHandler,
  buildApplication,
  buildAssignmentLesson,
  buildCarlaApplication,
  buildCoverage,
  buildDiegoApplication,
  buildMeUser,
  buildPendingApplications,
  buildPendingGroup,
  createApplicationsBackend,
  LESSON_CANCELLED_ERROR,
  LESSON_IDS,
  listPendingApplicationsHandler,
  MEMBER_INACTIVE_ERROR,
  rejectApplicationHandler,
  ROLE_FULL_ERROR,
  type PendingApplicationsCall,
  type ReviewApplicationCall,
} from "./application-handlers";
import { createDeferred, server, setupAssignmentsTestServer } from "./test-utils";
import { renderAsMember } from "./application-test-utils";

setupAssignmentsTestServer();

// The queue of the Figma, unless a test says another one: it is registered first, so a handler a
// test adds later is the one that answers.
beforeEach(() => {
  server.use(listPendingApplicationsHandler());
});

const group = () => screen.getByRole("group", { name: /^Candidaturas pendentes/ });
/**
 * The dialog has two buttons named Fechar and does not say which comes first, so neither is found by
 * its place. The one of the footer is the one with the text; the X in the corner has the same name
 * and no text of its own, so it is the other.
 */
const footerClose = () => screen.getByText("Fechar", { selector: "button" });
const cornerClose = () => {
  const footer = footerClose();
  const corner = screen
    .getAllByRole("button", { name: "Fechar" })
    .find((button) => button !== footer);
  if (corner === undefined) throw new Error("The X of the corner was not found.");
  return corner;
};

/** The block of one lesson: a region named by its title. */
const lessonBlock = (name: string) => screen.getByRole("region", { name });
/** The blocks of the dialog (the region of the toasts is outside it). */
const lessonBlocks = () => within(screen.getByRole("dialog")).queryAllByRole("region");

async function renderDialog(title = "Candidaturas pendentes (3)") {
  const onClose = vi.fn();
  const view = await renderAsMember(<PendingApplicationsDialog onClose={onClose} />, {
    user: buildMeUser(Role.coordinator),
  });
  await screen.findByRole("dialog", { name: title });
  return { ...view, onClose };
}

describe("PendingApplicationsDialog", () => {
  describe("the queue", () => {
    it("asks GET /applications?status=pending, once", async () => {
      const onCall = vi.fn<(call: PendingApplicationsCall) => void>();
      server.use(listPendingApplicationsHandler({ onCall }));

      await renderDialog();

      expect(onCall).toHaveBeenCalledExactlyOnceWith({ status: "pending" });
    });

    it("counts the applications in the title, not the lessons", async () => {
      await renderDialog();

      expect(screen.getByRole("dialog")).toHaveAccessibleName("Candidaturas pendentes (3)");
      expect(lessonBlocks()).toHaveLength(2);
    });

    it("groups the applications by lesson, in the order of the API, with the lesson as a heading", async () => {
      server.use(listPendingApplicationsHandler());
      await renderDialog();

      expect(
        screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
      ).toEqual(["Aula 5 · E-mail do zero", "Aula 6 · Golpes e segurança"]);
    });

    it("follows the order the API sends, whatever the lessons are", async () => {
      server.use(
        listPendingApplicationsHandler({
          response: buildPendingApplications([
            buildPendingGroup(5, [buildApplication({ id: "a-1", lessonId: LESSON_IDS[5] })]),
            buildPendingGroup(2, [buildApplication({ id: "a-2", lessonId: LESSON_IDS[2] })]),
          ]),
        }),
      );
      await renderDialog("Candidaturas pendentes (2)");

      expect(
        screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
      ).toEqual(["Aula 6 · Compras on-line", "Aula 5 · Chamadas de vídeo"]);
    });

    it("tells the class, the day, the time and the coverage of each lesson under its title", async () => {
      await renderDialog();

      expect(
        within(lessonBlock("Aula 5 · E-mail do zero")).getByText(
          "Informática Básica — A · 31/03 (ter) · 09:00–11:00 · Professor(a) 0 de 1 · Monitores 2 de 3",
        ),
      ).toBeInTheDocument();
      expect(
        within(lessonBlock("Aula 6 · Golpes e segurança")).getByText(
          "Redes Sociais — C · 02/04 (qui) · 14:00–16:00 · Monitores 0 de 2",
        ),
      ).toBeInTheDocument();
    });

    it("shows each application with who asked and for which role, when it was sent, and the note in quotes", async () => {
      await renderDialog();

      const rows = within(lessonBlock("Aula 5 · E-mail do zero")).getAllByRole("listitem");
      expect(rows).toHaveLength(2);
      expect(within(rows[0]).getByText("Beatriz Nunes · Monitor(a)")).toBeInTheDocument();
      expect(
        within(rows[0]).getByText(
          "Enviada em 20/03 · “Posso chegar 15 min antes para ligar os computadores.”",
        ),
      ).toBeInTheDocument();
      expect(within(rows[1]).getByText("Diego Almeida · Professor(a)")).toBeInTheDocument();
      expect(within(rows[1]).getByText("Enviada em 19/03")).toBeInTheDocument();
    });

    it("shows the day the person who asked saw, in the time zone of the browser", async () => {
      server.use(
        listPendingApplicationsHandler({
          response: buildPendingApplications([
            buildPendingGroup(3, [buildApplication({ createdAt: "2026-03-21T01:30:00.000Z" })]),
          ]),
        }),
      );
      await renderDialog("Candidaturas pendentes (1)");

      expect(screen.getByText(/^Enviada em 20\/03/)).toBeInTheDocument();
    });

    it("keeps the whole note, however long", async () => {
      const note = "Posso ajudar com a parte de ligar os computadores e organizar a sala. "
        .repeat(6)
        .trim();
      server.use(
        listPendingApplicationsHandler({
          response: buildPendingApplications([buildPendingGroup(3, [buildApplication({ note })])]),
        }),
      );
      await renderDialog("Candidaturas pendentes (1)");

      expect(screen.getByText(`Enviada em 20/03 · “${note}”`)).toBeInTheDocument();
    });

    it("says Pessoa removida when the person is gone, and names that in the buttons", async () => {
      server.use(
        listPendingApplicationsHandler({
          response: buildPendingApplications([
            buildPendingGroup(3, [buildApplication({ person: null })]),
          ]),
        }),
      );
      await renderDialog("Candidaturas pendentes (1)");

      expect(screen.getByText("Pessoa removida · Monitor(a)")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Confirmar a candidatura de Pessoa removida" }),
      ).toBeInTheDocument();
    });

    it("names each button by the person, with the visible text in the name", async () => {
      await renderDialog();

      for (const name of ["Beatriz Nunes", "Diego Almeida", "Carla Menezes"]) {
        const confirm = screen.getByRole("button", { name: `Confirmar a candidatura de ${name}` });
        const reject = screen.getByRole("button", { name: `Recusar a candidatura de ${name}` });
        expect(confirm).toHaveTextContent(/^Confirmar$/);
        expect(reject).toHaveTextContent(/^Recusar$/);
        expect(confirm).toHaveClass("button--primary", "min-h-11");
        expect(reject).toHaveClass("button--danger-soft", "min-h-11");
      }
    });

    it("explains what Confirmar and Recusar do, and has Fechar as the way out", async () => {
      const { onClose } = await renderDialog();

      expect(
        screen.getByText(
          "Confirmar aloca o membro na aula com o papel pedido. Recusar libera a vaga e o membro vê a situação em Minhas aulas. Um membro não pode ter dois papéis na mesma aula.",
        ),
      ).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "Fechar" })).toHaveLength(2);
      await userEvent.click(footerClose());
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("closes with Esc and with the X, too", async () => {
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await user.keyboard("{Escape}");
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

      await user.click(cornerClose());
      expect(onClose).toHaveBeenCalledTimes(2);
    });
  });

  describe("states", () => {
    it("shows skeletons announced as a status while the queue is on its way, and the title has no number yet", async () => {
      const deferred = createDeferred();
      server.use(listPendingApplicationsHandler({ delay: deferred.promise }));
      await renderAsMember(<PendingApplicationsDialog onClose={() => {}} />, {
        user: buildMeUser(Role.coordinator),
      });

      const dialog = await screen.findByRole("dialog", { name: "Candidaturas pendentes" });
      expect(within(dialog).getByRole("status")).toHaveTextContent(
        "Carregando as candidaturas pendentes…",
      );
      expect(within(dialog).queryAllByRole("region")).toHaveLength(0);

      deferred.resolve();
      expect(
        await screen.findByRole("dialog", { name: "Candidaturas pendentes (3)" }),
      ).toBeInTheDocument();
    });

    it("says there is no pending application, with 0 in the title and no warning", async () => {
      server.use(listPendingApplicationsHandler({ response: buildPendingApplications([]) }));
      await renderDialog("Candidaturas pendentes (0)");

      expect(screen.getByText("Nenhuma candidatura pendente.")).toBeVisible();
      expect(lessonBlocks()).toHaveLength(0);
      expect(screen.queryByText(/Confirmar aloca o membro/)).not.toBeInTheDocument();
    });

    it("shows the error with Tentar de novo when the queue cannot be read, and the next attempt shows the queue", async () => {
      server.use(listPendingApplicationsHandler({ networkError: true }));
      const user = userEvent.setup();
      await renderAsMember(<PendingApplicationsDialog onClose={() => {}} />, {
        user: buildMeUser(Role.coordinator),
      });

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Não foi possível carregar as candidaturas pendentes.");
      expect(screen.getByRole("dialog")).toHaveAccessibleName("Candidaturas pendentes");

      server.use(listPendingApplicationsHandler());
      await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

      expect(
        await screen.findByRole("dialog", { name: "Candidaturas pendentes (3)" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("Confirmar and Recusar", () => {
    it("Confirmar sends PATCH /applications/:id/approve with the id of that application", async () => {
      const backend = createApplicationsBackend();
      server.use(...backend.handlers);
      const user = userEvent.setup();
      await renderDialog();

      await user.click(
        screen.getByRole("button", { name: "Confirmar a candidatura de Diego Almeida" }),
      );

      await waitFor(() => expect(backend.calls.approved).toEqual([APPLICATION_IDS.diego]));
      expect(backend.calls.rejected).toEqual([]);
    });

    it("Recusar sends PATCH /applications/:id/reject with the id of that application", async () => {
      const backend = createApplicationsBackend();
      server.use(...backend.handlers);
      const user = userEvent.setup();
      await renderDialog();

      await user.click(
        screen.getByRole("button", { name: "Recusar a candidatura de Carla Menezes" }),
      );

      await waitFor(() => expect(backend.calls.rejected).toEqual([APPLICATION_IDS.carla]));
      expect(backend.calls.approved).toEqual([]);
    });

    it("Confirmar shows the toast with who, the role and the day, and the application leaves the queue", async () => {
      server.use(...createApplicationsBackend().handlers);
      const user = userEvent.setup();
      await renderDialog();

      await user.click(
        screen.getByRole("button", { name: "Confirmar a candidatura de Beatriz Nunes" }),
      );

      expect(await screen.findByText("Candidatura confirmada")).toBeInTheDocument();
      expect(screen.getByText("Beatriz Nunes · Monitor(a) em 31/03 (ter)")).toBeInTheDocument();
      expect(
        await screen.findByRole("dialog", { name: "Candidaturas pendentes (2)" }),
      ).toBeInTheDocument();
      expect(screen.queryByText("Beatriz Nunes · Monitor(a)")).not.toBeInTheDocument();
      expect(screen.getByText("Diego Almeida · Professor(a)")).toBeInTheDocument();
    });

    it("Recusar shows the toast and the application leaves the queue, with the coverage as it was", async () => {
      server.use(...createApplicationsBackend().handlers);
      const user = userEvent.setup();
      await renderDialog();

      await user.click(
        screen.getByRole("button", { name: "Recusar a candidatura de Beatriz Nunes" }),
      );

      expect(await screen.findByText("Candidatura recusada")).toBeInTheDocument();
      expect(screen.getByText("Beatriz Nunes · Monitor(a) em 31/03 (ter)")).toBeInTheDocument();
      await screen.findByRole("dialog", { name: "Candidaturas pendentes (2)" });
      expect(
        within(lessonBlock("Aula 5 · E-mail do zero")).getByText(
          /Professor\(a\) 0 de 1 · Monitores 2 de 3$/,
        ),
      ).toBeInTheDocument();
    });

    it("a lesson with no application left leaves the queue with its application", async () => {
      server.use(...createApplicationsBackend().handlers);
      const user = userEvent.setup();
      await renderDialog();

      await user.click(
        screen.getByRole("button", { name: "Confirmar a candidatura de Carla Menezes" }),
      );

      await screen.findByRole("dialog", { name: "Candidaturas pendentes (2)" });
      expect(
        screen.queryByRole("region", { name: "Aula 6 · Golpes e segurança" }),
      ).not.toBeInTheDocument();
      expect(lessonBlocks()).toHaveLength(1);
    });

    it("tells the cache: the queue, the agenda, the lists of lessons, the detail and the calendar of that lesson", async () => {
      server.use(...createApplicationsBackend().handlers);
      const user = userEvent.setup();
      const { queryClient } = await renderDialog();
      const agendaKey = getListMyAssignmentsQueryKey({ from: "2026-03-01", to: "2026-03-31" });
      const lessonKey = getGetLessonQueryKey(LESSON_IDS[3]);
      const otherLessonKey = getGetLessonQueryKey(LESSON_IDS[4]);
      const listKey = ["/lessons", { page: 1 }] as const;
      queryClient.setQueryData(agendaKey, {});
      queryClient.setQueryData(lessonKey, {});
      queryClient.setQueryData(otherLessonKey, {});
      queryClient.setQueryData(listKey, {});

      await user.click(
        screen.getByRole("button", { name: "Confirmar a candidatura de Beatriz Nunes" }),
      );
      await screen.findByText("Candidatura confirmada");

      const invalidated = (key: readonly unknown[]) =>
        queryClient.getQueryState(key)?.isInvalidated;
      expect(invalidated(agendaKey)).toBe(true);
      expect(invalidated(lessonKey)).toBe(true);
      expect(invalidated(listKey)).toBe(true);
      expect(invalidated(otherLessonKey)).toBe(false);
      // The queue was read again and has the new state: it is not out of date any more.
      expect(
        queryClient.getQueryState(getListPendingApplicationsQueryKey(PENDING_APPLICATIONS_PARAMS))
          ?.isInvalidated,
      ).toBe(false);
    });

    it("moves the focus to the list when the pressed button leaves with its row", async () => {
      server.use(...createApplicationsBackend().handlers);
      const user = userEvent.setup();
      await renderDialog();

      await user.click(
        screen.getByRole("button", { name: "Confirmar a candidatura de Beatriz Nunes" }),
      );

      await screen.findByRole("dialog", { name: "Candidaturas pendentes (2)" });
      await waitFor(() => expect(group()).toHaveFocus());
      expect(group()).toHaveAccessibleName("Candidaturas pendentes (2)");
    });

    it("moves the focus to the message when the last application leaves and the queue is empty", async () => {
      server.use(
        ...createApplicationsBackend({
          groups: [buildPendingGroup(3, [buildApplication()])],
        }).handlers,
      );
      const user = userEvent.setup();
      await renderDialog("Candidaturas pendentes (1)");

      await user.click(
        screen.getByRole("button", { name: "Recusar a candidatura de Beatriz Nunes" }),
      );

      const message = await screen.findByText("Nenhuma candidatura pendente.");
      await waitFor(() => expect(message).toHaveFocus());
      expect(screen.getByRole("dialog")).toHaveAccessibleName("Candidaturas pendentes (0)");
    });

    it("turns the other rows and Fechar off, shows the loading on the pressed button only, and keeps the dialog shut while the request is on its way", async () => {
      const response = createDeferred();
      const onCall = vi.fn<(call: ReviewApplicationCall) => void>();
      const backend = createApplicationsBackend();
      server.use(
        approveApplicationHandler({ delay: response.promise, onCall }),
        ...backend.handlers,
      );
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      const confirmBeatriz = screen.getByRole("button", {
        name: "Confirmar a candidatura de Beatriz Nunes",
      });
      await user.click(confirmBeatriz);
      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));

      expect(confirmBeatriz).toHaveAttribute("aria-disabled", "true");
      expect(confirmBeatriz.querySelector("[data-slot='spinner']")).toBeInTheDocument();
      const rejectBeatriz = screen.getByRole("button", {
        name: "Recusar a candidatura de Beatriz Nunes",
      });
      expect(rejectBeatriz).toBeDisabled();
      expect(rejectBeatriz.querySelector("[data-slot='spinner']")).not.toBeInTheDocument();
      for (const name of ["Diego Almeida", "Carla Menezes"]) {
        expect(
          screen.getByRole("button", { name: `Confirmar a candidatura de ${name}` }),
        ).toBeDisabled();
        expect(
          screen.getByRole("button", { name: `Recusar a candidatura de ${name}` }),
        ).toBeDisabled();
      }
      expect(footerClose()).toBeDisabled();
      expect(cornerClose()).toBeDisabled();

      await user.keyboard("{Escape}");
      await user.click(cornerClose());
      await user.click(confirmBeatriz);
      expect(onClose).not.toHaveBeenCalled();
      expect(onCall).toHaveBeenCalledTimes(1);

      response.resolve();
      await screen.findByText("Candidatura confirmada");
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Confirmar a candidatura de Diego Almeida" }),
        ).toBeEnabled(),
      );
      expect(onCall).toHaveBeenCalledTimes(1);
    });
  });

  describe("a cancelled lesson", () => {
    const cancelledQueue = () =>
      buildPendingApplications([
        buildPendingGroup(3, [buildApplication(), buildDiegoApplication()], {
          lesson: buildAssignmentLesson(3, { status: LessonStatus.cancelled }),
        }),
        buildPendingGroup(4, [buildCarlaApplication()]),
      ]);

    it("shows the tag Cancelada and says it can only be declined, on that lesson only", async () => {
      server.use(listPendingApplicationsHandler({ response: cancelledQueue() }));
      await renderDialog();

      const cancelled = within(lessonBlock("Aula 5 · E-mail do zero"));
      expect(cancelled.getByText("Cancelada")).toHaveClass("bg-danger-soft");
      expect(cancelled.getByText("Aula cancelada: só é possível recusar.")).toBeVisible();
      const other = within(lessonBlock("Aula 6 · Golpes e segurança"));
      expect(other.queryByText("Cancelada")).not.toBeInTheDocument();
      expect(other.queryByText("Aula cancelada: só é possível recusar.")).not.toBeInTheDocument();
    });

    it("turns Confirmar off on every application of the lesson, tied to the line that says why, and keeps Recusar", async () => {
      server.use(listPendingApplicationsHandler({ response: cancelledQueue() }));
      await renderDialog();

      for (const name of ["Beatriz Nunes", "Diego Almeida"]) {
        const confirm = screen.getByRole("button", { name: `Confirmar a candidatura de ${name}` });
        expect(confirm).toBeDisabled();
        expect(confirm).toHaveAccessibleDescription("Aula cancelada: só é possível recusar.");
        expect(
          screen.getByRole("button", { name: `Recusar a candidatura de ${name}` }),
        ).toBeEnabled();
      }
      const other = screen.getByRole("button", {
        name: "Confirmar a candidatura de Carla Menezes",
      });
      expect(other).toBeEnabled();
      expect(other).not.toHaveAccessibleDescription();
    });

    it("lets the person decline an application of a cancelled lesson", async () => {
      const backend = createApplicationsBackend({
        groups: cancelledQueue().lessons,
      });
      server.use(...backend.handlers);
      const user = userEvent.setup();
      await renderDialog();

      await user.click(
        screen.getByRole("button", { name: "Recusar a candidatura de Diego Almeida" }),
      );

      await waitFor(() => expect(backend.calls.rejected).toEqual([APPLICATION_IDS.diego]));
      expect(await screen.findByText("Candidatura recusada")).toBeInTheDocument();
    });
  });

  describe("errors of the API", () => {
    async function renderWithRefusal(
      error: Parameters<typeof approveApplicationHandler>[0] extends infer T
        ? T extends { error?: infer E }
          ? E
          : never
        : never,
    ) {
      const onQueue = vi.fn<(call: PendingApplicationsCall) => void>();
      server.use(
        listPendingApplicationsHandler({ onCall: onQueue }),
        approveApplicationHandler({ error }),
      );
      const user = userEvent.setup();
      const view = await renderDialog();
      await user.click(
        screen.getByRole("button", { name: "Confirmar a candidatura de Beatriz Nunes" }),
      );
      return { ...view, onQueue, user };
    }

    it.each([
      [
        "409 APPLICATION_NOT_PENDING",
        APPLICATION_NOT_PENDING_ERROR,
        "Esta candidatura já foi decidida. A lista foi atualizada.",
      ],
      [
        "404 APPLICATION_NOT_FOUND",
        APPLICATION_NOT_FOUND_ERROR,
        "Candidatura não encontrada. Ela pode ter sido removida. A lista foi atualizada.",
      ],
      [
        "409 ROLE_FULL",
        ROLE_FULL_ERROR,
        "A vaga deste papel já foi preenchida. A lista foi atualizada: recuse a candidatura se ela não for mais necessária.",
      ],
      [
        "409 LESSON_CANCELLED",
        LESSON_CANCELLED_ERROR,
        "A aula foi cancelada: só é possível recusar a candidatura.",
      ],
    ])(
      "%s shows the alert with the focus and reads the queue again, so the list and the coverage are up to date",
      async (_label, error, text) => {
        const { onQueue, onClose } = await renderWithRefusal(error);

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent(text);
        await waitFor(() => expect(alert.parentElement).toHaveFocus());
        await waitFor(() => expect(onQueue).toHaveBeenCalledTimes(2));
        expect(onClose).not.toHaveBeenCalled();
        // The dialog is still usable: nothing is left turned off.
        expect(
          screen.getByRole("button", { name: "Confirmar a candidatura de Diego Almeida" }),
        ).toBeEnabled();
      },
    );

    it.each([
      [
        "409 MEMBER_INACTIVE",
        MEMBER_INACTIVE_ERROR,
        "O cadastro deste membro não está ativo, então a candidatura não pode ser confirmada.",
      ],
      [
        "an error nobody expected",
        { statusCode: 500, error: "INTERNAL", message: "boom" },
        "Não foi possível concluir a ação. Tente novamente.",
      ],
    ])("%s shows the alert, and the queue is not read again", async (_label, error, text) => {
      const { onQueue } = await renderWithRefusal(error);

      expect(await screen.findByRole("alert")).toHaveTextContent(text);
      expect(onQueue).toHaveBeenCalledTimes(1);
    });

    it("shows a network failure as an alert, and the next attempt clears it and decides", async () => {
      const backend = createApplicationsBackend();
      server.use(approveApplicationHandler({ networkError: true }), ...backend.handlers);
      const user = userEvent.setup();
      await renderDialog();

      await user.click(
        screen.getByRole("button", { name: "Confirmar a candidatura de Beatriz Nunes" }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível conectar. Verifique sua conexão e tente novamente.",
      );

      server.use(...backend.handlers);
      await user.click(
        screen.getByRole("button", { name: "Confirmar a candidatura de Beatriz Nunes" }),
      );

      expect(await screen.findByText("Candidatura confirmada")).toBeInTheDocument();
      await waitFor(() =>
        expect(within(screen.getByRole("dialog")).queryByRole("alert")).not.toBeInTheDocument(),
      );
    });

    it("shows the refusal of Recusar the same way", async () => {
      server.use(
        listPendingApplicationsHandler(),
        rejectApplicationHandler({ error: APPLICATION_NOT_PENDING_ERROR }),
      );
      const user = userEvent.setup();
      await renderDialog();

      await user.click(
        screen.getByRole("button", { name: "Recusar a candidatura de Carla Menezes" }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Esta candidatura já foi decidida. A lista foi atualizada.",
      );
    });

    it("keeps the queue on the screen when it is read again and the reading fails", async () => {
      server.use(
        listPendingApplicationsHandler(),
        approveApplicationHandler({ error: ROLE_FULL_ERROR }),
      );
      const user = userEvent.setup();
      await renderDialog();

      server.use(listPendingApplicationsHandler({ networkError: true }));
      await user.click(
        screen.getByRole("button", { name: "Confirmar a candidatura de Beatriz Nunes" }),
      );

      await screen.findByRole("alert");
      expect(lessonBlocks()).toHaveLength(2);
      expect(screen.getByText("Beatriz Nunes · Monitor(a)")).toBeInTheDocument();
    });
  });

  describe("coverage", () => {
    it("leaves the teacher out of the coverage of a lesson that has one, and says Equipe completa when nothing is left", async () => {
      server.use(
        listPendingApplicationsHandler({
          response: buildPendingApplications([
            buildPendingGroup(3, [buildApplication()], {
              coverage: buildCoverage({
                teacher: { confirmed: 1 },
                monitors: { confirmed: 0, expected: null },
              }),
            }),
          ]),
        }),
      );
      await renderDialog("Candidaturas pendentes (1)");

      expect(
        within(lessonBlock("Aula 5 · E-mail do zero")).getByText(/· Equipe completa$/),
      ).toBeInTheDocument();
    });
  });
});
