import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getGetCourseQueryKey } from "@api/generated/catalog/catalog";

import { ArchiveCourseDialog } from "../components/ArchiveCourseDialog";
import {
  archiveCourseHandler,
  buildArchivedCourse,
  buildCourseDetail,
  classesSummaryHandler,
  COURSE_ARCHIVE_REASON,
  COURSE_ARCHIVED_AT,
  COURSE_ID,
  COURSE_NOT_FOUND_ERROR,
  COURSE_SOCIAL_NETWORKS,
  VALIDATION_ERROR,
} from "./handlers";
import { createDeferred, renderWithProviders, server, setupCatalogTestServer } from "./test-utils";

setupCatalogTestServer();

const KEEPS_TWO =
  "As 2 turmas já criadas continuam como estão e seguem visíveis. O curso sai da lista de opções ao criar turma e pode ser reativado depois.";
const KEEPS_NO_COUNT =
  "As turmas já criadas continuam como estão e seguem visíveis. O curso sai da lista de opções ao criar turma e pode ser reativado depois.";

const dialog = () => screen.getByRole("dialog", { name: "Arquivar curso" });
const reasonField = () => screen.getByRole("textbox", { name: "Motivo (opcional)" });
const confirmButton = () => within(dialog()).getByRole("button", { name: "Arquivar curso" });
const backButton = () => within(dialog()).getByRole("button", { name: "Voltar" });

async function renderDialog({ withSummary = true }: { withSummary?: boolean } = {}) {
  if (withSummary) server.use(classesSummaryHandler());
  const onClose = vi.fn();
  const onArchived = vi.fn();
  const view = await renderWithProviders(
    <ArchiveCourseDialog
      course={{ id: COURSE_ID, name: COURSE_SOCIAL_NETWORKS.courseName }}
      onClose={onClose}
      onArchived={onArchived}
    />,
  );
  await screen.findByRole("dialog", { name: "Arquivar curso" });
  return { ...view, onClose, onArchived };
}

