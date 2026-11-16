import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Role } from "@shared/lib/role";

import { GenerateLessonsButton } from "../components/GenerateLessonsButton";
import {
  buildMeUser,
  buildOutsidePreview,
  CLASS_ID,
  CLASS_START_DATE,
  COURSE_NAME,
  generateClassLessonsHandler,
  previewClassLessonsHandler,
  type ClassBodyCall,
} from "./handlers";
import { renderWithProviders, server, setupLessonsTestServer } from "./test-utils";

setupLessonsTestServer();

const trigger = () => screen.getByRole("button", { name: "Gerar aulas" });
const dialog = () => screen.getByRole("dialog", { name: "Gerar aulas da turma" });

interface Options {
  role?: Role;
  isClassArchived?: boolean;
  onEditClass?: () => void;
}

async function renderButton({
  role = Role.coordinator,
  isClassArchived = false,
  onEditClass,
}: Options = {}) {
  return renderWithProviders(
    <GenerateLessonsButton
      classId={CLASS_ID}
      courseName={COURSE_NAME}
      classStartDate={CLASS_START_DATE}
      isClassArchived={isClassArchived}
      onEditClass={onEditClass}
    />,
    { user: buildMeUser(role) },
  );
}

describe("GenerateLessonsButton", () => {
  it.each([
    ["coordinator", Role.coordinator],
    ["director", Role.director],
    ["superadmin", Role.superadmin],
  ])("shows Gerar aulas to the %s", async (_label, role) => {
    await renderButton({ role });

    expect(trigger()).toBeVisible();
  });

  it("hides it from a member, who has no lessons.manage", async () => {
    await renderButton({ role: Role.member });

    expect(screen.queryByRole("button", { name: "Gerar aulas" })).not.toBeInTheDocument();
  });

  it("hides it for an archived class, which is read-only, even for the coordinator", async () => {
    await renderButton({ role: Role.coordinator, isClassArchived: true });

    expect(screen.queryByRole("button", { name: "Gerar aulas" })).not.toBeInTheDocument();
  });

  it("is the tertiary button of the header, with the 44px target", async () => {
    await renderButton();

    expect(trigger()).toHaveClass("button--tertiary", "min-h-11", "text-base");
  });

  it("draws only the button until it is pressed: the dialog is not mounted", async () => {
    await renderButton();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the dialog of the class, with its first day in the first date and its course in the summary", async () => {
    const user = userEvent.setup();
    await renderButton();

    await user.click(trigger());

    expect(await screen.findByRole("dialog", { name: "Gerar aulas da turma" })).toBeVisible();
    expect(screen.getByLabelText("Data da primeira aula")).toHaveValue(CLASS_START_DATE);
    expect(
      screen.getByText(/Uma por plano de aula do curso Informática Básica,/),
    ).toBeInTheDocument();
  });

  it("asks the preview for the class it belongs to", async () => {
    const onCall = vi.fn<(call: ClassBodyCall) => void>();
    server.use(previewClassLessonsHandler({ onCall }), generateClassLessonsHandler());
    const user = userEvent.setup();
    await renderButton();
    await user.click(trigger());
    await screen.findByRole("dialog", { name: "Gerar aulas da turma" });

    await user.click(screen.getByRole("button", { name: /Dia da semana/ }));
    await user.click(await screen.findByRole("option", { name: "Terça-feira" }));
    await user.type(screen.getByLabelText("Hora de início"), "09:00");
    await user.type(screen.getByLabelText("Hora de término"), "11:00");

    await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
    expect(onCall.mock.calls[0][0].id).toBe(CLASS_ID);
  });

  it("opens the dialog and returns the focus to Gerar aulas on Voltar", async () => {
    const user = userEvent.setup();
    await renderButton();
    const opener = trigger();

    await user.click(opener);
    await screen.findByRole("dialog", { name: "Gerar aulas da turma" });
    await user.click(within(dialog()).getByRole("button", { name: "Voltar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("returns the focus to Gerar aulas on Escape too", async () => {
    const user = userEvent.setup();
    await renderButton();
    const opener = trigger();

    await user.click(opener);
    await screen.findByRole("dialog", { name: "Gerar aulas da turma" });
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("opens a clean dialog each time: nothing of the last time is left", async () => {
    const user = userEvent.setup();
    await renderButton();

    await user.click(trigger());
    await screen.findByRole("dialog", { name: "Gerar aulas da turma" });
    await user.click(screen.getByRole("button", { name: /Dia da semana/ }));
    await user.click(await screen.findByRole("option", { name: "Sexta-feira" }));
    await user.type(screen.getByRole("textbox", { name: "Local padrão" }), "Sala 9");
    await user.click(within(dialog()).getByRole("button", { name: "Voltar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(trigger());

    await screen.findByRole("dialog", { name: "Gerar aulas da turma" });
    expect(screen.getByRole("button", { name: /Dia da semana/ })).toHaveTextContent(
      "Escolha o dia",
    );
    expect(screen.getByRole("textbox", { name: "Local padrão" })).toHaveValue("");
    expect(screen.getByLabelText("Data da primeira aula")).toHaveValue(CLASS_START_DATE);
  });

  it("gives the shortcut to Editar turma to the dialog: it closes the dialog and goes there", async () => {
    server.use(
      previewClassLessonsHandler({ response: buildOutsidePreview() }),
      generateClassLessonsHandler(),
    );
    const onEditClass = vi.fn();
    const user = userEvent.setup();
    await renderButton({ onEditClass });
    await user.click(trigger());
    await screen.findByRole("dialog", { name: "Gerar aulas da turma" });
    await user.click(screen.getByRole("button", { name: /Dia da semana/ }));
    await user.click(await screen.findByRole("option", { name: "Terça-feira" }));
    await user.type(screen.getByLabelText("Hora de início"), "09:00");
    await user.type(screen.getByLabelText("Hora de término"), "11:00");

    await user.click(await screen.findByRole("button", { name: "Editar turma" }));

    expect(onEditClass).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
