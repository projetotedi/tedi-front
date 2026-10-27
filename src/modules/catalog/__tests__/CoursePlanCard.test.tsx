import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CourseLessonPlansResponseDto } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { CoursePlanCard } from "../components/CoursePlanCard";
import {
  buildCourseSequence,
  buildMeUser,
  buildMockSequenceItem,
  buildSequenceItem,
} from "./handlers";
import { renderWithProviders, setupCatalogTestServer } from "./test-utils";

setupCatalogTestServer();

interface RenderOptions {
  sequence?: CourseLessonPlansResponseDto;
  isArchived?: boolean;
  role?: Role;
  onEditSequence?: () => void;
}

async function renderCard({
  sequence = buildCourseSequence(),
  isArchived = false,
  role = Role.coordinator,
  onEditSequence = vi.fn(),
}: RenderOptions = {}) {
  const view = await renderWithProviders(
    <CoursePlanCard sequence={sequence} isArchived={isArchived} onEditSequence={onEditSequence} />,
    { user: buildMeUser(role) },
  );
  return { ...view, onEditSequence };
}

const table = () => screen.getByRole("table", { name: "Plano do curso" });
const dataRows = () => within(table()).getAllByRole("row").slice(1);
const cellsOf = (row: HTMLElement) =>
  within(row)
    .getAllByRole("cell")
    .map((cell) => cell.textContent);
const editButton = () => screen.queryByRole("button", { name: /Editar sequência/ });

