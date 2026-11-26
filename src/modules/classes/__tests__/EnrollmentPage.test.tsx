import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import {
  ClassStatus,
  EnrollmentSkipReason,
  EnrollmentStatus,
  EnrollmentWarningCode,
  type AvailableStudentItemResponseDto,
  type ClassDetailDto,
  type ClassEnrollmentItemResponseDto,
  type EnrollStudentsResponseDto,
} from "@api/generated/model";
import { Role } from "@shared/lib/role";

import {
  buildClassDetail,
  buildClassSummary,
  buildMeUser,
  buildClassesPage,
  CLASS_ID,
  getClassHandler,
  listClassesHandler,
} from "./handlers";
import { classesRoutes, renderRoutes, server, setupClassesTestServer } from "./test-utils";

setupClassesTestServer();

const ROUTE = `/classes/${CLASS_ID}/enrollments`;

const HELENA = "01999a3e-7c1b-7000-8000-000000000301";
const JOSE = "01999a3e-7c1b-7000-8000-000000000302";
const CECILIA = "01999a3e-7c1b-7000-8000-000000000303";

const AVAILABLE: AvailableStudentItemResponseDto[] = [
  { id: HELENA, name: "Helena Martins Duarte", age: 62, currentClasses: [] },
  { id: JOSE, name: "José Almeida Ribeiro", age: 70, currentClasses: [] },
  {
    id: CECILIA,
    name: "Cecília Barbosa Nogueira",
    age: 66,
    currentClasses: [
      {
        id: "01999a3e-7c1b-7000-8000-0000000003f1",
        code: "INFO-B",
        name: null,
        edition: { id: "e", name: "2026.1" },
      },
    ],
  },
];

const ENROLLED: ClassEnrollmentItemResponseDto[] = [
  {
    id: "01999a3e-7c1b-7000-8000-000000000401",
    student: {
      id: "01999a3e-7c1b-7000-8000-000000000501",
      name: "Maria da Silva Santos",
      age: 67,
      phone: null,
      accessibilityNeed: null,
    },
    status: EnrollmentStatus.active,
    enrolledAt: "2026-03-03T12:00:00.000Z",
    statusChangedAt: "2026-03-03T12:00:00.000Z",
    attendanceRate: null,
  },
];

function page<T>(data: T[]) {
  return { data, total: data.length, page: 1, limit: 20 };
}

interface Calls {
  enrollBodies: unknown[];
  removed: string[];
}

function useEnrollmentHandlers({
  detail = buildClassDetail(),
  enroll,
  remove,
}: {
  detail?: ClassDetailDto;
  enroll?: () => Response;
  remove?: () => Response;
} = {}): Calls {
  const calls: Calls = { enrollBodies: [], removed: [] };
  server.use(
    getClassHandler({ response: detail }),
    listClassesHandler({ response: buildClassesPage() }),
    http.get("*/classes/:id/available-students", () => HttpResponse.json(page(AVAILABLE))),
    http.get("*/classes/:id/enrollments", () => HttpResponse.json(page(ENROLLED))),
    http.post("*/classes/:id/enrollments", async ({ request }) => {
      calls.enrollBodies.push(await request.json());
      if (enroll) return enroll();
      const result: EnrollStudentsResponseDto = { enrolled: [], skipped: [], warnings: [] };
      return HttpResponse.json(result, { status: 201 });
    }),
    http.delete("*/enrollments/:id", ({ params }) => {
      calls.removed.push(String(params.id));
      return remove ? remove() : new HttpResponse(null, { status: 204 });
    }),
  );
  return calls;
}

function availableCard(): HTMLElement {
  return screen.getByRole("list", { name: "Alunos disponíveis" });
}

