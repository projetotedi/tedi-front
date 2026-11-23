import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LessonStatus } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { LessonsTable } from "../components/LessonsTable";
import {
  buildLessonListItem,
  buildMeUser,
  CLASS_NAME,
  getLessonHandler,
  LESSON_ID,
  OTHER_LESSON_ID,
} from "./handlers";
import { renderWithProviders, server, setupLessonsTestServer } from "./test-utils";

setupLessonsTestServer();

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="current-location">{`${location.pathname}${location.search}`}</output>;
}

const location = () => screen.getByTestId("current-location").textContent;

const PLANNED = buildLessonListItem({ teacher: { id: "teacher-1", name: "Marina Souza" } });
const CANCELLED = buildLessonListItem({
  id: OTHER_LESSON_ID,
  title: "Senhas e privacidade",
  date: "2026-03-17",
  startTime: "14:00",
  endTime: "15:30",
  status: LessonStatus.cancelled,
});

async function renderTable(role: Role = Role.coordinator) {
  return renderWithProviders(
    <>
      <LessonsTable lessons={[PLANNED, CANCELLED]} caption="Aulas (2)" />
      <LocationProbe />
    </>,
    { route: "/lessons", user: buildMeUser(role) },
  );
}

const rowOf = (title: string) => screen.getByRole("row", { name: new RegExp(title) });

describe("LessonsTable", () => {
  it("shows the columns of the Figma, named by the caption", async () => {
    await renderTable();

    expect(screen.getByRole("table")).toHaveAccessibleName("Aulas (2)");
    for (const name of ["Turma", "Data", "Horário", "Conteúdo", "Responsável", "Status", "Ações"]) {
      expect(screen.getByRole("columnheader", { name })).toHaveClass("uppercase");
    }
  });

  it("writes each lesson on its row: class, day, time, content, teacher and status", async () => {
    await renderTable();

    const row = within(rowOf("Teclado, mouse e janelas"));
    expect(row.getByRole("cell", { name: CLASS_NAME })).toBeInTheDocument();
    expect(row.getByRole("cell", { name: "10/03/2026" })).toBeInTheDocument();
    expect(row.getByRole("cell", { name: "09:00–11:00" })).toBeInTheDocument();
    expect(row.getByRole("cell", { name: "Marina Souza" })).toBeInTheDocument();
    expect(row.getByText("Planejada")).toBeInTheDocument();
    expect(row.getByRole("link", { name: "Teclado, mouse e janelas" })).toHaveAttribute(
      "href",
      `/lessons/${LESSON_ID}`,
    );
  });

  it("shows a dash that is read as Não informado when the lesson has no teacher", async () => {
    await renderTable();

    const cell = within(rowOf("Senhas e privacidade")).getByRole("cell", {
      name: "Não informado",
    });
    expect(cell).toHaveTextContent("—");
    expect(within(cell).getByText("—")).toHaveAttribute("aria-hidden", "true");
    expect(within(cell).getByText("Não informado")).toHaveClass("sr-only");
  });

  it("tags the status of each lesson in the tone of the status", async () => {
    await renderTable();

    expect(within(rowOf("Senhas e privacidade")).getByText("Cancelada")).toHaveClass(
      "bg-danger-soft",
    );
    expect(within(rowOf("Teclado, mouse e janelas")).getByText("Planejada")).toHaveClass(
      "bg-tedi-neutral",
    );
  });

  it("puts the bar of the row on the first cell, 3px, in the color of the action", async () => {
    await renderTable();

    const cell = within(rowOf("Teclado, mouse e janelas")).getByRole("cell", { name: CLASS_NAME });

    expect(cell).toHaveClass("relative", "before:w-[3px]", "before:bg-accent");
    expect(rowOf("Teclado, mouse e janelas")).toHaveClass(
      "cursor-pointer",
      "hover:bg-tedi-info-subtle",
    );
  });

  it("a click on a cell opens the lesson", async () => {
    const user = userEvent.setup();
    await renderTable();

    await user.click(
      within(rowOf("Teclado, mouse e janelas")).getByRole("cell", { name: "10/03/2026" }),
    );

    expect(location()).toBe(`/lessons/${LESSON_ID}`);
  });

  it("a click on the link of the content opens the lesson once", async () => {
    const user = userEvent.setup();
    await renderTable();

    await user.click(
      within(rowOf("Senhas e privacidade")).getByRole("link", { name: "Senhas e privacidade" }),
    );

    expect(location()).toBe(`/lessons/${OTHER_LESSON_ID}`);
  });

  it("the coordination sees the pencil and the trash of a lesson, disabled on a cancelled one", async () => {
    await renderTable();

    expect(
      within(rowOf("Teclado, mouse e janelas")).getByRole("button", {
        name: "Editar a aula Teclado, mouse e janelas",
      }),
    ).toBeEnabled();
    expect(
      within(rowOf("Senhas e privacidade")).getByRole("button", {
        name: "Editar a aula Senhas e privacidade",
      }),
    ).toBeDisabled();
    expect(
      within(rowOf("Senhas e privacidade")).getByRole("button", {
        name: "Cancelar a aula Senhas e privacidade",
      }),
    ).toBeDisabled();
  });

  it("the member sees no column Ações and no icon, not even disabled", async () => {
    await renderTable(Role.member);

    expect(screen.queryByRole("columnheader", { name: "Ações" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(6);
  });

  it("the pencil opens Editar aula without leaving the list, and a click inside it stays too", async () => {
    server.use(getLessonHandler());
    const user = userEvent.setup();
    await renderTable();

    await user.click(
      within(rowOf("Teclado, mouse e janelas")).getByRole("button", {
        name: "Editar a aula Teclado, mouse e janelas",
      }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Editar aula" });
    await user.click(await within(dialog).findByRole("textbox", { name: "Título da aula" }));
    await user.click(within(dialog).getByText("Turma"));

    expect(location()).toBe("/lessons");
    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: "Editar aula" })).toBeInTheDocument(),
    );
  });
});
