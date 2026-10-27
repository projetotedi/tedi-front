import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getGetLessonPlanQueryKey } from "@api/generated/catalog/catalog";
import { Role } from "@shared/lib/role";

import { LessonPlanActions } from "../components/LessonPlanActions";
import {
  archiveLessonPlanHandler,
  buildArchivedLessonPlan,
  buildLessonPlan,
  buildMeUser,
  getLessonPlanHandler,
  LESSON_PLAN_ID,
  NOT_FOUND_ERROR,
  unarchiveLessonPlanHandler,
} from "./handlers";
import { createDeferred, renderWithProviders, server, setupCatalogTestServer } from "./test-utils";

setupCatalogTestServer();

const activePlan = { id: LESSON_PLAN_ID, title: "Teclado, mouse e janelas", archivedAt: null };
const archivedPlan = {
  id: LESSON_PLAN_ID,
  title: "Teclado, mouse e janelas",
  archivedAt: "2026-10-10T13:00:00.000Z",
};

const editButton = () =>
  screen.getByRole("button", { name: "Editar plano de aula: Teclado, mouse e janelas" });
const archiveButton = () =>
  screen.getByRole("button", { name: "Arquivar plano de aula: Teclado, mouse e janelas" });
const unarchiveButton = () =>
  screen.getByRole("button", { name: "Reativar plano: Teclado, mouse e janelas" });

