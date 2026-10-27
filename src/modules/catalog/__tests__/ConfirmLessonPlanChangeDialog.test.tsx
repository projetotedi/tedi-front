import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { LessonPlanUsageResponseDto } from "@api/generated/model";

import { ConfirmLessonPlanChangeDialog } from "../components/ConfirmLessonPlanChangeDialog";
import { buildLessonPlanUsage, COURSE_SMARTPHONES, COURSE_SOCIAL_NETWORKS } from "./handlers";
import { renderWithProviders, setupCatalogTestServer } from "./test-utils";

setupCatalogTestServer();

interface RenderOptions {
  usage?: LessonPlanUsageResponseDto;
  isSaving?: boolean;
}

async function renderDialog({
  usage = buildLessonPlanUsage(),
  isSaving = false,
}: RenderOptions = {}) {
  const onConfirm = vi.fn();
  const onBack = vi.fn();
  const view = await renderWithProviders(
    <ConfirmLessonPlanChangeDialog
      usage={usage}
      isSaving={isSaving}
      onConfirm={onConfirm}
      onBack={onBack}
    />,
  );
  const dialog = await screen.findByRole("dialog", { name: "Confirmar alteração do plano" });
  return { ...view, dialog, onConfirm, onBack };
}

function courseRow(name: string) {
  return screen.getByRole("row", { name: new RegExp(name) });
}

function cellTexts(row: HTMLElement) {
  return within(row)
    .getAllByRole("cell")
    .map((cell) => cell.textContent);
}

