import { useState } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getListCourseLessonPlansQueryKey } from "@api/generated/catalog/catalog";
import type { CourseLessonPlansResponseDto } from "@api/generated/model";
import { formatHours } from "@shared/lib/format";

import { BuildSequenceDialog } from "../components/BuildSequenceDialog";
import {
  buildCourseSequence,
  buildMockSequenceItem,
  buildSequenceItem,
  COURSE_ARCHIVED_ERROR,
  COURSE_ID,
  COURSE_NOT_FOUND_ERROR,
  DUPLICATE_LESSON_PLAN_ERROR,
  replaceCourseLessonPlansHandler,
  SEQUENCE_PLAN_ARCHIVED_ERROR,
  SEQUENCE_PLAN_NOT_FOUND_ERROR,
  type ApiErrorOptions,
} from "./handlers";
import { createDeferred, renderWithProviders, server, setupCatalogTestServer } from "./test-utils";

setupCatalogTestServer();

type User = ReturnType<typeof userEvent.setup>;

const SEQUENCE_TITLES = [
  "Conhecendo o WhatsApp",
  "Enviar um áudio no WhatsApp",
  "Senhas e privacidade",
  "Reconhecendo golpes",
];

interface RenderOptions {
  sequence?: CourseLessonPlansResponseDto;
  onClose?: () => void;
  onCourseArchived?: () => void;
}

async function renderDialog({
  sequence = buildCourseSequence(),
  onClose = vi.fn(),
  onCourseArchived = vi.fn(),
}: RenderOptions = {}) {
  const view = await renderWithProviders(
    <BuildSequenceDialog
      courseId={COURSE_ID}
      sequence={sequence}
      onClose={onClose}
      onCourseArchived={onCourseArchived}
    />,
  );
  await screen.findByRole("dialog", { name: "Montar sequência do curso" });
  return { ...view, onClose, onCourseArchived };
}

const dialog = () => screen.getByRole("dialog", { name: "Montar sequência do curso" });
const button = (name: string | RegExp) => within(dialog()).getByRole("button", { name });
const list = () => within(dialog()).getByRole("grid", { name: "Sequência do curso" });
const announcement = () => within(dialog()).getByRole("status");
/** The live region is emptied and filled one frame later (see `useLiveAnnouncement`), so it is waited for. */
const expectAnnouncement = (text: string) =>
  waitFor(() => expect(announcement()).toHaveTextContent(text));
const workload = () => within(dialog()).getByText(/^Carga horária prevista:/).textContent;

/**
 * The titles of the rows, in order. A row is named "<position>. <title>"; the empty message of the
 * list is a row too, but it has no name.
 */
function rowTitles(): string[] {
  return within(list())
    .queryAllByRole("row")
    .filter((row) => row.hasAttribute("aria-label"))
    .map((row) => (row.getAttribute("aria-label") ?? "").replace(/^\d+\. /, ""));
}

async function chooseAndAdd(user: User, option: string) {
  await user.click(button(/Adicionar plano de aula/));
  await user.click(await screen.findByRole("option", { name: option }));
  await user.click(button("Adicionar"));
}

async function optionNames(user: User): Promise<string[]> {
  await user.click(button(/Adicionar plano de aula/));
  const options = (await screen.findAllByRole("option")).map((option) => option.textContent ?? "");
  await user.keyboard("{Escape}");
  return options;
}

