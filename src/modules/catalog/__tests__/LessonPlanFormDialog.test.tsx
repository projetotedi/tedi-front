import { useState } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getGetLessonPlanQueryKey } from "@api/generated/catalog/catalog";

import { LessonPlanFormDialog } from "../components/LessonPlanFormDialog";
import {
  ARCHIVED_ERROR,
  buildArchivedLessonPlanDetail,
  buildLessonPlan,
  buildLessonPlanDetail,
  createLessonPlanHandler,
  getLessonPlanHandler,
  LESSON_PLAN_ID,
  NOT_FOUND_ERROR,
  updateLessonPlanHandler,
  VALIDATION_ERROR,
} from "./handlers";
import { createDeferred, renderWithProviders, server, setupCatalogTestServer } from "./test-utils";

setupCatalogTestServer();

const textbox = (name: string | RegExp) => screen.getByRole("textbox", { name });
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const contentValues = () =>
  screen
    .getAllByRole("textbox", { name: /^Conteúdo \d+$/ })
    .map((input) => (input as HTMLInputElement).value);

async function renderCreate() {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const view = await renderWithProviders(
    <LessonPlanFormDialog mode="create" onClose={onClose} onSaved={onSaved} />,
  );
  await screen.findByRole("dialog", { name: "Novo plano de aula" });
  return { ...view, onClose, onSaved };
}

async function renderEdit() {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const view = await renderWithProviders(
    <LessonPlanFormDialog
      mode="edit"
      lessonPlanId={LESSON_PLAN_ID}
      onClose={onClose}
      onSaved={onSaved}
    />,
  );
  await screen.findByRole("dialog", { name: "Editar plano de aula" });
  return { ...view, onClose, onSaved };
}

async function fillRequiredFields(user: UserEvent) {
  await user.type(textbox("Título do plano"), "Teclado, mouse e janelas");
  await user.type(textbox("Horas"), "1");
  await user.type(textbox("Minutos"), "30");
  await user.type(textbox("Conteúdo 1"), "Teclado e mouse");
}

async function submit(user: UserEvent) {
  await user.click(button("Salvar plano"));
}

