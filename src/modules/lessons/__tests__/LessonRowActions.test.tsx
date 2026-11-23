import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { LessonStatus } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { LessonRowActions } from "../components/LessonRowActions";
import { buildMeUser, getLessonHandler, LESSON_ID } from "./handlers";
import { renderWithProviders, server, setupLessonsTestServer } from "./test-utils";

setupLessonsTestServer();

const LESSON = { id: LESSON_ID, title: "Teclado, mouse e janelas", status: LessonStatus.planned };

const pencil = () => screen.getByRole("button", { name: "Editar a aula Teclado, mouse e janelas" });
const trash = () =>
  screen.getByRole("button", { name: "Cancelar a aula Teclado, mouse e janelas" });

describe("LessonRowActions", () => {
  it("member sees no icon", async () => {
    await renderWithProviders(<LessonRowActions lesson={LESSON} />, {
      user: buildMeUser(Role.member),
    });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each([
    ["director", Role.director],
    ["coordinator", Role.coordinator],
  ])("the %s sees the pencil and the trash, each named after its lesson", async (_label, role) => {
    await renderWithProviders(<LessonRowActions lesson={LESSON} />, { user: buildMeUser(role) });

    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(pencil()).toBeInTheDocument();
    expect(trash()).toBeInTheDocument();
    // The icons are decoration: the name of the button is what is read.
    for (const icon of [pencil(), trash()]) {
      expect(icon.querySelector("img")).toHaveAttribute("aria-hidden", "true");
      expect(icon.querySelector("img")).toHaveAttribute("alt", "");
    }
  });

  it("names the buttons of two rows apart", async () => {
    await renderWithProviders(
      <>
        <LessonRowActions lesson={LESSON} />
        <LessonRowActions lesson={{ ...LESSON, id: "other", title: "Senhas e privacidade" }} />
      </>,
    );

    expect(
      screen.getByRole("button", { name: "Editar a aula Senhas e privacidade" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancelar a aula Senhas e privacidade" }),
    ).toBeInTheDocument();
    expect(pencil()).toBeInTheDocument();
  });

  it("a cancelled lesson shows both icons disabled", async () => {
    await renderWithProviders(
      <LessonRowActions lesson={{ ...LESSON, status: LessonStatus.cancelled }} />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(pencil()).toBeDisabled();
    expect(trash()).toBeDisabled();
  });

  it("a member does not see the disabled icons of a cancelled lesson either", async () => {
    await renderWithProviders(
      <LessonRowActions lesson={{ ...LESSON, status: LessonStatus.cancelled }} />,
      { user: buildMeUser(Role.member) },
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("the icons of a lesson that is not cancelled are enabled, 16px wide, 12px apart", async () => {
    await renderWithProviders(<LessonRowActions lesson={LESSON} />);

    expect(pencil()).toBeEnabled();
    expect(trash()).toBeEnabled();
    expect(pencil().querySelector("img")).toHaveAttribute("width", "16");
    expect(pencil().querySelector("img")).toHaveAttribute("height", "16");
    expect(pencil().parentElement).toHaveClass("gap-3");
  });

  it.each([LessonStatus.confirmed, LessonStatus.done])(
    "a %s lesson keeps the icons",
    async (status) => {
      await renderWithProviders(<LessonRowActions lesson={{ ...LESSON, status }} />);

      expect(screen.getAllByRole("button")).toHaveLength(2);
    },
  );

  it("the pencil opens the edit dialog", async () => {
    server.use(getLessonHandler());
    const user = userEvent.setup();
    await renderWithProviders(<LessonRowActions lesson={LESSON} />);

    await user.click(pencil());

    const dialog = await screen.findByRole("dialog", { name: "Editar aula" });
    expect(await within(dialog).findByRole("textbox", { name: "Título da aula" })).toHaveValue(
      "Teclado, mouse e janelas",
    );
  });

  it("the trash opens the cancel dialog", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<LessonRowActions lesson={LESSON} />);

    await user.click(trash());

    const dialog = await screen.findByRole("dialog", { name: "Cancelar aula" });
    expect(
      within(dialog).getByRole("textbox", { name: "Motivo do cancelamento" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["pencil", pencil, "Editar aula"],
    ["trash", trash, "Cancelar aula"],
  ])("gives the focus back to the %s when the dialog closes", async (_label, icon, title) => {
    server.use(getLessonHandler());
    const user = userEvent.setup();
    await renderWithProviders(<LessonRowActions lesson={LESSON} />);
    await user.click(icon());
    await screen.findByRole("dialog", { name: title });

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(icon()).toHaveFocus());
  });
});