describe("LessonPlanActions", () => {
  describe("active plan", () => {
    it("offers Editar and Arquivar to whoever can manage lesson plans", async () => {
      await renderWithProviders(<LessonPlanActions plan={activePlan} />);

      expect(editButton()).toBeEnabled();
      expect(archiveButton()).toBeEnabled();
      expect(screen.queryByText("Arquivado")).not.toBeInTheDocument();
      expect(screen.queryByText("Reativar plano")).not.toBeInTheDocument();
    });

    it.each([
      ["coordinator", Role.coordinator],
      ["director", Role.director],
    ])("the %s sees the actions", async (_label, role) => {
      await renderWithProviders(<LessonPlanActions plan={activePlan} />, {
        user: buildMeUser(role),
      });

      expect(editButton()).toBeInTheDocument();
      expect(archiveButton()).toBeInTheDocument();
    });

    it("the member sees neither Editar nor Arquivar", async () => {
      const { container } = await renderWithProviders(<LessonPlanActions plan={activePlan} />, {
        user: buildMeUser(Role.member),
      });

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(container).not.toHaveTextContent("Arquivado");
    });

    it("keeps the 44px touch targets", async () => {
      await renderWithProviders(<LessonPlanActions plan={activePlan} />);

      expect(editButton()).toHaveClass("min-h-11", "min-w-11");
      expect(archiveButton()).toHaveClass("min-h-11", "min-w-11");
    });

    it("Editar opens the edit dialog for that plan, already loading its data", async () => {
      const onGet = vi.fn();
      server.use(getLessonPlanHandler({ onCall: onGet }));
      const user = userEvent.setup();
      await renderWithProviders(<LessonPlanActions plan={activePlan} />);

      await user.click(editButton());

      expect(
        await screen.findByRole("dialog", { name: "Editar plano de aula" }),
      ).toBeInTheDocument();
      expect(await screen.findByRole("textbox", { name: "Título do plano" })).toHaveValue(
        "Teclado, mouse e janelas",
      );
      expect(onGet).toHaveBeenCalledWith({ id: LESSON_PLAN_ID });
    });

    it("Cancelar in the edit dialog goes back to the actions", async () => {
      server.use(getLessonPlanHandler());
      const user = userEvent.setup();
      await renderWithProviders(<LessonPlanActions plan={activePlan} />);
      await user.click(editButton());
      await screen.findByRole("textbox", { name: "Título do plano" });

      await user.click(screen.getByRole("button", { name: "Cancelar" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await waitFor(() => expect(editButton()).toHaveFocus());
    });

    it("Arquivar opens the archive dialog and archives that plan", async () => {
      const onArchive = vi.fn();
      server.use(archiveLessonPlanHandler({ onCall: onArchive }));
      const user = userEvent.setup();
      await renderWithProviders(<LessonPlanActions plan={activePlan} />);

      await user.click(archiveButton());
      const dialog = await screen.findByRole("dialog", { name: "Arquivar plano de aula" });
      await user.click(within(dialog).getByRole("button", { name: "Arquivar plano" }));

      expect(await screen.findByText("Plano de aula arquivado.")).toBeInTheDocument();
      expect(onArchive).toHaveBeenCalledWith({ id: LESSON_PLAN_ID, body: undefined });
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("Voltar in the archive dialog goes back to the actions", async () => {
      const user = userEvent.setup();
      await renderWithProviders(<LessonPlanActions plan={activePlan} />);
      await user.click(archiveButton());
      await screen.findByRole("dialog", { name: "Arquivar plano de aula" });

      await user.click(screen.getByRole("button", { name: "Voltar" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await waitFor(() => expect(archiveButton()).toHaveFocus());
    });
  });

  describe("archived plan", () => {
    it("shows the Arquivado tag, a disabled Editar and the Reativar plano action instead of Arquivar", async () => {
      await renderWithProviders(<LessonPlanActions plan={archivedPlan} />);

      expect(screen.getByText("Arquivado")).toBeInTheDocument();
      expect(editButton()).toBeDisabled();
      expect(screen.getByRole("button", { name: /^Reativar plano/ })).toHaveTextContent(
        "Reativar plano",
      );
      expect(
        screen.queryByRole("button", { name: "Arquivar plano de aula: Teclado, mouse e janelas" }),
      ).not.toBeInTheDocument();
    });

    it("keeps the visible text inside the accessible name of Reativar plano", async () => {
      await renderWithProviders(<LessonPlanActions plan={archivedPlan} />);

      expect(unarchiveButton()).toHaveTextContent("Reativar plano");
    });

    it("does not open the edit dialog from the disabled Editar", async () => {
      const user = userEvent.setup();
      await renderWithProviders(<LessonPlanActions plan={archivedPlan} />);

      await user.click(editButton());

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("the member sees the tag, but no action", async () => {
      await renderWithProviders(<LessonPlanActions plan={archivedPlan} />, {
        user: buildMeUser(Role.member),
      });

      expect(screen.getByText("Arquivado")).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("Reativar plano unarchives that plan, shows the toast and refreshes the queries", async () => {
      const onUnarchive = vi.fn();
      server.use(unarchiveLessonPlanHandler({ response: buildLessonPlan(), onCall: onUnarchive }));
      const user = userEvent.setup();
      const { queryClient } = await renderWithProviders(<LessonPlanActions plan={archivedPlan} />);
      const detailKey = getGetLessonPlanQueryKey(LESSON_PLAN_ID);
      const listKey = ["/lesson-plans", { page: 1 }] as const;
      queryClient.setQueryData(detailKey, buildArchivedLessonPlan());
      queryClient.setQueryData(listKey, { data: [] });

      await user.click(unarchiveButton());

      expect(await screen.findByText("Plano de aula reativado.")).toBeInTheDocument();
      expect(onUnarchive).toHaveBeenCalledWith({ id: LESSON_PLAN_ID });
      expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
    });

    it("shows the loading state and sends a single request on a double click", async () => {
      const deferred = createDeferred();
      const onUnarchive = vi.fn();
      server.use(unarchiveLessonPlanHandler({ delay: deferred.promise, onCall: onUnarchive }));
      const user = userEvent.setup();
      await renderWithProviders(<LessonPlanActions plan={archivedPlan} />);

      await user.dblClick(unarchiveButton());

      await waitFor(() => expect(onUnarchive).toHaveBeenCalledTimes(1));
      expect(unarchiveButton()).toHaveAttribute("aria-disabled", "true");
      deferred.resolve();
      await screen.findByText("Plano de aula reativado.");
      expect(onUnarchive).toHaveBeenCalledTimes(1);
    });

    it("tells the user when the plan could not be reactivated", async () => {
      server.use(unarchiveLessonPlanHandler({ error: NOT_FOUND_ERROR }));
      const user = userEvent.setup();
      await renderWithProviders(<LessonPlanActions plan={archivedPlan} />);

      await user.click(unarchiveButton());

      expect(
        await screen.findByText("Não foi possível reativar o plano de aula. Tente novamente."),
      ).toBeInTheDocument();
      expect(screen.queryByText("Plano de aula reativado.")).not.toBeInTheDocument();
      expect(unarchiveButton()).toBeEnabled();
    });

    it("tells the user when the connection fails", async () => {
      server.use(unarchiveLessonPlanHandler({ networkError: true }));
      const user = userEvent.setup();
      await renderWithProviders(<LessonPlanActions plan={archivedPlan} />);

      await user.click(unarchiveButton());

      expect(
        await screen.findByText("Não foi possível reativar o plano de aula. Tente novamente."),
      ).toBeInTheDocument();
    });
  });
});
