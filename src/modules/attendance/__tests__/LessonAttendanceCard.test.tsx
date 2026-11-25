import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getGetMemberHoursQueryKey } from "@api/generated/hours/hours";
import { LessonStatus, type LessonResponseDto, type MeResponseDto } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { LessonAttendanceCard } from "../components/LessonAttendanceCard";
import {
  attendanceApi,
  buildLesson,
  buildMembers,
  buildMeUser,
  buildSigned,
  buildStudents,
  LESSON_ID,
  MONITOR_ID,
  STUDENT_NAMES,
  TEACHER_ID,
} from "./handlers";
import { renderWithProviders, server, setupAttendanceTestServer } from "./test-utils";

setupAttendanceTestServer();
afterEach(() => vi.restoreAllMocks());

const user = userEvent.setup();

async function renderCard({
  me = buildMeUser(),
  lesson = buildLesson(),
  api = attendanceApi(),
}: {
  me?: MeResponseDto;
  lesson?: LessonResponseDto;
  api?: ReturnType<typeof attendanceApi>;
} = {}) {
  server.use(...api.handlers);
  const view = await renderWithProviders(<LessonAttendanceCard lesson={lesson} />, { user: me });
  await screen.findByRole("tab", { name: /^Alunos \(7\)$/ });
  await screen.findByText("Maria");
  return { ...view, api };
}

function signedAbsence() {
  const students = buildStudents();
  students[0].attendance = buildSigned();
  return attendanceApi({ students });
}