describe("LessonPlanFormDialog (create)", () => {
  describe("layout", () => {
    it("opens the Novo plano de aula dialog with every field of the design", async () => {
      await renderCreate();

      const dialog = screen.getByRole("dialog", { name: "Novo plano de aula" });
      expect(within(dialog).getByRole("textbox", { name: "Título do plano" })).toBeInTheDocument();
      expect(within(dialog).getByRole("group", { name: "Duração prevista" })).toBeInTheDocument();
      expect(within(dialog).getByRole("textbox", { name: "Horas" })).toBeInTheDocument();
      expect(within(dialog).getByRole("textbox", { name: "Minutos" })).toBeInTheDocument();
      expect(within(dialog).getByRole("group", { name: "Conteúdos" })).toBeInTheDocument();
      expect(within(dialog).getByRole("textbox", { name: "Conteúdo 1" })).toBeInTheDocument();
      expect(within(dialog).getByRole("textbox", { name: "Objetivo" })).toBeInTheDocument();
      expect(within(dialog).getByRole("textbox", { name: "Link do material" })).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Salvar plano" })).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Fechar" })).toBeInTheDocument();
    });

    it("is the wide 800px dialog", async () => {
      await renderCreate();

      expect(screen.getByRole("dialog", { name: "Novo plano de aula" })).toHaveClass("max-w-200");
    });

    it("explains the duration and the material link", async () => {
      await renderCreate();

      expect(screen.getByRole("group", { name: "Duração prevista" })).toHaveAccessibleDescription(
        "Entra na carga horária dos cursos que usam este plano.",
      );
      expect(textbox("Link do material")).toHaveAccessibleDescription(
        "O sistema guarda o link, não o arquivo.",
      );
    });

    it("marks the title, the duration and the contents as required", async () => {
      await renderCreate();

      expect(textbox("Título do plano")).toBeRequired();
      for (const label of ["Duração prevista", "Conteúdos"]) {
        expect(screen.getByRole("group", { name: label }).textContent).toContain("*");
      }
      expect(textbox("Objetivo")).not.toBeRequired();
      expect(textbox("Link do material")).not.toBeRequired();
    });

    it("focuses the title when the dialog opens", async () => {
      await renderCreate();

      expect(textbox("Título do plano")).toHaveFocus();
    });

    it("offers the numeric keyboard for hours and minutes and the url keyboard for the link", async () => {
      await renderCreate();

      expect(textbox("Horas")).toHaveAttribute("inputmode", "numeric");
      expect(textbox("Minutos")).toHaveAttribute("inputmode", "numeric");
      expect(textbox("Link do material")).toHaveAttribute("inputmode", "url");
    });

    it("keeps the 44px touch targets on every button", async () => {
      await renderCreate();

      for (const name of [
        "Cancelar",
        "Salvar plano",
        "+ Adicionar conteúdo",
        "Subir conteúdo 1",
        "Descer conteúdo 1",
        "Remover conteúdo 1",
      ]) {
        expect(button(name)).toHaveClass("min-h-11");
      }
      expect(button("Remover conteúdo 1")).toHaveClass("min-w-11");
    });
  });

  describe("validation", () => {
    it("shows an error on each invalid field and focuses the first one", async () => {
      const onCall = vi.fn();
      server.use(createLessonPlanHandler({ onCall }));
      const user = userEvent.setup();
      await renderCreate();

      await submit(user);

      expect(await screen.findByText("Informe o título do plano.")).toBeInTheDocument();
      expect(textbox("Título do plano")).toHaveAttribute("aria-invalid", "true");
      expect(textbox("Título do plano")).toHaveAccessibleDescription("Informe o título do plano.");
      expect(textbox("Horas")).toHaveAccessibleDescription("A duração deve ser maior que zero.");
      expect(textbox("Conteúdo 1")).toHaveAccessibleDescription(
        "Preencha o conteúdo ou remova este item.",
      );
      await waitFor(() => expect(textbox("Título do plano")).toHaveFocus());
      expect(onCall).not.toHaveBeenCalled();
    });

    it("requires a duration greater than zero and focuses the hours", async () => {
      const user = userEvent.setup();
      await renderCreate();
      await user.type(textbox("Título do plano"), "Teclado");
      await user.type(textbox("Horas"), "0");
      await user.type(textbox("Minutos"), "0");
      await user.type(textbox("Conteúdo 1"), "Teclado e mouse");

      await submit(user);

      expect(await screen.findByText("A duração deve ser maior que zero.")).toBeInTheDocument();
      expect(textbox("Horas")).toHaveAttribute("aria-invalid", "true");
      await waitFor(() => expect(textbox("Horas")).toHaveFocus());
      expect(textbox("Título do plano")).not.toHaveAttribute("aria-invalid", "true");
    });

    it("rejects minutes above 59 and focuses the minutes", async () => {
      const user = userEvent.setup();
      await renderCreate();
      await user.type(textbox("Título do plano"), "Teclado");
      await user.type(textbox("Horas"), "1");
      await user.type(textbox("Minutos"), "75");
      await user.type(textbox("Conteúdo 1"), "Teclado e mouse");

      await submit(user);

      expect(await screen.findByText("Informe minutos de 0 a 59.")).toBeInTheDocument();
      await waitFor(() => expect(textbox("Minutos")).toHaveFocus());
    });

    it("rejects hours that are not whole numbers and focuses the hours", async () => {
      const user = userEvent.setup();
      await renderCreate();
      await user.type(textbox("Título do plano"), "Teclado");
      await user.type(textbox("Horas"), "1,5");
      await user.type(textbox("Conteúdo 1"), "Teclado e mouse");

      await submit(user);

      expect(await screen.findByText("Use apenas números inteiros.")).toBeInTheDocument();
      await waitFor(() => expect(textbox("Horas")).toHaveFocus());
    });

    it("rejects more than 24 hours", async () => {
      const user = userEvent.setup();
      await renderCreate();
      await user.type(textbox("Título do plano"), "Teclado");
      await user.type(textbox("Horas"), "25");
      await user.type(textbox("Conteúdo 1"), "Teclado e mouse");

      await submit(user);

      expect(await screen.findByText("A duração máxima é de 24 horas.")).toBeInTheDocument();
    });

    it("focuses the first empty content when the title and the duration are fine", async () => {
      const user = userEvent.setup();
      await renderCreate();
      await user.type(textbox("Título do plano"), "Teclado");
      await user.type(textbox("Horas"), "1");
      await user.click(button("+ Adicionar conteúdo"));
      await user.type(textbox("Conteúdo 2"), "Janelas");

      await submit(user);

      expect(
        await screen.findByText("Preencha o conteúdo ou remova este item."),
      ).toBeInTheDocument();
      await waitFor(() => expect(textbox("Conteúdo 1")).toHaveFocus());
      expect(textbox("Conteúdo 2")).not.toHaveAttribute("aria-invalid", "true");
    });

    it("rejects an invalid material link and focuses it when it is the first error", async () => {
      const onCall = vi.fn();
      server.use(createLessonPlanHandler({ onCall }));
      const user = userEvent.setup();
      await renderCreate();
      await fillRequiredFields(user);
      await user.type(textbox("Link do material"), "drive.google.com/arquivo");

      await submit(user);

      expect(
        await screen.findByText("Informe um link válido, começando com http:// ou https://."),
      ).toBeInTheDocument();
      expect(textbox("Link do material")).toHaveAttribute("aria-invalid", "true");
      await waitFor(() => expect(textbox("Link do material")).toHaveFocus());
      expect(onCall).not.toHaveBeenCalled();
    });

    it("rejects a title longer than 200 characters", async () => {
      const user = userEvent.setup();
      await renderCreate();
      await user.click(textbox("Título do plano"));
      await user.paste("a".repeat(201));

      await submit(user);

      expect(
        await screen.findByText("O título pode ter no máximo 200 caracteres."),
      ).toBeInTheDocument();
    });

    it("clears the error of a field as soon as it is fixed", async () => {
      const user = userEvent.setup();
      await renderCreate();
      await submit(user);
      await screen.findByText("Informe o título do plano.");

      await user.type(textbox("Título do plano"), "Teclado");

      await waitFor(() =>
        expect(screen.queryByText("Informe o título do plano.")).not.toBeInTheDocument(),
      );
      expect(textbox("Título do plano")).not.toHaveAttribute("aria-invalid", "true");
    });

    it("does not block a plan without objective and without link", async () => {
      const onCall = vi.fn();
      server.use(createLessonPlanHandler({ onCall }));
      const user = userEvent.setup();
      await renderCreate();
      await fillRequiredFields(user);

      await submit(user);

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
    });
  });

  describe("contents list", () => {
    it("starts with one content and cannot remove the last one", async () => {
      await renderCreate();

      expect(contentValues()).toEqual([""]);
      expect(button("Remover conteúdo 1")).toBeDisabled();
    });

    it("adds a content and focuses its field", async () => {
      const user = userEvent.setup();
      await renderCreate();

      await user.click(button("+ Adicionar conteúdo"));

      expect(contentValues()).toEqual(["", ""]);
      await waitFor(() => expect(textbox("Conteúdo 2")).toHaveFocus());
      expect(button("Remover conteúdo 1")).toBeEnabled();
    });

    it("removes a content and keeps the others in order", async () => {
      const user = userEvent.setup();
      await renderCreate();
      await user.type(textbox("Conteúdo 1"), "A");
      await user.click(button("+ Adicionar conteúdo"));
      await user.type(textbox("Conteúdo 2"), "B");
      await user.click(button("+ Adicionar conteúdo"));
      await user.type(textbox("Conteúdo 3"), "C");

      await user.click(button("Remover conteúdo 2"));

      expect(contentValues()).toEqual(["A", "C"]);
    });

    it("moves the focus to the next content after removing one", async () => {
      const user = userEvent.setup();
      await renderCreate();
      await user.type(textbox("Conteúdo 1"), "A");
      await user.click(button("+ Adicionar conteúdo"));
      await user.type(textbox("Conteúdo 2"), "B");

      await user.click(button("Remover conteúdo 1"));

      await waitFor(() => expect(textbox("Conteúdo 1")).toHaveFocus());
      expect(contentValues()).toEqual(["B"]);
    });

    it("moves the focus to the previous content after removing the last one", async () => {
      const user = userEvent.setup();
      await renderCreate();
      await user.type(textbox("Conteúdo 1"), "A");
      await user.click(button("+ Adicionar conteúdo"));
      await user.type(textbox("Conteúdo 2"), "B");

      await user.click(button("Remover conteúdo 2"));

      await waitFor(() => expect(textbox("Conteúdo 1")).toHaveFocus());
      expect(contentValues()).toEqual(["A"]);
    });

    it("moves a content up and keeps the focus on the button that was pressed", async () => {
      const user = userEvent.setup();
      await renderCreate();
      await user.type(textbox("Conteúdo 1"), "A");
      await user.click(button("+ Adicionar conteúdo"));
      await user.type(textbox("Conteúdo 2"), "B");
      await user.click(button("+ Adicionar conteúdo"));
      await user.type(textbox("Conteúdo 3"), "C");

      await user.click(button("Subir conteúdo 3"));

      expect(contentValues()).toEqual(["A", "C", "B"]);
      await waitFor(() => expect(button("Subir conteúdo 2")).toHaveFocus());
    });

    it("moves a content down and keeps the focus on the button that was pressed", async () => {
      const user = userEvent.setup();
      await renderCreate();
      await user.type(textbox("Conteúdo 1"), "A");
      await user.click(button("+ Adicionar conteúdo"));
      await user.type(textbox("Conteúdo 2"), "B");
      await user.click(button("+ Adicionar conteúdo"));
      await user.type(textbox("Conteúdo 3"), "C");

      await user.click(button("Descer conteúdo 1"));

      expect(contentValues()).toEqual(["B", "A", "C"]);
      await waitFor(() => expect(button("Descer conteúdo 2")).toHaveFocus());
    });

    it("passes the focus to the opposite arrow when the content reaches an edge", async () => {
      const user = userEvent.setup();
      await renderCreate();
      await user.type(textbox("Conteúdo 1"), "A");
      await user.click(button("+ Adicionar conteúdo"));
      await user.type(textbox("Conteúdo 2"), "B");

      await user.click(button("Subir conteúdo 2"));

      expect(contentValues()).toEqual(["B", "A"]);
      expect(button("Subir conteúdo 1")).toBeDisabled();
      await waitFor(() => expect(button("Descer conteúdo 1")).toHaveFocus());
    });

    it("disables the arrows at the edges", async () => {
      const user = userEvent.setup();
      await renderCreate();
      await user.click(button("+ Adicionar conteúdo"));

      expect(button("Subir conteúdo 1")).toBeDisabled();
      expect(button("Descer conteúdo 1")).toBeEnabled();
      expect(button("Subir conteúdo 2")).toBeEnabled();
      expect(button("Descer conteúdo 2")).toBeDisabled();
    });

    it("announces a move and a removal to screen readers", async () => {
      const user = userEvent.setup();
      await renderCreate();
      await user.type(textbox("Conteúdo 1"), "A");
      await user.click(button("+ Adicionar conteúdo"));
      await user.type(textbox("Conteúdo 2"), "B");
      await user.click(button("+ Adicionar conteúdo"));
      await user.type(textbox("Conteúdo 3"), "C");
      const group = screen.getByRole("group", { name: "Conteúdos" });

      await user.click(button("Subir conteúdo 3"));
      expect(within(group).getByRole("status")).toHaveTextContent(
        "Conteúdo 3 movido para a posição 2 de 3.",
      );

      await user.click(button("Remover conteúdo 1"));
      expect(within(group).getByRole("status")).toHaveTextContent(
        "Conteúdo 1 removido. Restam 2 conteúdos.",
      );
    });

    it("lists the contents as an ordered list", async () => {
      const user = userEvent.setup();
      await renderCreate();
      await user.click(button("+ Adicionar conteúdo"));

      const list = within(screen.getByRole("group", { name: "Conteúdos" })).getByRole("list");

      expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    });

    it("stops adding at 50 contents and says why", async () => {
      const fortyNineContents = Array.from({ length: 49 }, (_, index) => `Conteúdo ${index + 1}`);
      server.use(
        getLessonPlanHandler({ response: buildLessonPlanDetail({ contents: fortyNineContents }) }),
      );
      const user = userEvent.setup();
      await renderEdit();
      await screen.findByRole("textbox", { name: "Conteúdo 49" });
      expect(button("+ Adicionar conteúdo")).toBeEnabled();

      await user.click(button("+ Adicionar conteúdo"));

      expect(contentValues()).toHaveLength(50);
      expect(button("+ Adicionar conteúdo")).toBeDisabled();
      expect(screen.getByText("Limite de 50 conteúdos atingido.")).toBeInTheDocument();
    });
  });

  describe("saving", () => {
    it("creates the plan with the duration in minutes and the contents in order", async () => {
      const onCall = vi.fn();
      server.use(createLessonPlanHandler({ onCall }));
      const user = userEvent.setup();
      await renderCreate();
      await user.type(textbox("Título do plano"), "Teclado, mouse e janelas");
      await user.type(textbox("Horas"), "1");
      await user.type(textbox("Minutos"), "30");
      await user.type(textbox("Conteúdo 1"), "Janelas do sistema");
      await user.click(button("+ Adicionar conteúdo"));
      await user.type(textbox("Conteúdo 2"), "Teclado e mouse");
      await user.click(button("Subir conteúdo 2"));
      await user.type(textbox("Objetivo"), "Familiarizar o aluno com o teclado.");
      await user.type(textbox("Link do material"), "https://drive.google.com/file/d/exemplo/view");

      await submit(user);

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledWith({
        body: {
          title: "Teclado, mouse e janelas",
          objective: "Familiarizar o aluno com o teclado.",
          expectedDurationMinutes: 90,
          contents: ["Teclado e mouse", "Janelas do sistema"],
          materialUrl: "https://drive.google.com/file/d/exemplo/view",
        },
      });
    });

    it("sends null for the objective and the link that were left empty", async () => {
      const onCall = vi.fn();
      server.use(createLessonPlanHandler({ onCall }));
      const user = userEvent.setup();
      await renderCreate();
      await fillRequiredFields(user);

      await submit(user);

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall.mock.calls[0]?.[0].body).toMatchObject({
        objective: null,
        materialUrl: null,
        expectedDurationMinutes: 90,
      });
    });

    it("trims the texts before sending", async () => {
      const onCall = vi.fn();
      server.use(createLessonPlanHandler({ onCall }));
      const user = userEvent.setup();
      await renderCreate();
      await user.type(textbox("Título do plano"), "  Teclado  ");
      await user.type(textbox("Horas"), "2");
      await user.type(textbox("Conteúdo 1"), "  Teclado e mouse  ");

      await submit(user);

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall.mock.calls[0]?.[0].body).toMatchObject({
        title: "Teclado",
        contents: ["Teclado e mouse"],
        expectedDurationMinutes: 120,
      });
    });

    it("shows the success toast, calls onSaved and closes", async () => {
      const created = buildLessonPlan({ title: "Plano novo" });
      server.use(createLessonPlanHandler({ response: created }));
      const user = userEvent.setup();
      const { onClose, onSaved } = await renderCreate();
      await fillRequiredFields(user);

      await submit(user);

      expect(await screen.findByText("Plano de aula criado.")).toBeInTheDocument();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onSaved).toHaveBeenCalledWith(created);
    });

    it("refreshes every cached lesson plan query without a reload", async () => {
      server.use(createLessonPlanHandler());
      const user = userEvent.setup();
      const { queryClient } = await renderCreate();
      const detailKey = getGetLessonPlanQueryKey(LESSON_PLAN_ID);
      const listKey = ["/lesson-plans", { page: 1 }] as const;
      queryClient.setQueryData(detailKey, buildLessonPlan());
      queryClient.setQueryData(listKey, { data: [] });
      queryClient.setQueryData(["/auth/profile"], { name: "Ana" });
      await fillRequiredFields(user);

      await submit(user);

      await screen.findByText("Plano de aula criado.");
      expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(["/auth/profile"])?.isInvalidated).toBe(false);
    });

    it("Cancelar closes without sending anything", async () => {
      const onCall = vi.fn();
      server.use(createLessonPlanHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderCreate();
      await user.type(textbox("Título do plano"), "Teclado");

      await user.click(button("Cancelar"));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onCall).not.toHaveBeenCalled();
    });

    it("the close button and Escape also close", async () => {
      const user = userEvent.setup();
      const { onClose } = await renderCreate();

      await user.click(button("Fechar"));
      expect(onClose).toHaveBeenCalledTimes(1);

      await user.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledTimes(2);
    });
  });

  describe("while saving", () => {
    async function startSaving() {
      const deferred = createDeferred();
      const onCall = vi.fn();
      server.use(createLessonPlanHandler({ delay: deferred.promise, onCall }));
      const user = userEvent.setup();
      const view = await renderCreate();
      await fillRequiredFields(user);
      await submit(user);
      await screen.findByRole("button", { name: "Salvando…" });
      return { ...view, user, deferred, onCall };
    }

    it("shows the saving state and disables Cancelar", async () => {
      const { deferred } = await startSaving();

      expect(button("Salvando…")).toBeInTheDocument();
      expect(screen.getByRole("dialog").querySelector("form")).toHaveAttribute("aria-busy", "true");
      expect(button("Cancelar")).toBeDisabled();

      deferred.resolve();
    });

    it("ignores Escape and the close button until the answer arrives", async () => {
      const { user, onClose, deferred } = await startSaving();

      await user.keyboard("{Escape}");
      await user.click(button("Fechar"));

      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog", { name: "Novo plano de aula" })).toBeInTheDocument();

      deferred.resolve();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("does not send a second request on a double click", async () => {
      const deferred = createDeferred();
      const onCall = vi.fn();
      server.use(createLessonPlanHandler({ delay: deferred.promise, onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderCreate();
      await fillRequiredFields(user);

      await user.dblClick(button("Salvar plano"));
      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      deferred.resolve();

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledTimes(1);
    });
  });

  describe("server errors", () => {
    it("shows the server validation errors on the fields and focuses the first one", async () => {
      server.use(
        createLessonPlanHandler({
          error: VALIDATION_ERROR([
            { field: "materialUrl", message: "materialUrl must be a URL address" },
            { field: "title", message: "title should not be empty" },
          ]),
        }),
      );
      const user = userEvent.setup();
      const { onClose } = await renderCreate();
      await fillRequiredFields(user);

      await submit(user);

      expect(await screen.findByText("Revise este campo e tente de novo.")).toBeInTheDocument();
      expect(textbox("Título do plano")).toHaveAttribute("aria-invalid", "true");
      expect(
        screen.getByText("Informe um link válido, começando com http:// ou https://."),
      ).toBeInTheDocument();
      expect(textbox("Link do material")).toHaveAttribute("aria-invalid", "true");
      await waitFor(() => expect(textbox("Título do plano")).toHaveFocus());
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.queryByText("Plano de aula criado.")).not.toBeInTheDocument();
    });

    it("maps a server duration error to the hours field", async () => {
      server.use(
        createLessonPlanHandler({
          error: VALIDATION_ERROR([
            { field: "expectedDurationMinutes", message: "must not be greater than 1440" },
          ]),
        }),
      );
      const user = userEvent.setup();
      await renderCreate();
      await fillRequiredFields(user);

      await submit(user);

      expect(
        await screen.findByText("Informe uma duração entre 1 minuto e 24 horas."),
      ).toBeInTheDocument();
      await waitFor(() => expect(textbox("Horas")).toHaveFocus());
    });

    it("maps a server error on the contents to the first content", async () => {
      server.use(
        createLessonPlanHandler({
          error: VALIDATION_ERROR([
            { field: "contents", message: "each value in contents should not be empty" },
          ]),
        }),
      );
      const user = userEvent.setup();
      await renderCreate();
      await fillRequiredFields(user);

      await submit(user);

      expect(await screen.findByText(/^Revise os conteúdos/)).toBeInTheDocument();
      await waitFor(() => expect(textbox("Conteúdo 1")).toHaveFocus());
    });

    it("lets the user fix the field and send again", async () => {
      const onCall = vi.fn();
      server.use(
        createLessonPlanHandler({
          error: VALIDATION_ERROR([{ field: "title", message: "title should not be empty" }]),
        }),
      );
      const user = userEvent.setup();
      const { onClose } = await renderCreate();
      await fillRequiredFields(user);
      await submit(user);
      await screen.findByText("Revise este campo e tente de novo.");

      server.use(createLessonPlanHandler({ onCall }));
      await user.type(textbox("Título do plano"), " v2");
      await submit(user);

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledTimes(1);
    });

    it("shows a network error without closing and lets the user try again", async () => {
      server.use(createLessonPlanHandler({ networkError: true }));
      const user = userEvent.setup();
      const { onClose } = await renderCreate();
      await fillRequiredFields(user);

      await submit(user);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(
        "Não foi possível conectar. Verifique sua conexão e tente novamente.",
      );
      await waitFor(() => expect(alert.parentElement).toHaveFocus());
      expect(onClose).not.toHaveBeenCalled();
      expect(button("Salvar plano")).toBeEnabled();
      expect(textbox("Título do plano")).toHaveValue("Teclado, mouse e janelas");
    });

    it("shows a generic error for an unexpected failure", async () => {
      server.use(
        createLessonPlanHandler({ error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" } }),
      );
      const user = userEvent.setup();
      await renderCreate();
      await fillRequiredFields(user);

      await submit(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível concluir a ação. Tente novamente.",
      );
    });

    it("clears the error when sending again", async () => {
      server.use(createLessonPlanHandler({ networkError: true }));
      const user = userEvent.setup();
      const { onClose } = await renderCreate();
      await fillRequiredFields(user);
      await submit(user);
      await screen.findByRole("alert");

      server.use(createLessonPlanHandler());
      await submit(user);

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(
        screen.queryByText("Não foi possível conectar. Verifique sua conexão e tente novamente."),
      ).not.toBeInTheDocument();
    });
  });
});

describe("LessonPlanFormDialog (edit)", () => {
  describe("loading the plan", () => {
    it("shows a loading state and keeps Salvar alterações disabled until the plan arrives", async () => {
      const deferred = createDeferred();
      server.use(getLessonPlanHandler({ delay: deferred.promise }));
      await renderEdit();

      expect(screen.getByRole("status")).toHaveTextContent("Carregando o plano de aula…");
      expect(button("Salvar alterações")).toBeDisabled();
      expect(screen.queryByRole("textbox", { name: "Título do plano" })).not.toBeInTheDocument();

      deferred.resolve();
      expect(await screen.findByRole("textbox", { name: "Título do plano" })).toBeInTheDocument();
      expect(button("Salvar alterações")).toBeEnabled();
    });

    it("requests the plan by id", async () => {
      const onCall = vi.fn();
      server.use(getLessonPlanHandler({ onCall }));
      await renderEdit();

      await screen.findByRole("textbox", { name: "Título do plano" });

      expect(onCall).toHaveBeenCalledWith({ id: LESSON_PLAN_ID });
    });

    it("opens the form already filled with the plan", async () => {
      server.use(
        getLessonPlanHandler({
          response: buildLessonPlanDetail({
            title: "Navegador e busca",
            objective: "Pesquisar com segurança.",
            expectedDurationMinutes: 135,
            contents: ["Abrir o navegador", "Fazer uma busca", "Reconhecer sites seguros"],
            materialUrl: "https://exemplo.com/navegador",
          }),
        }),
      );
      await renderEdit();

      expect(await screen.findByRole("textbox", { name: "Título do plano" })).toHaveValue(
        "Navegador e busca",
      );
      expect(textbox("Horas")).toHaveValue("2");
      expect(textbox("Minutos")).toHaveValue("15");
      expect(contentValues()).toEqual([
        "Abrir o navegador",
        "Fazer uma busca",
        "Reconhecer sites seguros",
      ]);
      expect(textbox("Objetivo")).toHaveValue("Pesquisar com segurança.");
      expect(textbox("Link do material")).toHaveValue("https://exemplo.com/navegador");
    });

    it("leaves the objective and the link empty when the plan has none", async () => {
      server.use(
        getLessonPlanHandler({
          response: buildLessonPlanDetail({ objective: null, materialUrl: null }),
        }),
      );
      await renderEdit();

      await screen.findByRole("textbox", { name: "Título do plano" });

      expect(textbox("Objetivo")).toHaveValue("");
      expect(textbox("Link do material")).toHaveValue("");
    });

    it("focuses the title once the plan is loaded", async () => {
      server.use(getLessonPlanHandler());
      await renderEdit();

      const title = await screen.findByRole("textbox", { name: "Título do plano" });

      await waitFor(() => expect(title).toHaveFocus());
    });

    it("uses the Salvar alterações label", async () => {
      server.use(getLessonPlanHandler());
      await renderEdit();

      await screen.findByRole("textbox", { name: "Título do plano" });

      expect(screen.queryByRole("button", { name: "Salvar plano" })).not.toBeInTheDocument();
      expect(button("Salvar alterações")).toBeInTheDocument();
    });

    it("explains that the plan was not found and lets the user try again", async () => {
      server.use(getLessonPlanHandler({ error: NOT_FOUND_ERROR }));
      const user = userEvent.setup();
      await renderEdit();

      expect(await screen.findByRole("alert")).toHaveTextContent("Plano de aula não encontrado.");
      expect(button("Salvar alterações")).toBeDisabled();

      server.use(getLessonPlanHandler());
      await user.click(button("Tentar de novo"));

      expect(await screen.findByRole("textbox", { name: "Título do plano" })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows a network error when the plan cannot be loaded", async () => {
      server.use(getLessonPlanHandler({ networkError: true }));
      await renderEdit();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível conectar. Verifique sua conexão e tente novamente.",
      );
    });

    it("does not offer the form for an archived plan", async () => {
      server.use(getLessonPlanHandler({ response: buildArchivedLessonPlanDetail() }));
      await renderEdit();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Este plano de aula está arquivado e não pode ser editado. Reative o plano para editar.",
      );
      expect(screen.queryByRole("textbox", { name: "Título do plano" })).not.toBeInTheDocument();
      expect(button("Salvar alterações")).toBeDisabled();
    });

    it("always shows the latest data when the dialog is opened again", async () => {
      server.use(
        getLessonPlanHandler({ response: buildLessonPlanDetail({ title: "Primeira versão" }) }),
      );
      const user = userEvent.setup();

      function Harness() {
        const [isOpen, setIsOpen] = useState(true);
        return (
          <>
            <button type="button" onClick={() => setIsOpen(true)}>
              Abrir de novo
            </button>
            {isOpen ? (
              <LessonPlanFormDialog
                mode="edit"
                lessonPlanId={LESSON_PLAN_ID}
                onClose={() => setIsOpen(false)}
              />
            ) : null}
          </>
        );
      }

      await renderWithProviders(<Harness />);
      expect(await screen.findByRole("textbox", { name: "Título do plano" })).toHaveValue(
        "Primeira versão",
      );
      await user.click(button("Cancelar"));

      server.use(
        getLessonPlanHandler({ response: buildLessonPlanDetail({ title: "Segunda versão" }) }),
      );
      await user.click(screen.getByRole("button", { name: "Abrir de novo" }));

      expect(await screen.findByRole("textbox", { name: "Título do plano" })).toHaveValue(
        "Segunda versão",
      );
    });
  });

  describe("saving", () => {
    it("updates the plan by id with the whole form, converting the duration to minutes", async () => {
      const onUpdate = vi.fn();
      server.use(getLessonPlanHandler(), updateLessonPlanHandler({ onCall: onUpdate }));
      const user = userEvent.setup();
      await renderEdit();
      const hours = await screen.findByRole("textbox", { name: "Horas" });
      await user.clear(hours);
      await user.type(hours, "2");
      await user.clear(textbox("Minutos"));
      await user.type(textbox("Minutos"), "0");

      await user.click(button("Salvar alterações"));

      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
      expect(onUpdate).toHaveBeenCalledWith({
        id: LESSON_PLAN_ID,
        body: {
          title: "Teclado, mouse e janelas",
          objective: "Familiarizar o aluno com o teclado, o mouse e o uso básico das janelas.",
          expectedDurationMinutes: 120,
          contents: ["Teclado e mouse", "Janelas do sistema"],
          materialUrl: "https://drive.google.com/file/d/exemplo/view",
        },
      });
    });

    it("sends null to clear the objective and the link", async () => {
      const onUpdate = vi.fn();
      server.use(getLessonPlanHandler(), updateLessonPlanHandler({ onCall: onUpdate }));
      const user = userEvent.setup();
      await renderEdit();
      await user.clear(await screen.findByRole("textbox", { name: "Objetivo" }));
      await user.clear(textbox("Link do material"));

      await user.click(button("Salvar alterações"));

      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
      expect(onUpdate.mock.calls[0]?.[0].body).toMatchObject({
        objective: null,
        materialUrl: null,
      });
    });

    it("sends the new order after moving a content", async () => {
      const onUpdate = vi.fn();
      server.use(getLessonPlanHandler(), updateLessonPlanHandler({ onCall: onUpdate }));
      const user = userEvent.setup();
      await renderEdit();
      await screen.findByRole("textbox", { name: "Conteúdo 1" });

      await user.click(button("Descer conteúdo 1"));
      await user.click(button("Salvar alterações"));

      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
      expect(onUpdate.mock.calls[0]?.[0].body.contents).toEqual([
        "Janelas do sistema",
        "Teclado e mouse",
      ]);
    });

    it("shows the success toast, calls onSaved and closes", async () => {
      const updated = buildLessonPlan({ title: "Título novo" });
      server.use(getLessonPlanHandler(), updateLessonPlanHandler({ response: updated }));
      const user = userEvent.setup();
      const { onClose, onSaved } = await renderEdit();
      await screen.findByRole("textbox", { name: "Título do plano" });

      await user.click(button("Salvar alterações"));

      expect(await screen.findByText("Plano de aula atualizado.")).toBeInTheDocument();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onSaved).toHaveBeenCalledWith(updated);
    });

    it("fetches the plan again after saving, so every screen shows the saved data", async () => {
      const onGet = vi.fn();
      server.use(getLessonPlanHandler({ onCall: onGet }), updateLessonPlanHandler());
      const user = userEvent.setup();
      await renderEdit();
      await screen.findByRole("textbox", { name: "Título do plano" });
      expect(onGet).toHaveBeenCalledTimes(1);

      await user.click(button("Salvar alterações"));

      await screen.findByText("Plano de aula atualizado.");
      await waitFor(() => expect(onGet).toHaveBeenCalledTimes(2));
    });

    it("validates before sending, with the field error and the focus", async () => {
      const onUpdate = vi.fn();
      server.use(getLessonPlanHandler(), updateLessonPlanHandler({ onCall: onUpdate }));
      const user = userEvent.setup();
      await renderEdit();
      await user.clear(await screen.findByRole("textbox", { name: "Título do plano" }));

      await user.click(button("Salvar alterações"));

      expect(await screen.findByText("Informe o título do plano.")).toBeInTheDocument();
      await waitFor(() => expect(textbox("Título do plano")).toHaveFocus());
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("explains that the plan was archived in the meantime", async () => {
      server.use(getLessonPlanHandler(), updateLessonPlanHandler({ error: ARCHIVED_ERROR }));
      const user = userEvent.setup();
      const { onClose } = await renderEdit();
      await screen.findByRole("textbox", { name: "Título do plano" });

      await user.click(button("Salvar alterações"));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Este plano de aula está arquivado e não pode ser editado. Reative o plano para editar.",
      );
      expect(onClose).not.toHaveBeenCalled();
    });

    it("maps the server validation errors to the fields", async () => {
      server.use(
        getLessonPlanHandler(),
        updateLessonPlanHandler({
          error: VALIDATION_ERROR([{ field: "materialUrl", message: "materialUrl must be a URL" }]),
        }),
      );
      const user = userEvent.setup();
      await renderEdit();
      await screen.findByRole("textbox", { name: "Título do plano" });

      await user.click(button("Salvar alterações"));

      expect(
        await screen.findByText("Informe um link válido, começando com http:// ou https://."),
      ).toBeInTheDocument();
      await waitFor(() => expect(textbox("Link do material")).toHaveFocus());
    });
  });
});