describe("ConfirmLessonPlanChangeDialog", () => {
  describe("layout", () => {
    it("opens as the Confirmar alteração do plano dialog with a warning about the courses", async () => {
      const { dialog } = await renderDialog();

      expect(within(dialog).getByText("Este plano é usado em 2 cursos")).toBeInTheDocument();
      expect(
        within(dialog).getByText(
          "A alteração vale para o catálogo e para as turmas criadas daqui em diante. As turmas em andamento continuam com o conteúdo que já foi gerado.",
        ),
      ).toBeInTheDocument();
    });

    it("says course in the singular when only one course uses the plan", async () => {
      const [first] = buildLessonPlanUsage().courses;
      await renderDialog({ usage: buildLessonPlanUsage({ courses: [first] }) });

      expect(screen.getByText("Este plano é usado em 1 curso")).toBeInTheDocument();
    });

    it("has the Voltar and Salvar alteração buttons and the close button", async () => {
      const { dialog } = await renderDialog();

      expect(within(dialog).getByRole("button", { name: "Voltar" })).toBeEnabled();
      expect(within(dialog).getByRole("button", { name: "Salvar alteração" })).toBeEnabled();
      expect(within(dialog).getByRole("button", { name: "Fechar" })).toBeInTheDocument();
    });

    it("keeps the 44px touch targets", async () => {
      const { dialog } = await renderDialog();

      for (const name of ["Voltar", "Salvar alteração"]) {
        expect(within(dialog).getByRole("button", { name })).toHaveClass("min-h-11");
      }
    });

    it("does not offer a link to the course, since the course screen does not exist yet", async () => {
      const { dialog } = await renderDialog();

      expect(within(dialog).queryByRole("link")).not.toBeInTheDocument();
      expect(within(dialog).queryByText("Ver curso")).not.toBeInTheDocument();
    });
  });

  describe("courses", () => {
    it("lists every course with the current and the new workload", async () => {
      const { dialog } = await renderDialog();

      const table = within(dialog).getByRole("table", { name: "Cursos que usam este plano" });
      expect(
        within(table)
          .getAllByRole("columnheader")
          .map((header) => header.textContent),
      ).toEqual(["Curso", "Carga atual", "Carga nova"]);
      expect(within(table).getAllByRole("row")).toHaveLength(3);
      expect(courseRow(COURSE_SOCIAL_NETWORKS.courseName)).toBeInTheDocument();
      expect(courseRow(COURSE_SMARTPHONES.courseName)).toBeInTheDocument();
    });

    it("shows the position of the plan in the sequence of each course", async () => {
      await renderDialog();

      expect(cellTexts(courseRow(COURSE_SOCIAL_NETWORKS.courseName))[0]).toBe(
        "Redes Sociais com SegurançaItem 2 de 4",
      );
      expect(cellTexts(courseRow(COURSE_SMARTPHONES.courseName))[0]).toBe(
        "Smartphones no dia a diaItem 4 de 5",
      );
    });

    it("shows the workloads exactly as the API sends them, in hours", async () => {
      await renderDialog();

      expect(cellTexts(courseRow(COURSE_SOCIAL_NETWORKS.courseName)).slice(1)).toEqual([
        "7h05",
        "7h35",
      ]);
      expect(cellTexts(courseRow(COURSE_SMARTPHONES.courseName)).slice(1)).toEqual(["8h30", "9h"]);
    });

    it("does not calculate the new workload from the duration: it uses what the API says", async () => {
      const usage = buildLessonPlanUsage({
        currentDurationMinutes: 60,
        newDurationMinutes: 75,
        courses: [
          {
            ...COURSE_SOCIAL_NETWORKS,
            position: 1,
            lessonPlanCount: 3,
            currentWorkloadMinutes: 200,
            newWorkloadMinutes: 215,
          },
        ],
      });
      await renderDialog({ usage });

      expect(cellTexts(courseRow(COURSE_SOCIAL_NETWORKS.courseName)).slice(1)).toEqual([
        "3h20",
        "3h35",
      ]);
    });
  });

  describe("what changes", () => {
    it("shows the duration of the plan before and after", async () => {
      const { dialog } = await renderDialog({
        usage: buildLessonPlanUsage({ currentDurationMinutes: 90, newDurationMinutes: 120 }),
      });

      expect(within(dialog).getByRole("heading", { name: "O que muda" })).toBeInTheDocument();
      expect(
        within(dialog).getByText(
          "Duração prevista: 1h30 → 2h. A carga horária de cada curso é recalculada.",
        ),
      ).toBeInTheDocument();
    });
  });

  describe("actions", () => {
    it("Salvar alteração confirms", async () => {
      const user = userEvent.setup();
      const { onConfirm, onBack } = await renderDialog();

      await user.click(screen.getByRole("button", { name: "Salvar alteração" }));

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onBack).not.toHaveBeenCalled();
    });

    it("Voltar goes back without confirming", async () => {
      const user = userEvent.setup();
      const { onConfirm, onBack } = await renderDialog();

      await user.click(screen.getByRole("button", { name: "Voltar" }));

      expect(onBack).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("the close button and Escape work like Voltar", async () => {
      const user = userEvent.setup();
      const { onConfirm, onBack } = await renderDialog();

      await user.click(screen.getByRole("button", { name: "Fechar" }));
      expect(onBack).toHaveBeenCalledTimes(1);

      await user.keyboard("{Escape}");
      expect(onBack).toHaveBeenCalledTimes(2);
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe("while saving", () => {
    it("shows Salvando… and disables Voltar", async () => {
      const { dialog } = await renderDialog({ isSaving: true });

      expect(within(dialog).getByRole("button", { name: "Salvando…" })).toBeInTheDocument();
      expect(
        within(dialog).queryByRole("button", { name: "Salvar alteração" }),
      ).not.toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Voltar" })).toBeDisabled();
    });

    it("ignores Escape and the close button, and does not confirm twice", async () => {
      const user = userEvent.setup();
      const { onConfirm, onBack } = await renderDialog({ isSaving: true });

      await user.keyboard("{Escape}");
      await user.click(screen.getByRole("button", { name: "Fechar" }));
      await user.click(screen.getByRole("button", { name: "Salvando…" }));

      expect(onBack).not.toHaveBeenCalled();
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });
});