function mockMobile() {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        matches: query.includes("max-width"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

async function openMembers() {
  await user.click(screen.getByRole("tab", { name: /(Monitores e professores|Membros) \(2\)/ }));
  await screen.findByText("Diego Almeida");
}

describe("student roll call", () => {
  it("signs six selected students and shows who signed", async () => {
    const { api } = await renderCard();
    expect(screen.getByRole("button", { name: "Assinar presença" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Marcar ausência" })).toBeDisabled();

    for (const name of STUDENT_NAMES.slice(0, 6)) {
      await user.click(screen.getByRole("checkbox", { name: `Selecionar ${name}` }));
    }
    expect(screen.getByText("7 alunos na chamada · 6 selecionados")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Assinar presença (6)" }));

    expect(await screen.findByText("Presença assinada para 6 alunos")).toBeInTheDocument();
    expect(api.calls).toEqual([
      {
        method: "PUT",
        path: expect.stringContaining(`/lessons/${LESSON_ID}/attendance/students`),
        body: {
          entries: STUDENT_NAMES.slice(0, 6).map((_, index) => ({
            enrollmentId: `enrollment-${index}`,
            status: "present",
          })),
        },
      },
    ]);
    expect(screen.getAllByText("Beatriz Nunes · 11:05")).toHaveLength(6);
  });

  it("marks the selected students absent before signing", async () => {
    const { api } = await renderCard();
    await user.click(screen.getByRole("checkbox", { name: "Selecionar todos" }));
    await user.click(screen.getByRole("button", { name: "Marcar ausência" }));
    expect(api.calls).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Assinar presença (7)" }));
    await screen.findByText("Presença assinada para 7 alunos");
    const { entries } = api.calls[0].body as { entries: { status: string }[] };
    expect(entries.every((entry) => entry.status === "absent")).toBe(true);
  });

  it("goes back to pending when the active status is pressed again", async () => {
    await renderCard();
    const toggle = within(screen.getByRole("group", { name: "Presença de Maria" }));
    const absent = toggle.getByRole("button", { name: "Ausente" });
    await user.click(absent);
    expect(absent).toHaveAttribute("aria-pressed", "true");
    await user.click(absent);
    expect(absent).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Assinar presença" })).toBeDisabled();
  });

  it("requires a reason to justify and sends it as the note", async () => {
    const { api } = await renderCard({ api: signedAbsence() });
    await user.click(screen.getByRole("button", { name: "Justificar a falta de Maria" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Justificar falta" }));
    await user.click(dialog.getByRole("button", { name: "Salvar justificativa" }));
    expect(await dialog.findByText("Informe o motivo da falta.")).toBeInTheDocument();
    expect(api.calls).toEqual([]);
    await user.type(dialog.getByRole("textbox", { name: /Motivo/ }), "Consulta médica");
    await user.click(dialog.getByRole("button", { name: "Salvar justificativa" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.calls[0].body).toEqual({ reason: "other", note: "Consulta médica" });
  });

  it("requires a reason to correct and only offers the other status", async () => {
    const { api } = await renderCard({ api: signedAbsence() });
    await user.click(screen.getByRole("button", { name: "Corrigir a presença de Maria" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Corrigir presença" }));
    expect(dialog.getByRole("radio", { name: "Presente" })).toBeChecked();
    expect(dialog.getByRole("radio", { name: "Ausente" })).toBeDisabled();
    await user.click(dialog.getByRole("button", { name: "Salvar correção" }));
    expect(await dialog.findByText("Informe o motivo da correção.")).toBeInTheDocument();
    await user.type(dialog.getByRole("textbox", { name: /Motivo da correção/ }), "Engano");
    await user.click(dialog.getByRole("button", { name: "Salvar correção" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.calls[0].body).toEqual({ status: "present", reason: "Engano" });
  });

  it("shows the refusal of the API and keeps the draft", async () => {
    await renderCard();
    server.use(
      http.put("*/lessons/:id/attendance/students", () =>
        HttpResponse.json(
          { statusCode: 409, error: "STUDENT_ATTENDANCE_ALREADY_SIGNED", message: "x" },
          { status: 409 },
        ),
      ),
    );
    await user.click(screen.getByRole("checkbox", { name: "Selecionar Maria" }));
    await user.click(screen.getByRole("button", { name: "Assinar presença (1)" }));
    expect(await screen.findByText(/já foram assinados com outra situação/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Selecionar Maria" })).toBeChecked();
  });

  it.each([
    ["a member outside the lesson", buildMeUser(Role.member), buildLesson()],
    ["a cancelled lesson", buildMeUser(), buildLesson({ status: LessonStatus.cancelled })],
    ["a future lesson", buildMeUser(), buildLesson({ date: "2999-01-01" })],
    [
      "an archived class",
      buildMeUser(),
      buildLesson({
        class: { ...buildLesson().class, archivedAt: "2026-03-01T00:00:00.000Z" },
      }),
    ],
  ])("is read-only for %s", async (_label, me, lesson) => {
    await renderCard({ me, lesson, api: signedAbsence() });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("lets a confirmed monitor take the roll call, without correcting", async () => {
    await renderCard({ me: buildMeUser(Role.member, MONITOR_ID), api: signedAbsence() });
    expect(screen.getByRole("checkbox", { name: "Selecionar João" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Justificar a falta de Maria" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Corrigir/ })).not.toBeInTheDocument();
  });

  it("saves only the marked students on a phone", async () => {
    mockMobile();
    const { api } = await renderCard();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar chamada (0)" })).toBeDisabled();
    const toggle = within(screen.getByRole("group", { name: "Presença de João" }));
    await user.click(toggle.getByRole("button", { name: "Ausente" }));
    await user.click(screen.getByRole("button", { name: "Salvar chamada (1)" }));
    await screen.findByText("Presença assinada para 1 aluno");
    expect(api.calls[0].body).toEqual({
      entries: [{ enrollmentId: "enrollment-1", status: "absent" }],
    });
  });

  it("keeps the marks of the rows that were not signed", async () => {
    await renderCard();
    const toggle = within(screen.getByRole("group", { name: "Presença de Maria" }));
    await user.click(toggle.getByRole("button", { name: "Ausente" }));
    await user.click(screen.getByRole("checkbox", { name: "Selecionar Maria" }));
    await user.click(screen.getByRole("checkbox", { name: "Selecionar João" }));
    await user.click(screen.getByRole("button", { name: "Assinar presença (1)" }));
    await screen.findByText("Presença assinada para 1 aluno");

    expect(
      within(screen.getByRole("group", { name: "Presença de Maria" })).getByRole("button", {
        name: "Ausente",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("checkbox", { name: "Selecionar Maria" })).not.toBeChecked();
    expect(screen.queryByRole("group", { name: "Presença de João" })).not.toBeInTheDocument();
  });

  it("keeps the draft when the tab changes", async () => {
    await renderCard();
    await user.click(screen.getByRole("checkbox", { name: "Selecionar Maria" }));
    await openMembers();
    await user.click(screen.getByRole("tab", { name: "Alunos (7)" }));
    expect(screen.getByRole("checkbox", { name: "Selecionar Maria" })).toBeChecked();
  });
});

describe("member attendance", () => {
  it("confirms a monitor, shows the tag and refreshes the hours of the member", async () => {
    const { api, queryClient } = await renderCard();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    await openMembers();
    await user.click(screen.getByRole("checkbox", { name: "Selecionar Diego Almeida" }));
    await user.click(screen.getByRole("button", { name: "Assinar presença (1)" }));
    expect(await screen.findByText("Presença assinada para 1 membro")).toBeInTheDocument();
    expect(api.calls[0].body).toEqual({
      entries: [{ assignmentId: "assignment-1", status: "present" }],
    });
    expect(screen.getByText("Ana Coordenadora · 11:20")).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: getGetMemberHoursQueryKey(MONITOR_ID) });
  });

  it.each([Role.coordinator, Role.member])(
    "never lets %s sign the own row, even with select all",
    async (role) => {
      const { api } = await renderCard({ me: buildMeUser(role, TEACHER_ID) });
      await openMembers();
      expect(screen.getByRole("checkbox", { name: "Selecionar Beatriz Nunes" })).toBeDisabled();
      const own = within(screen.getByRole("group", { name: "Presença de Beatriz Nunes" }));
      for (const button of own.getAllByRole("button")) expect(button).toBeDisabled();
      expect(screen.getByText("Você não pode confirmar a própria presença")).toBeInTheDocument();
      await user.click(screen.getByRole("checkbox", { name: "Selecionar todos" }));
      await user.click(screen.getByRole("button", { name: "Assinar presença (1)" }));
      await screen.findByText("Presença assinada para 1 membro");
      expect(api.calls[0].body).toEqual({
        entries: [{ assignmentId: "assignment-1", status: "present" }],
      });
    },
  );

  it("does not let a monitor sign anybody", async () => {
    await renderCard({ me: buildMeUser(Role.member, MONITOR_ID) });
    await openMembers();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("does not let a teacher member mark another teacher", async () => {
    const members = buildMembers();
    members.push({
      ...members[0],
      assignmentId: "assignment-2",
      person: { id: "other", name: "Carla Dias" },
    });
    const api = attendanceApi({ members });
    server.use(...api.handlers);
    await renderWithProviders(<LessonAttendanceCard lesson={buildLesson()} />, {
      user: buildMeUser(Role.member, TEACHER_ID),
    });
    await user.click(await screen.findByRole("tab", { name: "Monitores e professores (3)" }));
    expect(await screen.findByText("Carla Dias")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Carla/ })).not.toBeInTheDocument();
  });

  it("corrects a member without asking for a reason", async () => {
    const members = buildMembers();
    members[1] = {
      ...members[1],
      status: "present",
      confirmedBy: { id: TEACHER_ID, name: "Beatriz Nunes" },
      confirmedAt: "2026-03-10T14:05:00.000Z",
    };
    const { api } = await renderCard({ api: attendanceApi({ members }) });
    await openMembers();
    await user.click(screen.getByRole("button", { name: "Corrigir a presença de Diego Almeida" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Corrigir presença" }));
    expect(dialog.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Salvar correção" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.calls[0].body).toEqual({
      entries: [{ assignmentId: "assignment-1", status: "absent" }],
    });
  });
});
