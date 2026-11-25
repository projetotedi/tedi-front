import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  getListLessonAssignmentsQueryKey,
  getListMyAssignmentsQueryKey,
  getListOpenLessonsQueryKey,
  getListPendingApplicationsQueryKey,
} from "@api/generated/assignments/assignments";
import { AssignmentRole, type OpenLessonResponseDto } from "@api/generated/model";
import { getGetLessonQueryKey } from "@api/generated/lessons/lessons";
import { Role } from "@shared/lib/role";

import { ApplyToLessonDialog } from "../components/ApplyToLessonDialog";
import { PENDING_APPLICATIONS_PARAMS } from "../lib/assignment-queries";
import {
  ALREADY_APPLIED_ERROR,
  applyToLessonHandler,
  buildApplication,
  buildCoverage,
  buildMeUser,
  buildOpenLesson,
  LESSON_CANCELLED_ERROR,
  LESSON_IDS,
  LESSON_IN_PAST_ERROR,
  LESSON_NOT_FOUND_ERROR,
  MEMBER_INACTIVE_ERROR,
  ROLE_FULL_ERROR,
  VALIDATION_ERROR,
  type ApplyToLessonCall,
} from "./application-handlers";
import { createDeferred, server, setupAssignmentsTestServer } from "./test-utils";
import { renderAsMember } from "./application-test-utils";

setupAssignmentsTestServer();

/** "Aula 5 · E-mail do zero", 31/03 (ter), "Informática Básica — A", with both roles open. */
const OPEN_LESSON = buildOpenLesson(3);
const LESSON_ID = LESSON_IDS[3];

const button = (name: string | RegExp) => screen.getByRole("button", { name });
const roleGroup = () => screen.getByRole("radiogroup", { name: "Papel na aula" });
const monitor = () => screen.getByRole("radio", { name: "Monitor(a)" });
const teacher = () => screen.getByRole("radio", { name: "Professor(a)" });
const noteField = () => screen.getByRole("textbox", { name: "Observação para quem vai aprovar" });
const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(button("Enviar candidatura"));

async function renderApply(openLesson: OpenLessonResponseDto = OPEN_LESSON) {
  const onClose = vi.fn();
  const onApplied = vi.fn();
  const view = await renderAsMember(
    <ApplyToLessonDialog openLesson={openLesson} onClose={onClose} onApplied={onApplied} />,
    { user: buildMeUser(Role.member) },
  );
  await screen.findByRole("dialog", { name: "Candidatar-se à aula" });
  return { ...view, onClose, onApplied };
}