describe("BuildSequenceDialog", () => {
  describe("layout", () => {
    it("opens with the saved sequence in order, the count and the planned workload", async () => {
      await renderDialog();

      expect(rowTitles()).toEqual(SEQUENCE_TITLES);
      expect(
        within(dialog()).getByRole("heading", { name: "Sequência do curso — 4 planos" }),
      ).toBeInTheDocument();
      expect(workload()).toBe("Carga horária prevista: 7h");
      expect(
        within(dialog()).getByText("Soma das durações — recalculada automaticamente (RF-018)"),
      ).toBeInTheDocument();
    });

    it("shows the duration of each plan and the number of its place", async () => {
      await renderDialog();

      const rows = within(list()).getAllByRole("row");

      expect(rows[0]).toHaveAccessibleName("1. Conhecendo o WhatsApp");
      expect(within(rows[0]).getByText("1h30 · plano de aula do catálogo")).toBeInTheDocument();
      expect(rows[3]).toHaveAccessibleName("4. Reconhecendo golpes");
      expect(within(rows[3]).getByText("2h30 · plano de aula do catálogo")).toBeInTheDocument();
    });

    it("has Cancelar and Salvar sequência, and the Fechar button", async () => {
      await renderDialog();

      expect(button("Cancelar")).toBeEnabled();
      expect(button("Salvar sequência")).toBeEnabled();
      expect(button("Fechar")).toBeInTheDocument();
    });

    it("is the wide 800px dialog", async () => {
      await renderDialog();

      expect(dialog()).toHaveClass("max-w-200");
    });

    it("gives every plan a handle, the two arrows and Remover, each one named for its plan", async () => {
      await renderDialog();

      for (const title of SEQUENCE_TITLES) {
        expect(button(`Arrastar ${title} para reordenar`)).toBeInTheDocument();
        expect(button(`Mover ${title} para cima`)).toBeInTheDocument();
        expect(button(`Mover ${title} para baixo`)).toBeInTheDocument();
        expect(button(`Remover ${title} da sequência`)).toBeInTheDocument();
      }
    });

    it("turns off the up arrow of the first plan and the down arrow of the last", async () => {
      await renderDialog();

      expect(button("Mover Conhecendo o WhatsApp para cima")).toBeDisabled();
      expect(button("Mover Conhecendo o WhatsApp para baixo")).toBeEnabled();
      expect(button("Mover Reconhecendo golpes para baixo")).toBeDisabled();
      expect(button("Mover Reconhecendo golpes para cima")).toBeEnabled();
    });

    it("makes every control of a row a 44px target", async () => {
      await renderDialog();

      for (const name of [
        "Arrastar Senhas e privacidade para reordenar",
        "Mover Senhas e privacidade para cima",
        "Mover Senhas e privacidade para baixo",
      ]) {
        expect(button(name)).toHaveClass("min-h-11", "min-w-11");
      }
      expect(button("Remover Senhas e privacidade da sequência")).toHaveClass("min-h-11");
      expect(button("Adicionar")).toHaveClass("min-h-11");
      expect(button("Cancelar")).toHaveClass("min-h-11");
      expect(button("Salvar sequência")).toHaveClass("min-h-11");
    });

    it("keeps the Arquivado tag on an archived plan that stayed in the sequence", async () => {
      await renderDialog({
        sequence: buildCourseSequence([
          buildSequenceItem({ archivedAt: "2026-10-10T13:00:00.000Z" }),
          buildMockSequenceItem("lesson-plan-04"),
        ]),
      });

      const [archived, active] = within(list()).getAllByRole("row");

      expect(within(archived).getByText("Arquivado")).toBeInTheDocument();
      expect(within(active).queryByText("Arquivado")).not.toBeInTheDocument();
    });

    it("explains an empty sequence and shows 0h", async () => {
      await renderDialog({ sequence: buildCourseSequence([]) });

      expect(rowTitles()).toEqual([]);
      expect(
        within(dialog()).getByRole("heading", { name: "Sequência do curso — 0 planos" }),
      ).toBeInTheDocument();
      expect(
        within(dialog()).getByText("A sequência está vazia. Adicione planos de aula acima."),
      ).toBeInTheDocument();
      expect(workload()).toBe("Carga horária prevista: 0h");
    });
  });

  describe("adding a plan", () => {
    it("adds the plan at the end, recalculates the workload and announces it", async () => {
      const user = userEvent.setup();
      await renderDialog();

      await chooseAndAdd(user, "Fotos no celular · 1h30");

      expect(rowTitles()).toEqual([...SEQUENCE_TITLES, "Fotos no celular"]);
      expect(workload()).toBe("Carga horária prevista: 8h30");
      expect(
        within(dialog()).getByRole("heading", { name: "Sequência do curso — 5 planos" }),
      ).toBeInTheDocument();
      await expectAnnouncement(
        "Fotos no celular adicionado na posição 5 de 5. Carga horária prevista: 8h30.",
      );
      expect(button("Adicionar")).toHaveFocus();
    });

    it("an added plan leaves the picker and a removed one comes back", async () => {
      const user = userEvent.setup();
      await renderDialog();

      await chooseAndAdd(user, "Fotos no celular · 1h30");
      expect(await optionNames(user)).not.toContain("Fotos no celular · 1h30");

      await user.click(button("Remover Fotos no celular da sequência"));
      expect(await optionNames(user)).toContain("Fotos no celular · 1h30");
    });

    it("does not offer the plans that are already in the sequence", async () => {
      const user = userEvent.setup();
      await renderDialog();

      const options = await optionNames(user);

      for (const inSequence of [
        "Enviar um áudio no WhatsApp · 1h30",
        "Senhas e privacidade · 1h30",
        "Reconhecendo golpes · 2h30",
      ]) {
        expect(options).not.toContain(inSequence);
      }
    });

    it("asks to choose a plan when Adicionar is pressed with nothing chosen", async () => {
      const user = userEvent.setup();
      await renderDialog();

      await user.click(button("Adicionar"));

      expect(
        within(dialog()).getByText("Escolha um plano de aula para adicionar."),
      ).toBeInTheDocument();
      expect(rowTitles()).toEqual(SEQUENCE_TITLES);
    });

    it("turns Adicionar off, with the reason, when the sequence has the most plans the API takes", async () => {
      const items = Array.from({ length: 100 }, (_, index) =>
        buildSequenceItem({
          lessonPlanId: `01952ef7-0000-7000-8000-${String(index).padStart(12, "0")}`,
          title: `Plano ${index + 1}`,
        }),
      );
      await renderDialog({ sequence: buildCourseSequence(items) });

      expect(button("Adicionar")).toBeDisabled();
      expect(
        within(dialog()).getByText("A sequência pode ter no máximo 100 planos de aula."),
      ).toBeInTheDocument();
    });
  });

  describe("removing a plan", () => {
    it("removes a plan, recalculates the workload, announces it and focuses the next row", async () => {
      const user = userEvent.setup();
      await renderDialog();

      await user.click(button("Remover Enviar um áudio no WhatsApp da sequência"));

      expect(rowTitles()).toEqual([
        "Conhecendo o WhatsApp",
        "Senhas e privacidade",
        "Reconhecendo golpes",
      ]);
      expect(workload()).toBe("Carga horária prevista: 5h30");
      await expectAnnouncement(
        "Enviar um áudio no WhatsApp removido. Restam 3 planos. Carga horária prevista: 5h30.",
      );
      await waitFor(() =>
        expect(button("Remover Senhas e privacidade da sequência")).toHaveFocus(),
      );
    });

    it("focuses the previous row after removing the last one", async () => {
      const user = userEvent.setup();
      await renderDialog();

      await user.click(button("Remover Reconhecendo golpes da sequência"));

      expect(rowTitles()).toEqual(SEQUENCE_TITLES.slice(0, 3));
      await waitFor(() =>
        expect(button("Remover Senhas e privacidade da sequência")).toHaveFocus(),
      );
    });

    it("says that one plan is left, in the singular", async () => {
      const user = userEvent.setup();
      await renderDialog({
        sequence: buildCourseSequence([
          buildSequenceItem(),
          buildMockSequenceItem("lesson-plan-04"),
        ]),
      });

      await user.click(button("Remover Conhecendo o WhatsApp da sequência"));

      await expectAnnouncement(
        "Conhecendo o WhatsApp removido. Resta 1 plano. Carga horária prevista: 1h30.",
      );
    });

    it("removing the only plan empties the sequence, announces it and keeps the focus in the dialog", async () => {
      const user = userEvent.setup();
      await renderDialog({ sequence: buildCourseSequence([buildSequenceItem()]) });

      await user.click(button("Remover Conhecendo o WhatsApp da sequência"));

      expect(rowTitles()).toEqual([]);
      expect(workload()).toBe("Carga horária prevista: 0h");
      await expectAnnouncement(
        "Conhecendo o WhatsApp removido. A sequência ficou vazia. Carga horária prevista: 0h.",
      );
      const empty = within(dialog()).getByText(
        "A sequência está vazia. Adicione planos de aula acima.",
      );
      await waitFor(() => expect(empty).toHaveFocus());
    });
  });

  describe("changing the order with the arrow buttons", () => {
    it("moves a plan up and down, announces the new position and keeps the focus on the moved plan", async () => {
      const user = userEvent.setup();
      await renderDialog();

      await user.click(button("Mover Senhas e privacidade para cima"));

      expect(rowTitles()).toEqual([
        "Conhecendo o WhatsApp",
        "Senhas e privacidade",
        "Enviar um áudio no WhatsApp",
        "Reconhecendo golpes",
      ]);
      await expectAnnouncement("Senhas e privacidade movido para a posição 2 de 4.");
      await waitFor(() => expect(button("Mover Senhas e privacidade para cima")).toHaveFocus());

      await user.keyboard("{Enter}");
      await expectAnnouncement("Senhas e privacidade movido para a posição 1 de 4.");
    });

    it("moves a plan down with the keyboard, one press after the other, without losing the focus", async () => {
      const user = userEvent.setup();
      await renderDialog();

      await user.click(button("Mover Conhecendo o WhatsApp para baixo"));
      await waitFor(() => expect(button("Mover Conhecendo o WhatsApp para baixo")).toHaveFocus());
      await user.keyboard("{Enter}");

      expect(rowTitles()).toEqual([
        "Enviar um áudio no WhatsApp",
        "Senhas e privacidade",
        "Conhecendo o WhatsApp",
        "Reconhecendo golpes",
      ]);
      await expectAnnouncement("Conhecendo o WhatsApp movido para a posição 3 de 4.");
      await waitFor(() => expect(button("Mover Conhecendo o WhatsApp para baixo")).toHaveFocus());
    });

    it("moves the focus to the other arrow when the plan reaches the top", async () => {
      const user = userEvent.setup();
      await renderDialog();

      await user.click(button("Mover Enviar um áudio no WhatsApp para cima"));

      expect(rowTitles()[0]).toBe("Enviar um áudio no WhatsApp");
      expect(button("Mover Enviar um áudio no WhatsApp para cima")).toBeDisabled();
      await waitFor(() =>
        expect(button("Mover Enviar um áudio no WhatsApp para baixo")).toHaveFocus(),
      );
    });

    it("moves the focus to the other arrow when the plan reaches the bottom", async () => {
      const user = userEvent.setup();
      await renderDialog();

      await user.click(button("Mover Senhas e privacidade para baixo"));

      expect(rowTitles()[3]).toBe("Senhas e privacidade");
      expect(button("Mover Senhas e privacidade para baixo")).toBeDisabled();
      await waitFor(() => expect(button("Mover Senhas e privacidade para cima")).toHaveFocus());
    });

    it("does not change the workload, which is the sum of the same durations", async () => {
      const user = userEvent.setup();
      await renderDialog();

      await user.click(button("Mover Reconhecendo golpes para cima"));

      expect(workload()).toBe("Carga horária prevista: 7h");
    });
  });

  describe("changing the order by dragging", () => {
    /** Picks up the plan of the first row below `rowsDown` with its handle and walks to the target. */
    async function dragTo(user: User, rowsDown: number, target: RegExp) {
      within(list()).getAllByRole("row")[0].focus();
      for (let step = 0; step < rowsDown; step += 1) await user.keyboard("{ArrowDown}");
      await user.tab();
      await user.keyboard("{Enter}");

      for (let attempts = 0; attempts < 12; attempts += 1) {
        await user.keyboard("{ArrowDown}");
        if (target.test(document.activeElement?.getAttribute("aria-label") ?? "")) break;
      }
      expect(document.activeElement?.getAttribute("aria-label") ?? "").toMatch(target);
      await user.keyboard("{Enter}");
    }

    it("moves a plan with the keyboard drag of its handle", async () => {
      const user = userEvent.setup();
      await renderDialog();

      await dragTo(user, 0, /^Insert after 4\. Reconhecendo golpes$/);

      expect(rowTitles()).toEqual([
        "Enviar um áudio no WhatsApp",
        "Senhas e privacidade",
        "Reconhecendo golpes",
        "Conhecendo o WhatsApp",
      ]);
      expect(workload()).toBe("Carga horária prevista: 7h");
    });

    it("moves a plan up to the start with the keyboard drag", async () => {
      const user = userEvent.setup();
      await renderDialog();

      await dragTo(user, 3, /^Insert before 1\. Conhecendo o WhatsApp$/);

      expect(rowTitles()).toEqual([
        "Reconhecendo golpes",
        "Conhecendo o WhatsApp",
        "Enviar um áudio no WhatsApp",
        "Senhas e privacidade",
      ]);
    });

    it("announces a move again when it is the same message as the last one, after a drag undid it", async () => {
      const user = userEvent.setup();
      await renderDialog();

      await user.click(button("Mover Conhecendo o WhatsApp para baixo"));
      await expectAnnouncement("Conhecendo o WhatsApp movido para a posição 2 de 4.");
      // The drag brings the plan back to the top. React Aria announces it on its own, and the
      // region of the dialog keeps the last message it had.
      await dragTo(user, 1, /^Insert before 1\. Enviar um áudio no WhatsApp$/);
      expect(rowTitles()[0]).toBe("Conhecendo o WhatsApp");
      expect(announcement()).toHaveTextContent(
        "Conhecendo o WhatsApp movido para a posição 2 de 4.",
      );

      // The same arrow again says the very same words. A live region is read when its text
      // changes, so the text has to go away and come back.
      const region = announcement();
      const texts: string[] = [];
      const observer = new MutationObserver(() => texts.push(region.textContent ?? ""));
      observer.observe(region, { childList: true, characterData: true, subtree: true });
      await user.click(button("Mover Conhecendo o WhatsApp para baixo"));

      await waitFor(() =>
        expect(texts).toEqual(["", "Conhecendo o WhatsApp movido para a posição 2 de 4."]),
      );
      observer.disconnect();
    });

    it("Esc cancels a keyboard drag and keeps the dialog open", async () => {
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      within(list()).getAllByRole("row")[0].focus();
      await user.tab();
      await user.keyboard("{Enter}");
      await user.keyboard("{ArrowDown}");
      await user.keyboard("{Escape}");

      expect(onClose).not.toHaveBeenCalled();
      expect(rowTitles()).toEqual(SEQUENCE_TITLES);

      await user.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("saves the order that the drag made", async () => {
      const user = userEvent.setup();
      const onCall = vi.fn();
      server.use(replaceCourseLessonPlansHandler({ onCall }));
      await renderDialog();

      await dragTo(user, 0, /^Insert after 4\. Reconhecendo golpes$/);
      await user.click(button("Salvar sequência"));

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall.mock.calls[0][0].body.lessonPlanIds).toEqual([
        "lesson-plan-04",
        "lesson-plan-05",
        "lesson-plan-06",
        buildSequenceItem().lessonPlanId,
      ]);
    });
  });

  describe("saving", () => {
    it("Salvar sequência sends every id in the new order and closes with a toast", async () => {
      const user = userEvent.setup();
      const onCall = vi.fn();
      server.use(replaceCourseLessonPlansHandler({ onCall }));
      const { onClose } = await renderDialog();

      await user.click(button("Mover Senhas e privacidade para cima"));
      await chooseAndAdd(user, "Fotos no celular · 1h30");
      await user.click(button("Salvar sequência"));

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledExactlyOnceWith({
        id: COURSE_ID,
        body: {
          lessonPlanIds: [
            buildSequenceItem().lessonPlanId,
            "lesson-plan-05",
            "lesson-plan-04",
            "lesson-plan-06",
            "lesson-plan-07",
          ],
        },
      });
      expect(await screen.findByText("Sequência do curso salva.")).toBeInTheDocument();
    });

    it("the workload shown before saving is the plannedWorkloadMinutes the API answers", async () => {
      const user = userEvent.setup();
      server.use(replaceCourseLessonPlansHandler());
      const { queryClient, onClose } = await renderDialog();

      await user.click(button("Remover Senhas e privacidade da sequência"));
      await chooseAndAdd(user, "Videochamadas com a família · 1h30");
      await chooseAndAdd(user, "Compras seguras pela internet · 2h30");
      const shown = workload();
      await user.click(button("Salvar sequência"));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      const answered = queryClient.getQueryData<CourseLessonPlansResponseDto>(
        getListCourseLessonPlansQueryKey(COURSE_ID),
      );
      expect(answered?.plannedWorkloadMinutes).toBe(90 + 90 + 150 + 90 + 150);
      expect(shown).toBe(
        `Carga horária prevista: ${formatHours(answered!.plannedWorkloadMinutes)}`,
      );
    });

    it("saves an empty sequence, which clears it", async () => {
      const user = userEvent.setup();
      const onCall = vi.fn();
      server.use(replaceCourseLessonPlansHandler({ onCall }));
      const { onClose } = await renderDialog({ sequence: buildCourseSequence([]) });

      await user.click(button("Salvar sequência"));

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCall.mock.calls[0][0].body).toEqual({ lessonPlanIds: [] });
    });

    it("locks the dialog while it saves", async () => {
      const user = userEvent.setup();
      const deferred = createDeferred();
      server.use(replaceCourseLessonPlansHandler({ delay: deferred.promise }));
      const { onClose } = await renderDialog();

      await user.click(button("Salvar sequência"));

      expect(await screen.findByRole("button", { name: "Salvando…" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      expect(button("Cancelar")).toBeDisabled();
      expect(button("Fechar")).toBeDisabled();
      // What is on the screen is what was sent, so the picker and every row are locked too.
      expect(button(/Adicionar plano de aula/)).toBeDisabled();
      expect(button("Adicionar")).toBeDisabled();
      for (const title of SEQUENCE_TITLES) {
        expect(button(`Arrastar ${title} para reordenar`)).toBeDisabled();
        expect(button(`Mover ${title} para cima`)).toBeDisabled();
        expect(button(`Mover ${title} para baixo`)).toBeDisabled();
        expect(button(`Remover ${title} da sequência`)).toBeDisabled();
      }
      for (const row of within(list()).getAllByRole("row")) {
        expect(row).not.toHaveAttribute("draggable");
      }
      await user.keyboard("{Escape}");
      expect(onClose).not.toHaveBeenCalled();

      deferred.resolve();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("does not let the draft change while the request is on its way, so what is saved is what is shown", async () => {
      const user = userEvent.setup();
      const deferred = createDeferred();
      const onCall = vi.fn();
      server.use(replaceCourseLessonPlansHandler({ delay: deferred.promise, onCall }));
      const { queryClient, onClose } = await renderDialog();

      await user.click(button("Salvar sequência"));
      await screen.findByRole("button", { name: "Salvando…" });
      await user.click(button("Mover Senhas e privacidade para cima"));
      await user.click(button("Mover Conhecendo o WhatsApp para baixo"));
      await user.click(button("Remover Reconhecendo golpes da sequência"));
      await user.click(button("Adicionar"));

      expect(rowTitles()).toEqual(SEQUENCE_TITLES);
      expect(workload()).toBe("Carga horária prevista: 7h");
      deferred.resolve();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledExactlyOnceWith({
        id: COURSE_ID,
        body: {
          lessonPlanIds: [
            buildSequenceItem().lessonPlanId,
            "lesson-plan-04",
            "lesson-plan-05",
            "lesson-plan-06",
          ],
        },
      });
      expect(
        queryClient.getQueryData<CourseLessonPlansResponseDto>(
          getListCourseLessonPlansQueryKey(COURSE_ID),
        )?.items,
      ).toHaveLength(4);
    });

    it("sends the request once even if Salvar sequência is pressed again", async () => {
      const user = userEvent.setup();
      const deferred = createDeferred();
      const onCall = vi.fn();
      server.use(replaceCourseLessonPlansHandler({ delay: deferred.promise, onCall }));
      await renderDialog();

      await user.click(button("Salvar sequência"));
      await user.click(await screen.findByRole("button", { name: "Salvando…" }));
      deferred.resolve();

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
    });
  });

  describe("cancelling", () => {
    function Host({ onCall }: { onCall?: () => void }) {
      const [isOpen, setIsOpen] = useState(true);

      return (
        <>
          <button type="button" onClick={() => setIsOpen(true)}>
            Abrir
          </button>
          {isOpen ? (
            <BuildSequenceDialog
              courseId={COURSE_ID}
              sequence={buildCourseSequence()}
              onClose={() => {
                onCall?.();
                setIsOpen(false);
              }}
              onCourseArchived={() => {}}
            />
          ) : null}
        </>
      );
    }

    it("Cancelar sends nothing and reopening shows the saved order", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      server.use(replaceCourseLessonPlansHandler({ onCall: onSave }));
      await renderWithProviders(<Host />);
      await screen.findByRole("dialog", { name: "Montar sequência do curso" });

      await user.click(button("Mover Senhas e privacidade para cima"));
      await chooseAndAdd(user, "Fotos no celular · 1h30");
      await user.click(button("Remover Reconhecendo golpes da sequência"));
      expect(rowTitles()).not.toEqual(SEQUENCE_TITLES);
      await user.click(button("Cancelar"));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: "Abrir" }));
      await screen.findByRole("dialog", { name: "Montar sequência do curso" });

      expect(onSave).not.toHaveBeenCalled();
      expect(rowTitles()).toEqual(SEQUENCE_TITLES);
      expect(workload()).toBe("Carga horária prevista: 7h");
    });

    it("Esc closes the dialog from a button of a row, and not only from the title", async () => {
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await user.click(button("Mover Senhas e privacidade para cima"));
      await waitFor(() => expect(button("Mover Senhas e privacidade para cima")).toHaveFocus());
      await user.keyboard("{Escape}");

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("Esc and the Fechar button throw the draft away too", async () => {
      const user = userEvent.setup();
      await renderWithProviders(<Host />);
      await screen.findByRole("dialog", { name: "Montar sequência do curso" });

      await user.click(button("Remover Reconhecendo golpes da sequência"));
      await waitFor(() =>
        expect(button("Remover Senhas e privacidade da sequência")).toHaveFocus(),
      );
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: "Abrir" }));
      await screen.findByRole("dialog", { name: "Montar sequência do curso" });
      expect(rowTitles()).toEqual(SEQUENCE_TITLES);

      await user.click(button("Remover Reconhecendo golpes da sequência"));
      await user.click(button("Fechar"));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: "Abrir" }));
      await screen.findByRole("dialog", { name: "Montar sequência do curso" });
      expect(rowTitles()).toEqual(SEQUENCE_TITLES);
    });
  });

  describe("errors of the PUT", () => {
    async function failToSave(user: User, error: ApiErrorOptions | { networkError: true }) {
      server.use(replaceCourseLessonPlansHandler("networkError" in error ? error : { error }));
      const view = await renderDialog();
      await user.click(button("Mover Senhas e privacidade para cima"));
      await user.click(button("Salvar sequência"));
      return view;
    }

    it.each([
      [
        "DUPLICATE_LESSON_PLAN",
        DUPLICATE_LESSON_PLAN_ERROR,
        "Um plano de aula não pode aparecer duas vezes na sequência. Remova o repetido e tente de novo.",
      ],
      [
        "LESSON_PLAN_ARCHIVED",
        SEQUENCE_PLAN_ARCHIVED_ERROR,
        "Um dos planos de aula está arquivado e não pode entrar na sequência. Remova-o e tente de novo.",
      ],
      [
        "LESSON_PLAN_NOT_FOUND",
        SEQUENCE_PLAN_NOT_FOUND_ERROR,
        "Um dos planos de aula não foi encontrado. Feche esta janela, atualize a página e tente de novo.",
      ],
      [
        "VALIDATION_FAILED (an id that is not a UUID)",
        { statusCode: 400, error: "VALIDATION_FAILED" },
        "Um dos planos de aula não foi encontrado. Feche esta janela, atualize a página e tente de novo.",
      ],
      ["COURSE_NOT_FOUND", COURSE_NOT_FOUND_ERROR, "Este curso não existe mais. Nada foi salvo."],
      [
        "a server error",
        { statusCode: 500, error: "INTERNAL_SERVER_ERROR" },
        "Não foi possível salvar a sequência. Tente novamente.",
      ],
    ])("shows %s as an alert and keeps the draft", async (_label, error, message) => {
      const user = userEvent.setup();
      const { onClose, onCourseArchived } = await failToSave(user, error);

      const alert = await within(dialog()).findByRole("alert");

      expect(alert).toHaveTextContent(message);
      expect(rowTitles()).toEqual([
        "Conhecendo o WhatsApp",
        "Senhas e privacidade",
        "Enviar um áudio no WhatsApp",
        "Reconhecendo golpes",
      ]);
      expect(onClose).not.toHaveBeenCalled();
      expect(onCourseArchived).not.toHaveBeenCalled();
      expect(button("Salvar sequência")).toBeEnabled();
    });

    it("shows a network failure as an alert and keeps the draft", async () => {
      const user = userEvent.setup();
      const { onClose } = await failToSave(user, { networkError: true });

      expect(await within(dialog()).findByRole("alert")).toHaveTextContent(
        "Não foi possível conectar. Verifique sua conexão e tente novamente.",
      );
      expect(rowTitles()[1]).toBe("Senhas e privacidade");
      expect(onClose).not.toHaveBeenCalled();
    });

    it("unlocks the picker, the arrows, Remover and the handles when the save fails", async () => {
      const user = userEvent.setup();
      await failToSave(user, DUPLICATE_LESSON_PLAN_ERROR);
      await within(dialog()).findByRole("alert");

      expect(button(/Adicionar plano de aula/)).toBeEnabled();
      expect(button("Adicionar")).toBeEnabled();
      expect(button("Arrastar Senhas e privacidade para reordenar")).toBeEnabled();
      expect(button("Mover Senhas e privacidade para cima")).toBeEnabled();
      expect(button("Mover Senhas e privacidade para baixo")).toBeEnabled();
      expect(button("Remover Senhas e privacidade da sequência")).toBeEnabled();
      // The edges of the list stay off, as before.
      expect(button("Mover Conhecendo o WhatsApp para cima")).toBeDisabled();
      expect(button("Mover Reconhecendo golpes para baixo")).toBeDisabled();
    });

    it("moves the focus to the alert, so that it is read and in view", async () => {
      const user = userEvent.setup();
      await failToSave(user, DUPLICATE_LESSON_PLAN_ERROR);

      const alert = await within(dialog()).findByRole("alert");

      await waitFor(() => expect(alert.parentElement).toHaveFocus());
    });

    it("takes the alert away when the draft changes, and again when saving is tried", async () => {
      const user = userEvent.setup();
      await failToSave(user, DUPLICATE_LESSON_PLAN_ERROR);
      await within(dialog()).findByRole("alert");

      await user.click(button("Remover Reconhecendo golpes da sequência"));

      expect(within(dialog()).queryByRole("alert")).not.toBeInTheDocument();
    });

    it("lets the person fix the draft and save again", async () => {
      const user = userEvent.setup();
      const onCall = vi.fn();
      server.use(replaceCourseLessonPlansHandler({ error: DUPLICATE_LESSON_PLAN_ERROR, onCall }));
      const { onClose } = await renderDialog();
      await user.click(button("Salvar sequência"));
      await within(dialog()).findByRole("alert");

      server.use(replaceCourseLessonPlansHandler({ onCall }));
      await user.click(button("Remover Reconhecendo golpes da sequência"));
      await user.click(button("Salvar sequência"));

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledTimes(2);
      expect(onCall.mock.calls[1][0].body.lessonPlanIds).toHaveLength(3);
    });

    it("COURSE_ARCHIVED disables Salvar sequência and reports the course as archived", async () => {
      const user = userEvent.setup();
      const { onClose, onCourseArchived } = await failToSave(user, COURSE_ARCHIVED_ERROR);

      expect(await within(dialog()).findByRole("alert")).toHaveTextContent(
        "Este curso está arquivado e a sequência não pode ser alterada.",
      );
      expect(onCourseArchived).toHaveBeenCalledTimes(1);
      expect(button("Salvar sequência")).toBeDisabled();
      expect(onClose).not.toHaveBeenCalled();
      expect(rowTitles()[1]).toBe("Senhas e privacidade");
    });

    it("keeps the archived course alert when the draft changes, since it says nothing about the draft", async () => {
      const user = userEvent.setup();
      await failToSave(user, COURSE_ARCHIVED_ERROR);
      await within(dialog()).findByRole("alert");

      await user.click(button("Remover Reconhecendo golpes da sequência"));

      expect(within(dialog()).getByRole("alert")).toBeInTheDocument();
      expect(button("Salvar sequência")).toBeDisabled();
    });
  });
});