describe("CoursePlanCard", () => {
  describe("the table", () => {
    it("lists the sequence in order with link, contents, duration, course count and material", async () => {
      await renderCard();

      expect(
        within(table())
          .getAllByRole("columnheader")
          .map((header) => header.textContent),
      ).toEqual([
        "Ordem",
        "Plano de aula",
        "Conteúdos",
        "Duração prevista",
        "Usado em",
        "Material",
      ]);
      const rows = dataRows();
      expect(rows).toHaveLength(4);
      expect(cellsOf(rows[0])).toEqual([
        "1",
        "Conhecendo o WhatsApp",
        "WhatsApp: mensagens e áudios",
        "1h30",
        "1 curso",
        "Abrir›",
      ]);
      expect(cellsOf(rows[1])).toEqual([
        "2",
        "Enviar um áudio no WhatsApp",
        "WhatsApp: mensagens e áudios",
        "1h30",
        "2 cursos",
        "Abrir›",
      ]);
      expect(cellsOf(rows[3])).toEqual([
        "4",
        "Reconhecendo golpes",
        "Golpes por mensagem",
        "2h30",
        "1 curso",
        "Abrir›",
      ]);
    });

    it("links each title to the detail of its lesson plan", async () => {
      await renderCard();

      expect(screen.getByRole("link", { name: "Conhecendo o WhatsApp" })).toHaveAttribute(
        "href",
        `/lesson-plans/${buildSequenceItem().lessonPlanId}`,
      );
      expect(screen.getByRole("link", { name: "Senhas e privacidade" })).toHaveAttribute(
        "href",
        "/lesson-plans/lesson-plan-05",
      );
    });

    it("opens the material in a new tab, with a name that says whose it is and where it goes", async () => {
      await renderCard();

      const link = screen.getByRole("link", {
        name: "Abrir material de Conhecendo o WhatsApp (abre em nova aba)",
      });

      expect(link).toHaveAttribute("href", "https://example.com/material/whatsapp");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("says there is no material, for who cannot see the dash", async () => {
      await renderCard({
        sequence: buildCourseSequence([buildSequenceItem({ materialUrl: null })]),
      });

      const [cells] = [within(dataRows()[0]).getAllByRole("cell")];

      expect(within(cells[5]).queryByRole("link")).not.toBeInTheDocument();
      expect(cells[5]).toHaveTextContent("—Sem material");
      expect(within(cells[5]).getByText("Sem material")).toHaveClass("sr-only");
    });

    it("joins the contents of a plan with semicolons", async () => {
      await renderCard({
        sequence: buildCourseSequence([
          buildSequenceItem({ contents: ["Teclado e mouse", "Janelas do sistema", "Atalhos"] }),
        ]),
      });

      expect(cellsOf(dataRows()[0])[2]).toBe("Teclado e mouse; Janelas do sistema; Atalhos");
    });

    it("tags an archived plan", async () => {
      await renderCard({
        sequence: buildCourseSequence([
          buildSequenceItem({ archivedAt: "2026-10-10T13:00:00.000Z" }),
          buildMockSequenceItem("lesson-plan-04"),
        ]),
      });

      const [archived, active] = dataRows();

      expect(within(archived).getByText("Arquivado")).toBeInTheDocument();
      expect(within(active).queryByText("Arquivado")).not.toBeInTheDocument();
    });

    it("makes the links 44px targets", async () => {
      await renderCard();

      expect(screen.getByRole("link", { name: "Senhas e privacidade" })).toHaveClass("min-h-11");
      expect(screen.getAllByRole("link", { name: /^Abrir material de/ })[0]).toHaveClass(
        "min-h-11",
      );
    });
  });

  describe("the workload", () => {
    it("shows, in the note, the workload that the API answered", async () => {
      await renderCard();

      expect(
        screen.getByText(/^A carga horária prevista \(7h\) é a soma da duração dos planos/),
      ).toBeInTheDocument();
    });

    it("does not add the durations itself: it shows what the API says", async () => {
      const sequence = { ...buildCourseSequence(), plannedWorkloadMinutes: 600 };

      await renderCard({ sequence });

      expect(screen.getByText(/^A carga horária prevista \(10h\)/)).toBeInTheDocument();
    });

    it("explains that the same plan can be in other courses", async () => {
      await renderCard();

      expect(
        screen.getByText(
          /O mesmo plano de aula pode compor outros cursos, com ordem própria em cada um\.$/,
        ),
      ).toBeInTheDocument();
    });
  });

  describe("an empty sequence", () => {
    it("says there are no plans yet, with no table, and shows 0h", async () => {
      await renderCard({ sequence: buildCourseSequence([]) });

      expect(
        screen.getByText("Este curso ainda não tem planos de aula na sequência."),
      ).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(screen.getByText(/^A carga horária prevista \(0h\)/)).toBeInTheDocument();
    });
  });

  describe("Editar sequência", () => {
    it.each([
      ["director", Role.director],
      ["coordinator", Role.coordinator],
    ])("the %s sees Editar sequência and it opens the dialog", async (_label, role) => {
      const user = userEvent.setup();
      const { onEditSequence } = await renderCard({ role });

      await user.click(screen.getByRole("button", { name: "Editar sequência" }));

      expect(onEditSequence).toHaveBeenCalledTimes(1);
    });

    it("the member does not see Editar sequência, but still sees the sequence", async () => {
      await renderCard({ role: Role.member });

      expect(editButton()).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Plano do curso" })).toBeInTheDocument();
      expect(dataRows()).toHaveLength(4);
    });

    it("hides the arrow from screen readers: the name is Editar sequência", async () => {
      await renderCard();

      const button = screen.getByRole("button", { name: "Editar sequência" });

      expect(within(button).getByText("›")).toHaveAttribute("aria-hidden", "true");
    });

    it("is a 44px target", async () => {
      await renderCard();

      expect(screen.getByRole("button", { name: "Editar sequência" })).toHaveClass("min-h-11");
    });

    it("an archived course disables Editar sequência and explains why", async () => {
      const user = userEvent.setup();
      const { onEditSequence } = await renderCard({ isArchived: true });

      const button = screen.getByRole("button", { name: "Editar sequência" });
      await user.click(button);

      expect(button).toBeDisabled();
      expect(onEditSequence).not.toHaveBeenCalled();
      expect(
        screen.getByText("Curso arquivado: a sequência não pode ser alterada (RN-27)."),
      ).toBeVisible();
      expect(button).toHaveAccessibleDescription(
        "Curso arquivado: a sequência não pode ser alterada (RN-27).",
      );
    });

    it("shows the reason of an archived course at 16px and in the text color, since it is the only explanation", async () => {
      await renderCard({ isArchived: true });

      const hint = screen.getByText("Curso arquivado: a sequência não pode ser alterada (RN-27).");

      // A class assertion, on purpose: the criterion is about size and color (4.5:1 at least).
      expect(hint).toHaveClass("text-base", "text-foreground");
      expect(hint).not.toHaveClass("text-sm");
      expect(hint).not.toHaveClass("text-muted");
    });

    it("does not show the archived hint for a course that is not archived", async () => {
      await renderCard();

      expect(screen.queryByText(/Curso arquivado/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Editar sequência" })).toBeEnabled();
    });

    it("does not show the archived hint to who could not edit anyway", async () => {
      await renderCard({ role: Role.member, isArchived: true });

      expect(screen.queryByText(/Curso arquivado/)).not.toBeInTheDocument();
    });
  });
});
