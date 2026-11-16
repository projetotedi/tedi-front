import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getGetCourseQueryKey, getGetLessonPlanQueryKey } from "@api/generated/catalog/catalog";

import { DuplicateCourseDialog } from "../components/DuplicateCourseDialog";
import {
  buildCourseCopy,
  buildCourseDetail,
  buildLessonPlanDetail,
  COURSE_ID,
  COURSE_COPY_ID,
  COURSE_NAME_TAKEN_ERROR,
  COURSE_NOT_FOUND_ERROR,
  COURSE_SOCIAL_NETWORKS,
  duplicateCourseHandler,
  LESSON_PLAN_ID,
  VALIDATION_ERROR,
} from "./handlers";
import { createDeferred, renderWithProviders, server, setupCatalogTestServer } from "./test-utils";

setupCatalogTestServer();

const COURSE_NAME = COURSE_SOCIAL_NETWORKS.courseName;
const SUGGESTED_NAME = "Redes Sociais com Segurança (cópia)";
const COPY_PATH = `/courses/${COURSE_COPY_ID}`;

type DialogCourse = Parameters<typeof DuplicateCourseDialog>[0]["course"];

const nameField = () => screen.getByRole("textbox", { name: "Nome do novo curso" });
const submitButton = () => screen.getByRole("button", { name: "Duplicar curso" });
const backButton = () => screen.getByRole("button", { name: "Voltar" });
const dialog = () => screen.getByRole("dialog", { name: "Duplicar curso" });

async function renderDialog(
  course: DialogCourse = { id: COURSE_ID, name: COURSE_NAME, lessonPlanCount: 4 },
) {
  const onClose = vi.fn();
  const view = await renderWithProviders(
    <DuplicateCourseDialog course={course} onClose={onClose} />,
  );
  await screen.findByRole("dialog", { name: "Duplicar curso" });
  return { ...view, onClose };
}