describe("ArchiveCourseDialog", () => {
  describe("layout", () => {
    it("opens with the warning, how many classes stay, the reason and both buttons, as in the Figma", async () => {
      await renderDialog();

      expect(within(dialog()).getByText("Arquivar impede novas turmas")).toBeInTheDocument();
      expect(await within(dialog()).findByText(KEEPS_TWO)).toBeInTheDocument();
      expect(reasonField()).toBeInTheDocument();
      expect(within(dialog()).getByText("Fica registrado no histórico do curso.")).toBeVisible();
      expect(backButton()).toBeInTheDocument();
      expect(confirmButton()).toHaveClass("button--danger-soft");
      expect(within(dialog()).getByRole("button", { name: "Fechar" })).toBeInTheDocument();
    });

    it("asks the classes summary for this course only", async () => {
      const onCall = vi.fn();
      server.use(classesSummaryHandler({ onCall }));
      await renderDialog({ withSummary: false });

      await waitFor(() => expect(onCall).toHaveBeenCalledWith({ courseIds: COURSE_ID }));
    });

    it("says one class in the singular", async () => {
      server.use(classesSummaryHandler({ total: 1 }));
      await renderDialog({ withSummary: false });

      expect(
        await within(dialog()).findByText(/^A 1 turma já criada continua como está/),
      ).toBeInTheDocument();
    });

    it("shows the text without the number while the summary loads and when it fails", async () => {
      const pending = createDeferred();
      server.use(classesSummaryHandler({ delay: pending.promise }));
      const { unmount } = await renderDialog({ withSummary: false });

      expect(within(dialog()).getByText(KEEPS_NO_COUNT)).toBeInTheDocument();
      pending.resolve();
      unmount();

      server.use(
        classesSummaryHandler({ error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" } }),
      );
      await renderDialog({ withSummary: false });

      expect(within(dialog()).getByText(KEEPS_NO_COUNT)).toBeInTheDocument();
      // The archive does not depend on the summary.
      expect(confirmButton()).toBeEnabled();
    });

    it("focuses the reason when it opens", async () => {
      await renderDialog();

      expect(reasonField()).toHaveFocus();
    });
  });

  describe("archiving", () => {
    it("archives without a reason, sending no body", async () => {
      const onCall = vi.fn();
      server.use(archiveCourseHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog();

      await user.click(confirmButton());

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledWith({ id: COURSE_ID, body: undefined });
    });

    it("sends no body for a blank reason either", async () => {
      const onCall = vi.fn();
      server.use(archiveCourseHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog();
      await user.type(reasonField(), "   ");

      await user.click(confirmButton());

      await waitFor(() => expect(onCall).toHaveBeenCalledWith({ id: COURSE_ID, body: undefined }));
    });

    it("archives with the trimmed reason", async () => {
      const onCall = vi.fn();
      server.use(archiveCourseHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog();
      await user.type(reasonField(), `  ${COURSE_ARCHIVE_REASON}  `);

      await user.click(confirmButton());

      await waitFor(() =>
        expect(onCall).toHaveBeenCalledWith({
          id: COURSE_ID,
          body: { reason: COURSE_ARCHIVE_REASON },
        }),
      );
    });

    it("shows the success toast, calls onArchived and closes", async () => {
      const archived = buildArchivedCourse();
      server.use(archiveCourseHandler({ response: archived }));
      const user = userEvent.setup();
      const { onClose, onArchived } = await renderDialog();

      await user.click(confirmButton());

      expect(await screen.findByText("Curso arquivado.")).toBeInTheDocument();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onArchived).toHaveBeenCalledWith(archived);
    });

    it("writes the archive into the cached detail at once and invalidates the course keys", async () => {
      server.use(archiveCourseHandler());
      const user = userEvent.setup();
      const { queryClient } = await renderDialog();
      const detailKey = getGetCourseQueryKey(COURSE_ID);
      const listKey = ["/courses", { status: "active" }] as const;
      queryClient.setQueryData(detailKey, buildCourseDetail());
      queryClient.setQueryData(listKey, { data: [], total: 0, page: 1, limit: 20 });

      await user.click(confirmButton());

      await screen.findByText("Curso arquivado.");
      expect(queryClient.getQueryData(detailKey)).toMatchObject({
        status: "archived",
        archivedAt: COURSE_ARCHIVED_AT,
        archiveReason: COURSE_ARCHIVE_REASON,
      });
      expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
    });

    it("Voltar closes without archiving", async () => {
      const onCall = vi.fn();
      server.use(archiveCourseHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await user.click(backButton());

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onCall).not.toHaveBeenCalled();
    });
  });

  describe("errors", () => {
    it("rejects a reason longer than 500 characters, on the field, without calling the API", async () => {
      const onCall = vi.fn();
      server.use(archiveCourseHandler({ onCall }));
      const user = userEvent.setup();
      await renderDialog();
      await user.click(reasonField());
      await user.paste("x".repeat(501));

      await user.click(confirmButton());

      expect(
        await screen.findByText("O motivo pode ter no máximo 500 caracteres."),
      ).toBeInTheDocument();
      expect(reasonField()).toHaveFocus();
      expect(onCall).not.toHaveBeenCalled();
    });

    it("maps a server validation error on the reason to the field", async () => {
      server.use(
        archiveCourseHandler({
          error: VALIDATION_ERROR([{ field: "reason", message: "too long" }]),
        }),
      );
      const user = userEvent.setup();
      await renderDialog();
      await user.type(reasonField(), "Motivo.");

      await user.click(confirmButton());

      expect(
        await screen.findByText("O motivo pode ter no máximo 500 caracteres."),
      ).toBeInTheDocument();
      expect(reasonField()).toHaveFocus();
    });

    it("explains that the course was not found and keeps the dialog open", async () => {
      server.use(archiveCourseHandler({ error: COURSE_NOT_FOUND_ERROR }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await user.click(confirmButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Curso não encontrado. Ele pode ter sido removido.",
      );
      expect(onClose).not.toHaveBeenCalled();
    });

    it("shows a network error and lets the user try again", async () => {
      server.use(archiveCourseHandler({ networkError: true }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await user.click(confirmButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível conectar. Verifique sua conexão e tente novamente.",
      );

      server.use(archiveCourseHandler());
      await user.click(confirmButton());

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });
  });

  describe("while archiving", () => {
    it("shows Arquivando…, disables Voltar and sends one request on a double click", async () => {
      const onCall = vi.fn();
      const pending = createDeferred();
      server.use(archiveCourseHandler({ onCall, delay: pending.promise }));
      const user = userEvent.setup();
      await renderDialog();

      await user.dblClick(confirmButton());

      expect(
        await within(dialog()).findByRole("button", { name: /Arquivando/ }),
      ).toBeInTheDocument();
      expect(backButton()).toBeDisabled();
      pending.resolve();
      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
    });
  });
});
