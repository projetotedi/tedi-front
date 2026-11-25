import { useState, type ReactElement } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NewLessonFlow, type NewLessonFlowProps } from "../components/NewLessonFlow";
import type { LessonClassContext } from "../components/LessonFormDialog";
import {
  CLASS_ID,
  CLASS_NAME,
  CLASS_PERIOD,
  COURSE_ID,
  listClassesHandler,
  listCourseLessonPlansHandler,
  OTHER_CLASS_ID,
  OTHER_CLASS_NAME,
} from "./handlers";
import { renderWithProviders, server, setupLessonsTestServer } from "./test-utils";

setupLessonsTestServer();

const LESSON_CLASS: LessonClassContext = {
  id: CLASS_ID,
  label: CLASS_NAME,
  courseId: COURSE_ID,
  ...CLASS_PERIOD,
};

/** What a screen does: a button that opens the flow and closes it when it asks. */
function Host(props: Omit<NewLessonFlowProps, "onClose">): ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Abrir fluxo
      </button>
      {isOpen ? <NewLessonFlow {...props} onClose={() => setIsOpen(false)} /> : null}
    </>
  );
}

const opener = () => screen.getByRole("button", { name: "Abrir fluxo" });
const classTrigger = () => screen.getByRole("button", { name: /Turma/ });

async function openFlow(props: Omit<NewLessonFlowProps, "onClose"> = {}) {
  const user = userEvent.setup();
  const view = await renderWithProviders(<Host {...props} />);
  await user.click(opener());
  return { user, ...view };
}

describe("NewLessonFlow", () => {
  it("without a class asks for the class, then opens Nova aula with it", async () => {
    const onPlans = vi.fn();
    server.use(listClassesHandler(), listCourseLessonPlansHandler({ onCall: onPlans }));
    const { user } = await openFlow();

    const chooser = await screen.findByRole("dialog", { name: "Escolha a turma da aula" });
    await user.click(await within(chooser).findByRole("button", { name: /Turma/ }));
    await user.click(await screen.findByRole("option", { name: OTHER_CLASS_NAME }));
    await user.click(within(chooser).getByRole("button", { name: "Continuar" }));

    const form = await screen.findByRole("dialog", { name: "Nova aula" });
    expect(
      screen.queryByRole("dialog", { name: "Escolha a turma da aula" }),
    ).not.toBeInTheDocument();
    expect(within(form).getByLabelText(/^Turma/)).toHaveValue(OTHER_CLASS_NAME);
    expect(within(form).getByLabelText(/^Turma/)).toHaveAttribute("readonly");
    await waitFor(() => expect(onPlans).toHaveBeenCalledExactlyOnceWith({ id: COURSE_ID }));
  });

  it("with initialClassId the class comes chosen", async () => {
    server.use(listClassesHandler(), listCourseLessonPlansHandler());
    const { user } = await openFlow({ initialClassId: OTHER_CLASS_ID });

    await screen.findByRole("dialog", { name: "Escolha a turma da aula" });
    await waitFor(() => expect(classTrigger()).toHaveTextContent(OTHER_CLASS_NAME));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    const form = await screen.findByRole("dialog", { name: "Nova aula" });
    expect(within(form).getByLabelText(/^Turma/)).toHaveValue(OTHER_CLASS_NAME);
  });

  it("Continuar without a class shows the error in the field", async () => {
    server.use(listClassesHandler());
    const { user } = await openFlow();
    await screen.findByRole("dialog", { name: "Escolha a turma da aula" });
    await waitFor(() => expect(classTrigger()).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Escolha a turma da aula.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Nova aula" })).not.toBeInTheDocument();
  });

  it("with the class of the screen opens Nova aula at once, and asks for no class", async () => {
    server.use(listCourseLessonPlansHandler());
    await openFlow({ lessonClass: LESSON_CLASS });

    const form = await screen.findByRole("dialog", { name: "Nova aula" });
    expect(within(form).getByLabelText(/^Turma/)).toHaveValue(CLASS_NAME);
    expect(
      screen.queryByRole("dialog", { name: "Escolha a turma da aula" }),
    ).not.toBeInTheDocument();
  });

  it("Cancelar in the first step ends the flow and gives the focus back to the opener", async () => {
    server.use(listClassesHandler());
    const { user } = await openFlow();
    await screen.findByRole("dialog", { name: "Escolha a turma da aula" });

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(opener()).toHaveFocus());
  });

  it("gives the focus back to the opener when the form that follows the choice closes", async () => {
    server.use(listClassesHandler(), listCourseLessonPlansHandler());
    const { user } = await openFlow({ initialClassId: CLASS_ID });
    await screen.findByRole("dialog", { name: "Escolha a turma da aula" });
    await waitFor(() => expect(classTrigger()).toHaveTextContent(CLASS_NAME));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByRole("dialog", { name: "Nova aula" });

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(opener()).toHaveFocus());
  });
});