describe("ApplyToLessonDialog", () => {
  describe("layout", () => {
    it("shows the title, the summary of the lesson and its vacancies", async () => {
      await renderApply();

      const dialog = screen.getByRole("dialog", { name: "Candidatar-se à aula" });
      expect(dialog).toHaveClass("max-w-160");
      expect(within(dialog).getByText("Aula 5 · E-mail do zero")).toHaveClass("font-semibold");
      expect(
        within(dialog).getByText(
          "Informática Básica — A · 31/03 (ter) · 09:00–11:00 · Laboratório 2",
        ),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByText("Vagas: Professor(a) 0 de 1 · Monitores 2 de 3"),
      ).toBeInTheDocument();
    });

    it("leaves the place out of the summary when the lesson has none", async () => {
      await renderApply(buildOpenLesson(4));

      expect(screen.getByText("Redes Sociais — C · 02/04 (qui) · 14:00–16:00")).toBeInTheDocument();
    });

    it("writes only the monitors in the vacancies when the lesson has a teacher", async () => {
      await renderApply(
        buildOpenLesson(4, {
          coverage: buildCoverage({
            teacher: { confirmed: 1 },
            monitors: { confirmed: 0, expected: 2 },
          }),
          openRoles: [AssignmentRole.monitor],
        }),
      );

      expect(screen.getByText("Vagas: Monitores 0 de 2")).toBeInTheDocument();
    });

    it("shows the role as a required group of two radios, Monitor(a) first, each with its description", async () => {
      await renderApply();

      expect(roleGroup()).toBeRequired();
      expect(
        within(roleGroup())
          .getAllByRole("radio")
          .map((radio) => radio.closest("label")?.textContent),
      ).toEqual(["Monitor(a)", "Professor(a)"]);
      expect(monitor()).toHaveAccessibleDescription("Apoia os alunos individualmente");
      expect(teacher()).toHaveAccessibleDescription("Conduz a aula");
    });

    it("shows the note, optional, with the example of the Figma as the placeholder", async () => {
      await renderApply();

      expect(noteField()).not.toBeRequired();
      expect(noteField()).toHaveAccessibleDescription("Opcional.");
      expect(noteField()).toHaveAttribute(
        "placeholder",
        "Posso chegar 15 min antes para ligar os computadores.",
      );
    });

    it("shows the notice that the board or the coordination decides, and Voltar and Enviar candidatura", async () => {
      await renderApply();

      const dialog = screen.getByRole("dialog");
      expect(
        within(dialog).getByText(
          "A diretoria ou a coordenação confirma ou recusa a candidatura, e você acompanha a situação em Minhas aulas. Não é possível ser professor(a) e monitor(a) na mesma aula.",
        ),
      ).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Voltar" })).toHaveClass(
        "button--secondary",
      );
      expect(within(dialog).getByRole("button", { name: "Enviar candidatura" })).toHaveClass(
        "button--primary",
      );
      expect(within(dialog).getByRole("button", { name: "Fechar" })).toBeInTheDocument();
    });

    it("has no alert until something goes wrong", async () => {
      await renderApply();

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("the role", () => {
    it("turns the role with no vacancy off and says why, and starts with the one that is open chosen", async () => {
      await renderApply(buildOpenLesson(3, { openRoles: [AssignmentRole.monitor] }));

      expect(teacher()).toBeDisabled();
      expect(teacher()).toHaveAccessibleDescription("Conduz a aula · Sem vaga nesta aula");
      expect(monitor()).toBeEnabled();
      expect(monitor()).toBeChecked();
    });

    it("turns Monitor(a) off when only the teacher place is open, and starts with Professor(a) chosen", async () => {
      await renderApply(buildOpenLesson(3, { openRoles: [AssignmentRole.teacher] }));

      expect(monitor()).toBeDisabled();
      expect(monitor()).toHaveAccessibleDescription(
        "Apoia os alunos individualmente · Sem vaga nesta aula",
      );
      expect(teacher()).toBeChecked();
    });

    it("does not choose for the person when both roles are open", async () => {
      await renderApply();

      expect(monitor()).toBeEnabled();
      expect(teacher()).toBeEnabled();
      expect(monitor()).not.toBeChecked();
      expect(teacher()).not.toBeChecked();
    });

    it("does not let the arrow keys or a click reach the role with no vacancy", async () => {
      const onCall = vi.fn();
      server.use(applyToLessonHandler({ onCall }));
      const user = userEvent.setup();
      await renderApply(buildOpenLesson(3, { openRoles: [AssignmentRole.monitor] }));

      await user.click(screen.getByText("Professor(a)"));
      monitor().focus();
      await user.keyboard("{ArrowDown}");

      expect(teacher()).not.toBeChecked();
      expect(monitor()).toBeChecked();
      expect(onCall).not.toHaveBeenCalled();
    });

    it("refuses sending with no role chosen: the error is on the group, the focus is in it and nothing is sent", async () => {
      const onCall = vi.fn();
      server.use(applyToLessonHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderApply();

      await submit(user);

      expect(await screen.findByText("Escolha o papel na aula.")).toBeInTheDocument();
      expect(roleGroup()).toHaveAttribute("aria-invalid", "true");
      expect(roleGroup()).toHaveAccessibleDescription("Escolha o papel na aula.");
      await waitFor(() =>
        expect(roleGroup()).toContainElement(document.activeElement as HTMLElement),
      );
      expect(monitor()).toHaveFocus();
      expect(onCall).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("clears the error when the person chooses a role", async () => {
      const user = userEvent.setup();
      await renderApply();
      await submit(user);
      await screen.findByText("Escolha o papel na aula.");

      await user.click(screen.getByText("Monitor(a)"));

      await waitFor(() =>
        expect(screen.queryByText("Escolha o papel na aula.")).not.toBeInTheDocument(),
      );
      expect(monitor()).toBeChecked();
    });
  });

  describe("the note", () => {
    it("refuses a note longer than 500 characters, on the note, and sends nothing", async () => {
      const onCall = vi.fn();
      server.use(applyToLessonHandler({ onCall }));
      const user = userEvent.setup();
      await renderApply();
      await user.click(screen.getByText("Monitor(a)"));
      await user.click(noteField());
      await user.paste("a".repeat(501));

      await submit(user);

      expect(
        await screen.findByText("A observação pode ter no máximo 500 caracteres."),
      ).toBeInTheDocument();
      expect(noteField()).toHaveAttribute("aria-invalid", "true");
      expect(noteField()).toHaveFocus();
      expect(onCall).not.toHaveBeenCalled();
    });
  });

  describe("applying", () => {
    it("sends POST /lessons/:id/applications with the role and a blank note as null", async () => {
      const onCall = vi.fn<(call: ApplyToLessonCall) => void>();
      server.use(applyToLessonHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderApply();
      await user.click(screen.getByText("Monitor(a)"));

      await submit(user);

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledExactlyOnceWith({
        id: LESSON_ID,
        body: { role: "monitor", note: null },
      });
    });

    it("sends the note without the spaces around it", async () => {
      const onCall = vi.fn<(call: ApplyToLessonCall) => void>();
      server.use(applyToLessonHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderApply();
      await user.click(screen.getByText("Professor(a)"));
      await user.type(noteField(), "  Posso chegar 15 min antes.  ");

      await submit(user);

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledExactlyOnceWith({
        id: LESSON_ID,
        body: { role: "teacher", note: "Posso chegar 15 min antes." },
      });
    });

    it("sends a note of only spaces as null", async () => {
      const onCall = vi.fn<(call: ApplyToLessonCall) => void>();
      server.use(applyToLessonHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderApply();
      await user.click(screen.getByText("Monitor(a)"));
      await user.type(noteField(), "     ");

      await submit(user);

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCall.mock.calls[0][0].body).toEqual({ role: "monitor", note: null });
    });

    it("sends the only role that is open without the person choosing it", async () => {
      const onCall = vi.fn<(call: ApplyToLessonCall) => void>();
      server.use(applyToLessonHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderApply(
        buildOpenLesson(3, { openRoles: [AssignmentRole.monitor] }),
      );

      await submit(user);

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCall.mock.calls[0][0].body).toEqual({ role: "monitor", note: null });
    });

    it("shows the toast Candidatura enviada with the role and the day and month, then tells the page and closes", async () => {
      const application = buildApplication({ id: "01952ef7-0000-7000-8000-0000000000a9" });
      server.use(applyToLessonHandler({ response: application }));
      const user = userEvent.setup();
      const { onClose, onApplied } = await renderApply();
      await user.click(screen.getByText("Monitor(a)"));

      await submit(user);

      expect(await screen.findByText("Candidatura enviada")).toBeInTheDocument();
      expect(
        screen.getByText(
          "A diretoria ou a coordenação vai confirmar sua participação como monitor(a) em 31/03.",
        ),
      ).toBeInTheDocument();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onApplied).toHaveBeenCalledExactlyOnceWith(application);
    });

    it("names the role that was chosen in the toast", async () => {
      server.use(applyToLessonHandler());
      const user = userEvent.setup();
      await renderApply();
      await user.click(screen.getByText("Professor(a)"));

      await submit(user);

      expect(
        await screen.findByText(
          "A diretoria ou a coordenação vai confirmar sua participação como professor(a) em 31/03.",
        ),
      ).toBeInTheDocument();
    });

    it("tells the cache: the agenda, the lessons with a vacancy, the queue and the lesson assignments are out of date, and the coverage is left alone", async () => {
      server.use(applyToLessonHandler());
      const user = userEvent.setup();
      const { queryClient } = await renderApply();
      const keys = {
        agenda: [...getListMyAssignmentsQueryKey({ from: "2026-03-01", to: "2026-03-31" })],
        open: [...getListOpenLessonsQueryKey()],
        queue: [...getListPendingApplicationsQueryKey(PENDING_APPLICATIONS_PARAMS)],
        assignments: [...getListLessonAssignmentsQueryKey(LESSON_ID)],
        otherAssignments: [...getListLessonAssignmentsQueryKey(LESSON_IDS[4])],
        lesson: [...getGetLessonQueryKey(LESSON_ID)],
      };
      for (const key of Object.values(keys)) queryClient.setQueryData(key, {});
      await user.click(screen.getByText("Monitor(a)"));

      await submit(user);
      await screen.findByText("Candidatura enviada");

      const invalidated = (key: readonly unknown[]) =>
        queryClient.getQueryState(key)?.isInvalidated;
      expect(invalidated(keys.agenda)).toBe(true);
      expect(invalidated(keys.open)).toBe(true);
      expect(invalidated(keys.queue)).toBe(true);
      expect(invalidated(keys.assignments)).toBe(true);
      expect(invalidated(keys.otherAssignments)).toBe(false);
      expect(invalidated(keys.lesson)).toBe(false);
    });

    it("Voltar closes without sending anything", async () => {
      const onCall = vi.fn();
      server.use(applyToLessonHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose, onApplied } = await renderApply();
      await user.click(screen.getByText("Monitor(a)"));

      await user.click(button("Voltar"));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onApplied).not.toHaveBeenCalled();
      expect(onCall).not.toHaveBeenCalled();
    });

    it("Esc and the close button close it too", async () => {
      const user = userEvent.setup();
      const { onClose } = await renderApply();

      await user.keyboard("{Escape}");
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

      await user.click(button("Fechar"));
      expect(onClose).toHaveBeenCalledTimes(2);
    });

    it("keeps the dialog shut and ignores a second press while the request is on its way", async () => {
      const response = createDeferred();
      const onCall = vi.fn<(call: ApplyToLessonCall) => void>();
      server.use(applyToLessonHandler({ delay: response.promise, onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderApply();
      await user.click(screen.getByText("Monitor(a)"));

      await submit(user);
      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));

      await user.keyboard("{Escape}");
      await user.click(button("Fechar"));
      await user.click(button("Voltar"));
      await user.click(button(/Enviando/));
      expect(onClose).not.toHaveBeenCalled();
      expect(button("Voltar")).toBeDisabled();
      expect(button(/Enviando/)).toHaveTextContent("Enviando…");
      expect(document.querySelector("form")).toHaveAttribute("aria-busy", "true");
      expect(onCall).toHaveBeenCalledTimes(1);

      response.resolve();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledTimes(1);
    });
  });

  describe("errors of the API", () => {
    it("turns the role off when the API says it is full (ROLE_FULL), clears the choice, shows the alert with the focus and refreshes the lists", async () => {
      server.use(applyToLessonHandler({ error: ROLE_FULL_ERROR }));
      const user = userEvent.setup();
      const { onClose, queryClient } = await renderApply();
      queryClient.setQueryData(getListOpenLessonsQueryKey(), []);
      await user.click(screen.getByText("Professor(a)"));

      await submit(user);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(
        "Este papel acabou de ser preenchido. Escolha outro papel, se ainda houver vaga, ou volte para ver as aulas com vaga.",
      );
      await waitFor(() => expect(alert.parentElement).toHaveFocus());
      expect(teacher()).toBeDisabled();
      expect(teacher()).toHaveAccessibleDescription("Conduz a aula · Sem vaga nesta aula");
      expect(teacher()).not.toBeChecked();
      expect(monitor()).toBeEnabled();
      expect(monitor()).not.toBeChecked();
      expect(onClose).not.toHaveBeenCalled();
      expect(queryClient.getQueryState(getListOpenLessonsQueryKey())?.isInvalidated).toBe(true);
    });

    it("lets the person choose the other role after ROLE_FULL and send again, which clears the alert", async () => {
      const onCall = vi.fn<(call: ApplyToLessonCall) => void>();
      server.use(applyToLessonHandler({ error: ROLE_FULL_ERROR }));
      const user = userEvent.setup();
      const { onClose } = await renderApply();
      await user.click(screen.getByText("Professor(a)"));
      await submit(user);
      await screen.findByRole("alert");

      server.use(applyToLessonHandler({ onCall }));
      await user.click(screen.getByText("Monitor(a)"));
      await submit(user);

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledExactlyOnceWith({
        id: LESSON_ID,
        body: { role: "monitor", note: null },
      });
      // The toast is a live region too: the alert that goes away is the one inside the dialog.
      expect(within(screen.getByRole("dialog")).queryByRole("alert")).not.toBeInTheDocument();
    });

    it("turns Enviar candidatura off when the only role that was open is full", async () => {
      server.use(applyToLessonHandler({ error: ROLE_FULL_ERROR }));
      const user = userEvent.setup();
      await renderApply(buildOpenLesson(3, { openRoles: [AssignmentRole.monitor] }));

      await submit(user);
      await screen.findByRole("alert");

      expect(monitor()).toBeDisabled();
      expect(teacher()).toBeDisabled();
      expect(button("Enviar candidatura")).toBeDisabled();
    });

    it.each([
      [
        "ALREADY_APPLIED",
        ALREADY_APPLIED_ERROR,
        "Você já tem um lugar nesta aula, como professor(a) ou monitor(a). Acompanhe a situação em Minhas aulas.",
      ],
      ["LESSON_IN_PAST", LESSON_IN_PAST_ERROR, "Esta aula não recebe mais candidaturas."],
      ["LESSON_CANCELLED", LESSON_CANCELLED_ERROR, "Esta aula não recebe mais candidaturas."],
    ])(
      "shows %s as a warning with the focus, turns Enviar candidatura off and refreshes the lists",
      async (_code, error, text) => {
        server.use(applyToLessonHandler({ error }));
        const user = userEvent.setup();
        const { onClose, queryClient } = await renderApply();
        queryClient.setQueryData(getListMyAssignmentsQueryKey(), {});
        await user.click(screen.getByText("Monitor(a)"));

        await submit(user);

        const warning = await screen.findByText(text);
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        await waitFor(() => expect(warning.closest("[tabindex='-1']")).toHaveFocus());
        expect(button("Enviar candidatura")).toBeDisabled();
        expect(button("Enviar candidatura")).toHaveAccessibleDescription(text);
        expect(onClose).not.toHaveBeenCalled();
        expect(queryClient.getQueryState(getListMyAssignmentsQueryKey())?.isInvalidated).toBe(true);
        // Voltar is still the way out.
        await user.click(button("Voltar"));
        expect(onClose).toHaveBeenCalledTimes(1);
      },
    );

    it.each([
      [
        "404 LESSON_NOT_FOUND",
        LESSON_NOT_FOUND_ERROR,
        "Aula não encontrada. Ela pode ter sido removida.",
      ],
      [
        "409 MEMBER_INACTIVE",
        MEMBER_INACTIVE_ERROR,
        "Seu cadastro de membro não está ativo. Fale com a coordenação.",
      ],
    ])("shows %s as an alert", async (_label, error, text) => {
      server.use(applyToLessonHandler({ error }));
      const user = userEvent.setup();
      const { onClose } = await renderApply();
      await user.click(screen.getByText("Monitor(a)"));

      await submit(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(text);
      expect(onClose).not.toHaveBeenCalled();
    });

    it("refreshes the lists when the API says the lesson is gone (404 LESSON_NOT_FOUND), so its row leaves the table behind", async () => {
      server.use(applyToLessonHandler({ error: LESSON_NOT_FOUND_ERROR }));
      const user = userEvent.setup();
      const { onClose, queryClient } = await renderApply();
      const keys = {
        open: [...getListOpenLessonsQueryKey()],
        agenda: [...getListMyAssignmentsQueryKey({ from: "2026-03-01", to: "2026-03-31" })],
        queue: [...getListPendingApplicationsQueryKey(PENDING_APPLICATIONS_PARAMS)],
        assignments: [...getListLessonAssignmentsQueryKey(LESSON_ID)],
      };
      for (const key of Object.values(keys)) queryClient.setQueryData(key, {});
      await user.click(screen.getByText("Monitor(a)"));

      await submit(user);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Aula não encontrada. Ela pode ter sido removida.");
      await waitFor(() => expect(alert.parentElement).toHaveFocus());
      for (const key of Object.values(keys)) {
        expect(queryClient.getQueryState(key)?.isInvalidated, JSON.stringify(key)).toBe(true);
      }
      expect(onClose).not.toHaveBeenCalled();
    });

    it("shows a network failure as the generic alert, and the next attempt clears it and sends", async () => {
      server.use(applyToLessonHandler({ networkError: true }));
      const user = userEvent.setup();
      const { onClose } = await renderApply();
      await user.click(screen.getByText("Monitor(a)"));

      await submit(user);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(
        "Não foi possível conectar. Verifique sua conexão e tente novamente.",
      );
      await waitFor(() => expect(alert.parentElement).toHaveFocus());
      expect(button("Enviar candidatura")).toBeEnabled();

      server.use(applyToLessonHandler());
      await submit(user);

      expect(await screen.findByText("Candidatura enviada")).toBeInTheDocument();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("shows an error nobody expected as the generic alert", async () => {
      server.use(
        applyToLessonHandler({ error: { statusCode: 500, error: "INTERNAL", message: "boom" } }),
      );
      const user = userEvent.setup();
      await renderApply();
      await user.click(screen.getByText("Monitor(a)"));

      await submit(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível enviar a candidatura. Tente novamente.",
      );
    });

    it.each([
      ["role", "Escolha o papel na aula."],
      ["note", "Revise este campo e tente de novo."],
    ])(
      "maps a 400 VALIDATION_FAILED on %s to the field, with the focus on it and the dialog open",
      async (field) => {
        server.use(
          applyToLessonHandler({
            error: VALIDATION_ERROR([{ field, message: "must not be blank" }]),
          }),
        );
        const user = userEvent.setup();
        const { onClose } = await renderApply();
        await user.click(screen.getByText("Monitor(a)"));

        await submit(user);

        expect(await screen.findByText("Revise este campo e tente de novo.")).toBeInTheDocument();
        if (field === "note") {
          expect(noteField()).toHaveAttribute("aria-invalid", "true");
          await waitFor(() => expect(noteField()).toHaveFocus());
        } else {
          expect(roleGroup()).toHaveAttribute("aria-invalid", "true");
          await waitFor(() =>
            expect(roleGroup()).toContainElement(document.activeElement as HTMLElement),
          );
        }
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
      },
    );
  });
});