describe("EnrollmentPage", () => {
  it("shows the seats taken, the available students with age and situation, and the enrolled ones", async () => {
    useEnrollmentHandlers();
    await renderRoutes(classesRoutes, { route: ROUTE });

    expect(await screen.findByText("Helena Martins Duarte")).toBeInTheDocument();
    expect(screen.getByText("12 de 15 vagas ocupadas")).toBeInTheDocument();
    expect(screen.getByText("62 anos • sem turma atual")).toBeInTheDocument();
    expect(screen.getByText("66 anos • turma atual: INFO-B")).toBeInTheDocument();
    expect(await screen.findByText("Maria da Silva Santos")).toBeInTheDocument();
    expect(screen.getByText("Matriculado(a) em 03/03/2026")).toBeInTheDocument();
    expect(screen.getByText("Nenhum aluno selecionado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Matricular selecionados" })).toBeDisabled();
  });

  it("enrolls the selected students and says who was skipped and who lacks a prerequisite", async () => {
    const user = userEvent.setup();
    const calls = useEnrollmentHandlers({
      enroll: () =>
        HttpResponse.json(
          {
            enrolled: [
              {
                id: "01999a3e-7c1b-7000-8000-000000000601",
                classId: CLASS_ID,
                student: { id: HELENA, name: "Helena Martins Duarte" },
                status: EnrollmentStatus.active,
                enrolledAt: "2026-03-10T12:00:00.000Z",
                statusChangedAt: "2026-03-10T12:00:00.000Z",
                statusReason: null,
              },
            ],
            skipped: [
              {
                studentId: JOSE,
                reason: EnrollmentSkipReason.ALREADY_ENROLLED,
                enrollmentId: "01999a3e-7c1b-7000-8000-000000000602",
                status: EnrollmentStatus.active,
              },
            ],
            warnings: [
              {
                studentId: HELENA,
                code: EnrollmentWarningCode.PREREQUISITE_NOT_COMPLETED,
                courseId: "01999a3e-7c1b-7000-8000-000000000701",
                courseName: "Informática Básica I",
              },
            ],
          } satisfies EnrollStudentsResponseDto,
          { status: 201 },
        ),
    });
    await renderRoutes(classesRoutes, { route: ROUTE });

    await user.click(await screen.findByRole("checkbox", { name: /Helena Martins Duarte/ }));
    await user.click(screen.getByRole("checkbox", { name: /José Almeida Ribeiro/ }));
    expect(screen.getByText("2 alunos selecionados")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Matricular selecionados (2)" }));

    expect(await screen.findByText("1 aluno matriculado")).toBeInTheDocument();
    expect(
      screen.getByText(
        "José Almeida Ribeiro já estava matriculado. Helena Martins Duarte ainda não concluiu o pré-requisito Informática Básica I.",
      ),
    ).toBeInTheDocument();
    expect(calls.enrollBodies).toEqual([{ studentIds: [HELENA, JOSE] }]);
    await waitFor(() => expect(screen.getByText("Nenhum aluno selecionado")).toBeInTheDocument());
  });

  it("selects with the keyboard: space marks the box and the count is announced", async () => {
    const user = userEvent.setup();
    useEnrollmentHandlers();
    await renderRoutes(classesRoutes, { route: ROUTE });

    const box = await screen.findByRole("checkbox", { name: /Helena Martins Duarte/ });
    box.focus();
    await user.keyboard(" ");

    expect(box).toBeChecked();
    expect(screen.getByText("1 aluno selecionado")).toBeInTheDocument();
  });

  it("warns before sending when the selection is over the seats left, and does not let it send", async () => {
    const user = userEvent.setup();
    const calls = useEnrollmentHandlers({
      detail: buildClassDetail({ summary: buildClassSummary({ enrolledCount: 14, capacity: 15 }) }),
    });
    await renderRoutes(classesRoutes, { route: ROUTE });

    await user.click(await screen.findByRole("checkbox", { name: /Helena Martins Duarte/ }));
    await user.click(screen.getByRole("checkbox", { name: /José Almeida Ribeiro/ }));

    expect(
      screen.getByText("A turma só tem 1 vaga. Deixe no máximo 1 aluno selecionado."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Matricular selecionados (2)" })).toBeDisabled();
    expect(calls.enrollBodies).toEqual([]);
  });

  it("shows the seats left of a 409 CLASS_FULL and enrolls nobody", async () => {
    const user = userEvent.setup();
    useEnrollmentHandlers({
      enroll: () =>
        HttpResponse.json(
          {
            statusCode: 409,
            error: "CLASS_FULL",
            message: "Class full.",
            details: [{ field: "studentIds", message: "1" }],
          },
          { status: 409 },
        ),
    });
    await renderRoutes(classesRoutes, { route: ROUTE });

    await user.click(await screen.findByRole("checkbox", { name: /Helena Martins Duarte/ }));
    await user.click(screen.getByRole("button", { name: "Matricular selecionado (1)" }));

    expect(
      await screen.findByText("A turma só tem 1 vaga. Ninguém foi matriculado."),
    ).toBeInTheDocument();
    expect(screen.getByText("1 aluno selecionado")).toBeInTheDocument();
  });

  it("turns the enrollment off for a class that is closed", async () => {
    useEnrollmentHandlers({ detail: buildClassDetail({ status: ClassStatus.completed }) });
    await renderRoutes(classesRoutes, { route: ROUTE });

    expect(
      await screen.findByText("Esta turma está encerrada e não recebe matrículas."),
    ).toBeInTheDocument();
    expect(await screen.findByRole("checkbox", { name: /Helena Martins Duarte/ })).toBeDisabled();
  });

  it("starts with the student of ?studentId= selected", async () => {
    useEnrollmentHandlers();
    await renderRoutes(classesRoutes, { route: `${ROUTE}?studentId=${HELENA}` });

    expect(await screen.findByRole("checkbox", { name: /Helena Martins Duarte/ })).toBeChecked();
    expect(within(availableCard()).getAllByRole("checkbox", { checked: true })).toHaveLength(1);
  });

  it("removes an enrollment after confirming, and explains a 409 ENROLLMENT_NOT_REMOVABLE", async () => {
    const user = userEvent.setup();
    let refuse = true;
    const calls = useEnrollmentHandlers({
      remove: () =>
        refuse
          ? HttpResponse.json(
              { statusCode: 409, error: "ENROLLMENT_NOT_REMOVABLE", message: "No." },
              { status: 409 },
            )
          : new HttpResponse(null, { status: 204 }),
    });
    await renderRoutes(classesRoutes, { route: ROUTE });

    await user.click(
      await screen.findByRole("button", { name: "Remover a matrícula de Maria da Silva Santos" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Remover matrícula" });
    await user.click(within(dialog).getByRole("button", { name: "Remover matrícula" }));

    expect(
      await within(dialog).findByText(/Esta matrícula não pode ser removida/),
    ).toBeInTheDocument();

    refuse = false;
    await user.click(within(dialog).getByRole("button", { name: "Remover matrícula" }));

    expect(
      await screen.findByText("Matrícula de Maria da Silva Santos removida"),
    ).toBeInTheDocument();
    expect(calls.removed).toEqual([ENROLLED[0].id, ENROLLED[0].id]);
  });

  it("asks for a class first on /enrollments", async () => {
    useEnrollmentHandlers();
    await renderRoutes(classesRoutes, { route: "/enrollments" });

    expect(
      await screen.findByText(
        "Escolha uma turma para ver os alunos disponíveis e os matriculados.",
      ),
    ).toBeInTheDocument();
  });

  it("blocks who cannot manage enrollments", async () => {
    useEnrollmentHandlers();
    await renderRoutes(classesRoutes, { route: ROUTE, user: buildMeUser(Role.member) });

    expect(await screen.findByText("Você não tem acesso a esta tela")).toBeInTheDocument();
    expect(screen.queryByText("Helena Martins Duarte")).not.toBeInTheDocument();
  });
});
