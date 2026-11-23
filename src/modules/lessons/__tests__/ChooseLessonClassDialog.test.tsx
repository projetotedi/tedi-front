import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChooseLessonClassDialog } from "../components/ChooseLessonClassDialog";
import {
  buildClassesPage,
  buildClassListItem,
  buildOtherClassListItem,
  CLASS_NAME,
  COURSE_ID,
  listClassesHandler,
  OTHER_CLASS_ID,
  OTHER_CLASS_NAME,
  type ListCall,
} from "./handlers";
import { createDeferred, renderWithProviders, server, setupLessonsTestServer } from "./test-utils";

setupLessonsTestServer();

const dialog = () => screen.getByRole("dialog", { name: "Escolha a turma da aula" });
const classTrigger = () => screen.getByRole("button", { name: /Turma/ });
const continueButton = () => screen.getByRole("button", { name: "Continuar" });

async function renderDialog(props: { initialClassId?: string } = {}) {
  const onContinue = vi.fn();
  const onClose = vi.fn();
  const view = await renderWithProviders(
    <ChooseLessonClassDialog {...props} onContinue={onContinue} onClose={onClose} />,
  );
  return { ...view, onContinue, onClose };
}

describe("ChooseLessonClassDialog", () => {
  it("offers the classes the API lists, each by its name, or by its code when it has none", async () => {
    server.use(
      listClassesHandler({
        response: buildClassesPage([
          buildClassListItem(),
          buildOtherClassListItem({ name: null, code: "INFO-B" }),
        ]),
      }),
    );
    const user = userEvent.setup();
    await renderDialog();

    await user.click(await waitFor(() => classTrigger()));

    expect(await screen.findByRole("option", { name: CLASS_NAME })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "INFO-B" })).toBeInTheDocument();
  });

  it("asks for the classes that are not archived, a page of 100, the last to start first", async () => {
    const onCall = vi.fn<(call: ListCall) => void>();
    server.use(listClassesHandler({ onCall }));
    await renderDialog();

    await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
    expect(onCall).toHaveBeenCalledWith({ limit: "100", sort: "startDate" });
  });

  it("says the classes are loading, and Continuar is off", async () => {
    const pending = createDeferred();
    server.use(listClassesHandler({ delay: pending.promise }));
    await renderDialog();

    expect(await screen.findByRole("status")).toHaveTextContent("Carregando as turmas…");
    expect(continueButton()).toBeDisabled();
    pending.resolve();
    await screen.findByRole("button", { name: /Turma/ });
  });

  it("shows the error with Tentar de novo, which asks again, and Continuar is off", async () => {
    server.use(listClassesHandler({ networkError: true }));
    const user = userEvent.setup();
    await renderDialog();

    const retry = await screen.findByRole("button", { name: "Tentar de novo" });
    expect(screen.getByText("Não foi possível carregar as turmas.")).toBeInTheDocument();
    expect(continueButton()).toBeDisabled();

    server.use(listClassesHandler());
    await user.click(retry);

    expect(await screen.findByRole("button", { name: /Turma/ })).toBeInTheDocument();
    expect(continueButton()).toBeEnabled();
  });

  it("says there is no active class, and Continuar is off", async () => {
    server.use(listClassesHandler({ response: buildClassesPage([]) }));
    await renderDialog();

    expect(
      await screen.findByText("Nenhuma turma ativa. Crie uma turma antes de criar uma aula."),
    ).toBeInTheDocument();
    expect(continueButton()).toBeDisabled();
  });

  it("Continuar gives the chosen class, with its course and its period", async () => {
    server.use(listClassesHandler());
    const user = userEvent.setup();
    const { onContinue } = await renderDialog();

    await user.click(await waitFor(() => classTrigger()));
    await user.click(await screen.findByRole("option", { name: OTHER_CLASS_NAME }));
    await user.click(continueButton());

    expect(onContinue).toHaveBeenCalledExactlyOnceWith({
      id: OTHER_CLASS_ID,
      label: OTHER_CLASS_NAME,
      courseId: COURSE_ID,
      startDate: "2026-04-06",
      endDate: "2026-07-31",
    });
  });

  it("comes with the class of initialClassId chosen", async () => {
    server.use(listClassesHandler());
    const user = userEvent.setup();
    const { onContinue } = await renderDialog({ initialClassId: OTHER_CLASS_ID });

    await waitFor(() => expect(classTrigger()).toHaveTextContent(OTHER_CLASS_NAME));
    await user.click(continueButton());

    expect(onContinue).toHaveBeenCalledWith(expect.objectContaining({ id: OTHER_CLASS_ID }));
  });

  it("comes with nothing chosen when initialClassId is not one of the classes", async () => {
    server.use(listClassesHandler());
    const user = userEvent.setup();
    const { onContinue } = await renderDialog({
      initialClassId: "01952ef7-0000-7000-8000-0000000000d9",
    });
    await waitFor(() => expect(classTrigger()).toBeInTheDocument());

    await user.click(continueButton());

    expect(onContinue).not.toHaveBeenCalled();
    expect(await screen.findByText("Escolha a turma da aula.")).toBeInTheDocument();
  });

  it("Continuar with no class shows the error in the field and takes the focus there", async () => {
    server.use(listClassesHandler());
    const user = userEvent.setup();
    const { onContinue } = await renderDialog();
    await waitFor(() => expect(classTrigger()).toBeInTheDocument());

    await user.click(continueButton());

    expect(onContinue).not.toHaveBeenCalled();
    expect(within(dialog()).getByText("Escolha a turma da aula.")).toBeInTheDocument();
    expect(classTrigger()).toHaveFocus();
  });

  it("choosing a class takes the error away", async () => {
    server.use(listClassesHandler());
    const user = userEvent.setup();
    await renderDialog();
    await waitFor(() => expect(classTrigger()).toBeInTheDocument());
    await user.click(continueButton());
    expect(await screen.findByText("Escolha a turma da aula.")).toBeInTheDocument();

    await user.click(classTrigger());
    await user.click(await screen.findByRole("option", { name: CLASS_NAME }));

    await waitFor(() =>
      expect(within(dialog()).queryByText("Escolha a turma da aula.")).not.toBeInTheDocument(),
    );
    expect(classTrigger()).toHaveTextContent(CLASS_NAME);
  });

  it("Cancelar and Esc close it", async () => {
    server.use(listClassesHandler());
    const user = userEvent.setup();
    const { onClose } = await renderDialog();
    await waitFor(() => expect(classTrigger()).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.keyboard("{Escape}");

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));
  });
});
