import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getGetLessonPlanQueryKey } from "@api/generated/catalog/catalog";

import { ArchiveLessonPlanDialog } from "../components/ArchiveLessonPlanDialog";
import {
  archiveLessonPlanHandler,
  buildArchivedLessonPlan,
  buildLessonPlan,
  LESSON_PLAN_ID,
  NOT_FOUND_ERROR,
  VALIDATION_ERROR,
} from "./handlers";
import { createDeferred, renderWithProviders, server, setupCatalogTestServer } from "./test-utils";

setupCatalogTestServer();

const reasonField = () => screen.getByRole("textbox", { name: "Motivo (opcional)" });
const confirmButton = () => screen.getByRole("button", { name: "Arquivar plano" });
const backButton = () => screen.getByRole("button", { name: "Voltar" });

async function renderDialog() {
  const onClose = vi.fn();
  const onArchived = vi.fn();
  const view = await renderWithProviders(
    <ArchiveLessonPlanDialog
      lessonPlanId={LESSON_PLAN_ID}
      onClose={onClose}
      onArchived={onArchived}
    />,
  );
  await screen.findByRole("dialog", { name: "Arquivar plano de aula" });
  return { ...view, onClose, onArchived };
}

describe("ArchiveLessonPlanDialog", () => {
  describe("layout", () => {
    it("opens the Arquivar plano de aula dialog with the warning, the reason and both buttons", async () => {
      await renderDialog();

      const dialog = screen.getByRole("dialog", { name: "Arquivar plano de aula" });
      expect(
        within(dialog).getByText("Arquivar tira o plano das novas sequências"),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByText(
          "Cursos e aulas que já usam o plano continuam como estão. Nada é excluído (RN-27).",
        ),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByRole("textbox", { name: "Motivo (opcional)" }),
      ).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Voltar" })).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Arquivar plano" })).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Fechar" })).toBeInTheDocument();
    });

    it("is the 640px dialog", async () => {
      await renderDialog();

      expect(screen.getByRole("dialog", { name: "Arquivar plano de aula" })).toHaveClass(
        "max-w-160",
      );
    });

    it("explains where the reason is recorded and suggests an example", async () => {
      await renderDialog();

      expect(reasonField()).toHaveAccessibleDescription("Fica registrado no histórico do plano.");
      expect(reasonField()).toHaveAttribute("placeholder", "Conteúdo revisado em um novo plano.");
    });

    it("marks the reason as optional", async () => {
      await renderDialog();

      expect(reasonField()).not.toBeRequired();
    });

    it("focuses the reason when the dialog opens", async () => {
      await renderDialog();

      expect(reasonField()).toHaveFocus();
    });

    it("uses the danger-soft style for the confirmation and keeps the 44px targets", async () => {
      await renderDialog();

      expect(confirmButton()).toHaveClass("button--danger-soft", "min-h-11");
      expect(backButton()).toHaveClass("button--secondary", "min-h-11");
    });

    it("shows the warning as static text, without a live region", async () => {
      await renderDialog();

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("archiving", () => {
    it("archives without a reason, sending no body", async () => {
      const onCall = vi.fn();
      server.use(archiveLessonPlanHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog();

      await user.click(confirmButton());

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledWith({ id: LESSON_PLAN_ID, body: undefined });
    });

    it("archives with the trimmed reason", async () => {
      const onCall = vi.fn();
      server.use(archiveLessonPlanHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog();
      await user.type(reasonField(), "  Conteúdo revisado em um novo plano.  ");

      await user.click(confirmButton());

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledWith({
        id: LESSON_PLAN_ID,
        body: { reason: "Conteúdo revisado em um novo plano." },
      });
    });

    it("shows the success toast, calls onArchived and closes", async () => {
      const archived = buildArchivedLessonPlan();
      server.use(archiveLessonPlanHandler({ response: archived }));
      const user = userEvent.setup();
      const { onClose, onArchived } = await renderDialog();

      await user.click(confirmButton());

      expect(await screen.findByText("Plano de aula arquivado.")).toBeInTheDocument();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onArchived).toHaveBeenCalledWith(archived);
    });

    it("refreshes the cached lesson plan queries without a reload", async () => {
      server.use(archiveLessonPlanHandler());
      const user = userEvent.setup();
      const { queryClient } = await renderDialog();
      const detailKey = getGetLessonPlanQueryKey(LESSON_PLAN_ID);
      const listKey = ["/lesson-plans", { page: 1 }] as const;
      queryClient.setQueryData(detailKey, buildLessonPlan());
      queryClient.setQueryData(listKey, { data: [] });

      await user.click(confirmButton());

      await screen.findByText("Plano de aula arquivado.");
      expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
    });

    it("Voltar closes without archiving", async () => {
      const onCall = vi.fn();
      server.use(archiveLessonPlanHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await user.click(backButton());

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onCall).not.toHaveBeenCalled();
    });

    it("the close button and Escape also close without archiving", async () => {
      const onCall = vi.fn();
      server.use(archiveLessonPlanHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await user.click(screen.getByRole("button", { name: "Fechar" }));
      expect(onClose).toHaveBeenCalledTimes(1);

      await user.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledTimes(2);
      expect(onCall).not.toHaveBeenCalled();
    });
  });

  describe("validation", () => {
    it("rejects a reason longer than 500 characters, on the field and with the focus", async () => {
      const onCall = vi.fn();
      server.use(archiveLessonPlanHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog();
      await user.click(reasonField());
      await user.paste("a".repeat(501));
      await user.click(screen.getByRole("dialog", { name: "Arquivar plano de aula" }));
      expect(reasonField()).not.toHaveFocus();

      await user.click(confirmButton());

      expect(
        await screen.findByText("O motivo pode ter no máximo 500 caracteres."),
      ).toBeInTheDocument();
      expect(reasonField()).toHaveAttribute("aria-invalid", "true");
      await waitFor(() => expect(reasonField()).toHaveFocus());
      expect(onCall).not.toHaveBeenCalled();
    });

    it("accepts a reason of exactly 500 characters", async () => {
      const onCall = vi.fn();
      server.use(archiveLessonPlanHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog();
      await user.click(reasonField());
      await user.paste("a".repeat(500));

      await user.click(confirmButton());

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
    });
  });

  describe("errors", () => {
    it("maps a server validation error on the reason to the field", async () => {
      server.use(
        archiveLessonPlanHandler({
          error: VALIDATION_ERROR([{ field: "reason", message: "reason must be shorter" }]),
        }),
      );
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await user.click(confirmButton());

      expect(
        await screen.findByText("O motivo pode ter no máximo 500 caracteres."),
      ).toBeInTheDocument();
      await waitFor(() => expect(reasonField()).toHaveFocus());
      expect(onClose).not.toHaveBeenCalled();
    });

    it("shows a network error, keeps the dialog open and lets the user try again", async () => {
      server.use(archiveLessonPlanHandler({ networkError: true }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await user.click(confirmButton());

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(
        "Não foi possível conectar. Verifique sua conexão e tente novamente.",
      );
      await waitFor(() => expect(alert.parentElement).toHaveFocus());
      expect(onClose).not.toHaveBeenCalled();
      expect(confirmButton()).toBeEnabled();

      server.use(archiveLessonPlanHandler());
      await user.click(confirmButton());

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("explains that the plan was not found", async () => {
      server.use(archiveLessonPlanHandler({ error: NOT_FOUND_ERROR }));
      const user = userEvent.setup();
      await renderDialog();

      await user.click(confirmButton());

      expect(await screen.findByRole("alert")).toHaveTextContent("Plano de aula não encontrado.");
    });

    it("shows a generic error for an unexpected failure", async () => {
      server.use(
        archiveLessonPlanHandler({ error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" } }),
      );
      const user = userEvent.setup();
      await renderDialog();

      await user.click(confirmButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível concluir a ação. Tente novamente.",
      );
    });
  });

  describe("while archiving", () => {
    async function startArchiving() {
      const deferred = createDeferred();
      const onCall = vi.fn();
      server.use(archiveLessonPlanHandler({ delay: deferred.promise, onCall }));
      const user = userEvent.setup();
      const view = await renderDialog();
      await user.click(confirmButton());
      await screen.findByRole("button", { name: "Arquivando…" });
      return { ...view, user, deferred, onCall };
    }

    it("shows the archiving state and disables Voltar", async () => {
      const { deferred } = await startArchiving();

      expect(screen.getByRole("button", { name: "Arquivando…" })).toBeInTheDocument();
      expect(backButton()).toBeDisabled();

      deferred.resolve();
    });

    it("ignores Escape and the close button until the answer arrives", async () => {
      const { user, onClose, deferred } = await startArchiving();

      await user.keyboard("{Escape}");
      await user.click(screen.getByRole("button", { name: "Fechar" }));

      expect(onClose).not.toHaveBeenCalled();

      deferred.resolve();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("does not send a second request on a double click", async () => {
      const deferred = createDeferred();
      const onCall = vi.fn();
      server.use(archiveLessonPlanHandler({ delay: deferred.promise, onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await user.dblClick(confirmButton());
      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      deferred.resolve();

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledTimes(1);
    });
  });
});