describe("DuplicateCourseDialog", () => {
  describe("layout", () => {
    it("opens the Duplicar curso dialog with the name, what is copied and both buttons", async () => {
      await renderDialog();

      expect(within(dialog()).getByRole("textbox", { name: "Nome do novo curso" })).toBeVisible();
      expect(within(dialog()).getByText("O que é copiado")).toBeInTheDocument();
      expect(within(dialog()).getByRole("button", { name: "Voltar" })).toBeInTheDocument();
      expect(within(dialog()).getByRole("button", { name: "Duplicar curso" })).toBeInTheDocument();
      expect(within(dialog()).getByRole("button", { name: "Fechar" })).toBeInTheDocument();
    });

    it("is the 640px dialog", async () => {
      await renderDialog();

      expect(dialog()).toHaveClass("max-w-160");
    });

    it('fills the name with "<name> (cópia)" and focuses the field', async () => {
      await renderDialog();

      expect(nameField()).toHaveValue(SUGGESTED_NAME);
      expect(nameField()).toHaveFocus();
    });

    it("suggests the name of the course as it is, without escaping what HTML would", async () => {
      await renderDialog({
        id: COURSE_ID,
        name: `Pais & filhos: "d'água" <online>`,
        lessonPlanCount: 4,
      });

      expect(nameField()).toHaveValue(`Pais & filhos: "d'água" <online> (cópia)`);
    });

    it("marks the name as required, with the label and the asterisk of the design system", async () => {
      await renderDialog();

      expect(nameField()).toBeRequired();
      expect(
        screen.getByText("Nome do novo curso").closest("[data-required='true']"),
      ).not.toBeNull();
    });

    it.each([
      [4, "Os 4 planos de aula e a ordem deles."],
      [1, "O 1 plano de aula e a ordem dele."],
      [12, "Os 12 planos de aula e a ordem deles."],
    ])(
      "says what is copied with the number of lesson plans: %s",
      async (lessonPlanCount, sentence) => {
        await renderDialog({ id: COURSE_ID, name: COURSE_NAME, lessonPlanCount });

        expect(
          within(dialog()).getByText(
            `${sentence} Descrição, objetivo e categoria também. Pré-requisitos e turmas não são copiados.`,
          ),
        ).toBeInTheDocument();
      },
    );

    it("says the course has no lesson plans yet, instead of copying zero of them", async () => {
      await renderDialog({ id: COURSE_ID, name: COURSE_NAME, lessonPlanCount: 0 });

      expect(
        within(dialog()).getByText(
          "Este curso ainda não tem planos de aula na sequência. Descrição, objetivo e categoria são copiados. Pré-requisitos e turmas não são copiados.",
        ),
      ).toBeInTheDocument();
      expect(within(dialog()).queryByText(/^Os 0 planos/)).not.toBeInTheDocument();
    });

    it("keeps the 44px targets and the style of the buttons: Voltar is secondary, Duplicar curso is primary", async () => {
      await renderDialog();

      expect(backButton()).toHaveClass("button--secondary", "min-h-11");
      expect(submitButton()).toHaveClass("button--primary", "min-h-11");
      expect(nameField()).toHaveClass("min-h-11");
    });

    it("shows what is copied as static text, without an alert", async () => {
      await renderDialog();

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("duplicating", () => {
    it("sends the suggested name for the course on the screen, and only that", async () => {
      const onCall = vi.fn();
      server.use(duplicateCourseHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog();

      await user.click(submitButton());

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledWith({ id: COURSE_ID, body: { name: SUGGESTED_NAME } });
    });

    it("sends the name that was typed, without the spaces around it", async () => {
      const onCall = vi.fn();
      server.use(duplicateCourseHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog();
      await user.clear(nameField());
      await user.type(nameField(), "  Redes Sociais — turma 2026.2  ");

      await user.click(submitButton());

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledWith({
        id: COURSE_ID,
        body: { name: "Redes Sociais — turma 2026.2" },
      });
    });

    it("sends with Enter in the name field too", async () => {
      const onCall = vi.fn();
      server.use(duplicateCourseHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog();

      await user.keyboard("{Enter}");

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
    });

    it("shows the toast, goes to the detail of the copy and closes", async () => {
      server.use(duplicateCourseHandler({ response: buildCourseCopy() }));
      const user = userEvent.setup();
      const { router, onClose } = await renderDialog();
      expect(router.state.location.pathname).toBe("/");

      await user.click(submitButton());

      expect(await screen.findByText("Curso duplicado")).toBeInTheDocument();
      await waitFor(() => expect(router.state.location.pathname).toBe(COPY_PATH));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("goes to the copy by push, so Voltar of the browser leads back to the original", async () => {
      server.use(duplicateCourseHandler());
      const user = userEvent.setup();
      const { router } = await renderDialog();

      await user.click(submitButton());

      await waitFor(() => expect(router.state.location.pathname).toBe(COPY_PATH));
      expect(router.state.historyAction).toBe("PUSH");
      await router.navigate(-1);
      expect(router.state.location.pathname).toBe("/");
    });

    it("goes to the id that the API answered, not to the one that was copied", async () => {
      const otherId = "01952ef7-0000-7000-8000-0000000000c9";
      server.use(duplicateCourseHandler({ response: buildCourseCopy({ id: otherId }) }));
      const user = userEvent.setup();
      const { router } = await renderDialog();

      await user.click(submitButton());

      await waitFor(() => expect(router.state.location.pathname).toBe(`/courses/${otherId}`));
    });

    it("refreshes the cached courses and lesson plans without a reload", async () => {
      server.use(duplicateCourseHandler());
      const user = userEvent.setup();
      const { queryClient } = await renderDialog();
      const courseKey = getGetCourseQueryKey(COURSE_ID);
      const planKey = getGetLessonPlanQueryKey(LESSON_PLAN_ID);
      queryClient.setQueryData(courseKey, buildCourseDetail());
      queryClient.setQueryData(planKey, buildLessonPlanDetail());

      await user.click(submitButton());

      await screen.findByText("Curso duplicado");
      expect(queryClient.getQueryState(courseKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(planKey)?.isInvalidated).toBe(true);
    });
  });

  describe("validation", () => {
    it("asks for the name when it is empty, on the field and with the focus, and sends nothing", async () => {
      const onCall = vi.fn();
      server.use(duplicateCourseHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog();
      await user.clear(nameField());
      await user.click(dialog());
      expect(nameField()).not.toHaveFocus();

      await user.click(submitButton());

      expect(await screen.findByText("Informe o nome do novo curso.")).toBeInTheDocument();
      expect(nameField()).toHaveAttribute("aria-invalid", "true");
      await waitFor(() => expect(nameField()).toHaveFocus());
      expect(onCall).not.toHaveBeenCalled();
    });

    it("asks for the name when only spaces are typed", async () => {
      const onCall = vi.fn();
      server.use(duplicateCourseHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog();
      await user.clear(nameField());
      await user.type(nameField(), "   ");

      await user.click(submitButton());

      expect(await screen.findByText("Informe o nome do novo curso.")).toBeInTheDocument();
      expect(onCall).not.toHaveBeenCalled();
    });

    it("clears the message as soon as a name is typed", async () => {
      const user = userEvent.setup();
      await renderDialog();
      await user.clear(nameField());
      await user.click(submitButton());
      await screen.findByText("Informe o nome do novo curso.");

      await user.type(nameField(), "Informática");

      await waitFor(() =>
        expect(screen.queryByText("Informe o nome do novo curso.")).not.toBeInTheDocument(),
      );
      expect(nameField()).not.toHaveAttribute("aria-invalid", "true");
    });

    it("refuses a name of 201 characters, on the field and with the focus, and sends nothing", async () => {
      const onCall = vi.fn();
      server.use(duplicateCourseHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog();
      await user.clear(nameField());
      await user.click(nameField());
      await user.paste("a".repeat(201));
      await user.click(dialog());
      expect(nameField()).not.toHaveFocus();

      await user.click(submitButton());

      expect(
        await screen.findByText("O nome pode ter no máximo 200 caracteres."),
      ).toBeInTheDocument();
      expect(nameField()).toHaveAttribute("aria-invalid", "true");
      await waitFor(() => expect(nameField()).toHaveFocus());
      expect(onCall).not.toHaveBeenCalled();
    });

    it("accepts a name of exactly 200 characters", async () => {
      const onCall = vi.fn();
      server.use(duplicateCourseHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog();
      await user.clear(nameField());
      await user.click(nameField());
      await user.paste("a".repeat(200));

      await user.click(submitButton());

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall.mock.calls[0][0].body.name).toHaveLength(200);
    });

    it("does not cut a suggestion that is too long: the field refuses it and the person shortens it", async () => {
      const onCall = vi.fn();
      server.use(duplicateCourseHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog({ id: COURSE_ID, name: "a".repeat(200), lessonPlanCount: 4 });
      expect(nameField()).toHaveValue(`${"a".repeat(200)} (cópia)`);

      await user.click(submitButton());

      expect(
        await screen.findByText("O nome pode ter no máximo 200 caracteres."),
      ).toBeInTheDocument();
      expect(onCall).not.toHaveBeenCalled();

      await user.clear(nameField());
      await user.type(nameField(), "Curso curto");
      await user.click(submitButton());

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
    });
  });

  describe("a name the API does not take", () => {
    it("writes the 409 of a repeated name on the field, with the focus, and keeps the dialog open", async () => {
      server.use(duplicateCourseHandler({ error: COURSE_NAME_TAKEN_ERROR }));
      const user = userEvent.setup();
      const { router, queryClient, onClose } = await renderDialog();
      const courseKey = getGetCourseQueryKey(COURSE_ID);
      queryClient.setQueryData(courseKey, buildCourseDetail());
      await user.click(dialog());
      expect(nameField()).not.toHaveFocus();

      await user.click(submitButton());

      expect(
        await screen.findByText("Já existe um curso com este nome. Escolha outro nome."),
      ).toBeInTheDocument();
      expect(nameField()).toHaveAttribute("aria-invalid", "true");
      await waitFor(() => expect(nameField()).toHaveFocus());
      expect(nameField()).toHaveValue(SUGGESTED_NAME);
      // It is a field error: no alert, no toast, no navigation, the dialog stays and nothing is stale.
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByText("Curso duplicado")).not.toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/");
      expect(onClose).not.toHaveBeenCalled();
      expect(queryClient.getQueryState(courseKey)?.isInvalidated).toBe(false);
      expect(submitButton()).toBeEnabled();
    });

    it("lets the person change the name: the message goes away and the next try goes through", async () => {
      server.use(duplicateCourseHandler({ error: COURSE_NAME_TAKEN_ERROR }));
      const user = userEvent.setup();
      const { router } = await renderDialog();
      await user.click(submitButton());
      await screen.findByText("Já existe um curso com este nome. Escolha outro nome.");

      const onCall = vi.fn();
      server.use(duplicateCourseHandler({ onCall }));
      await user.clear(nameField());
      await user.type(nameField(), "Redes Sociais com Segurança (2026.2)");

      await waitFor(() =>
        expect(
          screen.queryByText("Já existe um curso com este nome. Escolha outro nome."),
        ).not.toBeInTheDocument(),
      );
      await user.click(submitButton());

      await waitFor(() => expect(router.state.location.pathname).toBe(COPY_PATH));
      expect(onCall).toHaveBeenCalledWith({
        id: COURSE_ID,
        body: { name: "Redes Sociais com Segurança (2026.2)" },
      });
    });

    it("writes a validation error that points at the name on the field too", async () => {
      server.use(
        duplicateCourseHandler({
          error: VALIDATION_ERROR([{ field: "name", message: "name must be shorter" }]),
        }),
      );
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await user.click(submitButton());

      expect(await screen.findByText("Revise o nome do novo curso.")).toBeInTheDocument();
      expect(nameField()).toHaveAttribute("aria-invalid", "true");
      await waitFor(() => expect(nameField()).toHaveFocus());
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("shows a validation error that points at no field as the generic alert", async () => {
      server.use(
        duplicateCourseHandler({
          error: VALIDATION_ERROR([{ field: "id", message: "id must be a UUID" }]),
        }),
      );
      const user = userEvent.setup();
      await renderDialog();

      await user.click(submitButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível duplicar o curso. Tente novamente.",
      );
      expect(nameField()).not.toHaveAttribute("aria-invalid", "true");
    });
  });

  describe("errors without a field", () => {
    it.each([
      [
        "the course no longer exists (404)",
        { error: COURSE_NOT_FOUND_ERROR },
        "Não foi possível duplicar: este curso não existe mais.",
      ],
      [
        "there is no connection",
        { networkError: true },
        "Não foi possível duplicar o curso. Verifique sua conexão e tente novamente.",
      ],
      [
        "the server fails (500)",
        { error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" } },
        "Não foi possível duplicar o curso. Tente novamente.",
      ],
      [
        "the permission was revoked (403)",
        { error: { statusCode: 403, error: "FORBIDDEN" } },
        "Não foi possível duplicar o curso. Tente novamente.",
      ],
    ])(
      "when %s: an alert inside the dialog, with the focus, and a next try clears it",
      async (_label, failure, message) => {
        server.use(duplicateCourseHandler(failure));
        const user = userEvent.setup();
        const { router, onClose } = await renderDialog();

        await user.click(submitButton());

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent(message);
        expect(dialog()).toContainElement(alert);
        await waitFor(() => expect(alert.parentElement).toHaveFocus());
        expect(nameField()).not.toHaveAttribute("aria-invalid", "true");
        expect(screen.queryByText("Curso duplicado")).not.toBeInTheDocument();
        expect(router.state.location.pathname).toBe("/");
        expect(onClose).not.toHaveBeenCalled();
        expect(submitButton()).toBeEnabled();
        expect(backButton()).toBeEnabled();

        server.use(duplicateCourseHandler());
        await user.click(submitButton());

        await waitFor(() => expect(router.state.location.pathname).toBe(COPY_PATH));
        // The success toast is a `role="alert"` too, so the error is looked for by its text.
        expect(screen.queryByText(message)).not.toBeInTheDocument();
        expect(await screen.findByText("Curso duplicado")).toBeInTheDocument();
        expect(onClose).toHaveBeenCalledTimes(1);
      },
    );

    it("clears the alert as soon as the next try starts", async () => {
      server.use(duplicateCourseHandler({ networkError: true }));
      const user = userEvent.setup();
      await renderDialog();
      await user.click(submitButton());
      await screen.findByRole("alert");

      const deferred = createDeferred();
      server.use(duplicateCourseHandler({ delay: deferred.promise }));
      await user.click(submitButton());

      await screen.findByRole("button", { name: "Duplicando…" });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      deferred.resolve();
    });
  });

  describe("while duplicating", () => {
    async function startDuplicating() {
      const deferred = createDeferred();
      const onCall = vi.fn();
      server.use(duplicateCourseHandler({ delay: deferred.promise, onCall }));
      const user = userEvent.setup();
      const view = await renderDialog();
      await user.click(submitButton());
      await screen.findByRole("button", { name: "Duplicando…" });
      return { ...view, user, deferred, onCall };
    }

    it("shows the duplicating state, disables Voltar and marks the form as busy", async () => {
      const { deferred } = await startDuplicating();

      expect(screen.getByRole("button", { name: "Duplicando…" })).toBeInTheDocument();
      expect(backButton()).toBeDisabled();
      expect(dialog().querySelector("form")).toHaveAttribute("aria-busy", "true");

      deferred.resolve();
    });

    it("ignores Escape and the close button until the answer arrives", async () => {
      const { user, onClose, deferred, router } = await startDuplicating();

      await user.keyboard("{Escape}");
      await user.click(screen.getByRole("button", { name: "Fechar" }));

      expect(onClose).not.toHaveBeenCalled();
      expect(router.state.location.pathname).toBe("/");

      deferred.resolve();
      await waitFor(() => expect(router.state.location.pathname).toBe(COPY_PATH));
    });

    it("does not send a second request on a double click", async () => {
      const deferred = createDeferred();
      const onCall = vi.fn();
      server.use(duplicateCourseHandler({ delay: deferred.promise, onCall }));
      const user = userEvent.setup();
      const { router } = await renderDialog();

      await user.dblClick(submitButton());
      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      deferred.resolve();

      await waitFor(() => expect(router.state.location.pathname).toBe(COPY_PATH));
      expect(onCall).toHaveBeenCalledTimes(1);
    });

    it("does not send a second request on Enter while the first is on its way", async () => {
      const { user, deferred, onCall, router } = await startDuplicating();

      await user.click(nameField());
      await user.keyboard("{Enter}");

      expect(onCall).toHaveBeenCalledTimes(1);

      deferred.resolve();
      await waitFor(() => expect(router.state.location.pathname).toBe(COPY_PATH));
    });

    it("tells the cache about a copy that arrives after the dialog is gone, but does not take the person away", async () => {
      const { deferred, router, queryClient, unmount, onClose } = await startDuplicating();
      const courseKey = getGetCourseQueryKey(COURSE_ID);
      queryClient.setQueryData(courseKey, buildCourseDetail());

      unmount();
      deferred.resolve();

      await waitFor(() => expect(queryClient.getQueryState(courseKey)?.isInvalidated).toBe(true));
      expect(router.state.location.pathname).toBe("/");
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("closing", () => {
    it("Voltar closes without duplicating", async () => {
      const onCall = vi.fn();
      server.use(duplicateCourseHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose, router } = await renderDialog();

      await user.click(backButton());

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onCall).not.toHaveBeenCalled();
      expect(router.state.location.pathname).toBe("/");
    });

    it("the close button and Escape also close without duplicating", async () => {
      const onCall = vi.fn();
      server.use(duplicateCourseHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await user.click(screen.getByRole("button", { name: "Fechar" }));
      expect(onClose).toHaveBeenCalledTimes(1);

      await user.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledTimes(2);
      expect(onCall).not.toHaveBeenCalled();
    });
  });
});
