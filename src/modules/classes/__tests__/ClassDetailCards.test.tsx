import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClassStatus, CourseCategory } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { ClassDataCard } from "../components/ClassDataCard";
import { ClassDetailHeader } from "../components/ClassDetailHeader";
import { ClassSummaryCard } from "../components/ClassSummaryCard";
import { ComingSoonCard } from "../components/ComingSoonCard";
import { EnrolledStudentsCard } from "../components/EnrolledStudentsCard";
import { InheritedLevelBadge } from "../components/InheritedLevelBadge";
import {
  buildArchivedClassDetail,
  buildClassCourse,
  buildClassDetail,
  buildClassSummary,
  buildEnrollment,
  buildMeUser,
  CLASS_ID,
  STUDENT_NAMES,
} from "./handlers";
import { renderWithProviders, setupClassesTestServer } from "./test-utils";

setupClassesTestServer();

/** The card (the root with `data-slot="card"`) whose `<h2>` is `name`. */
function card(name: string): HTMLElement {
  const root = screen.getByRole("heading", { name }).closest("[data-slot='card']");
  if (!(root instanceof HTMLElement)) throw new Error(`No card titled "${name}"`);
  return root;
}

/** The value (`<dd>`) of the field `label` (`<dt>`) inside `scope`. */
function valueOf(scope: HTMLElement, label: string): HTMLElement {
  const value = within(scope).getByText(label, { selector: "dt" }).nextElementSibling;
  if (!(value instanceof HTMLElement)) throw new Error(`No value for "${label}"`);
  return value;
}

const labelsOf = (scope: HTMLElement) =>
  within(scope)
    .getAllByRole("term")
    .map((label) => label.textContent);

const tags = () => screen.getAllByRole("listitem").map((tag) => tag.textContent);

describe("InheritedLevelBadge", () => {
  it.each([
    [CourseCategory.basic, "Nível básico — herdado do curso"],
    [CourseCategory.intermediate, "Nível intermediário — herdado do curso"],
    [CourseCategory.advanced, "Nível avançado — herdado do curso"],
  ])("says the %s level comes from the course", async (category, text) => {
    await renderWithProviders(<InheritedLevelBadge category={category} />);

    expect(screen.getByText(text)).toBeInTheDocument();
  });
});

describe("ClassDetailHeader", () => {
  it("shows the name as a heading and the tags: status, edition, inherited level and seats", async () => {
    await renderWithProviders(<ClassDetailHeader classDetail={buildClassDetail()} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Informática Básica — Turma A" }),
    ).toBeInTheDocument();
    expect(tags()).toEqual([
      "Em andamento",
      "Edição 2026.1",
      "Nível básico — herdado do curso",
      "12 de 15 vagas",
    ]);
  });

  it("puts Arquivada right after the status for an archived class, which keeps its own status", async () => {
    await renderWithProviders(<ClassDetailHeader classDetail={buildArchivedClassDetail()} />);

    expect(tags()).toEqual([
      "Em andamento",
      "Arquivada",
      "Edição 2026.1",
      "Nível básico — herdado do curso",
      "12 de 15 vagas",
    ]);
  });

  it("has no Arquivada tag for a class that is not archived", async () => {
    await renderWithProviders(<ClassDetailHeader classDetail={buildClassDetail()} />);

    expect(screen.queryByText("Arquivada")).not.toBeInTheDocument();
  });

  it("uses the code as the title of a class with no name", async () => {
    await renderWithProviders(<ClassDetailHeader classDetail={buildClassDetail({ name: null })} />);

    expect(screen.getByRole("heading", { level: 2, name: "INFO-A" })).toBeInTheDocument();
  });

  it.each([
    [ClassStatus.planned, "Planejada"],
    [ClassStatus.in_progress, "Em andamento"],
    [ClassStatus.completed, "Encerrada"],
    [ClassStatus.cancelled, "Cancelada"],
  ])("says the status %s as %s", async (status, label) => {
    await renderWithProviders(<ClassDetailHeader classDetail={buildClassDetail({ status })} />);

    expect(tags()[0]).toBe(label);
  });

  it.each([
    [CourseCategory.basic, "Nível básico — herdado do curso"],
    [CourseCategory.intermediate, "Nível intermediário — herdado do curso"],
    [CourseCategory.advanced, "Nível avançado — herdado do curso"],
  ])("says the level of a %s course as %s", async (category, label) => {
    await renderWithProviders(
      <ClassDetailHeader
        classDetail={buildClassDetail({ course: buildClassCourse({ category }) })}
      />,
    );

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each([
    [0, 15, "0 de 15 vagas"],
    [15, 15, "15 de 15 vagas"],
    [0, 1, "0 de 1 vaga"],
  ])("says %s enrolled of %s seats as %s", async (enrolledCount, capacity, label) => {
    await renderWithProviders(
      <ClassDetailHeader
        classDetail={buildClassDetail({ summary: buildClassSummary({ enrolledCount, capacity }) })}
      />,
    );

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("has no actions yet: Gerar aulas, Editar turma and + Nova aula wait for their own tasks", async () => {
    await renderWithProviders(<ClassDetailHeader classDetail={buildClassDetail()} />, {
      user: buildMeUser(Role.coordinator),
    });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("ClassDataCard", () => {
  it("shows the eleven fields of the Figma, in its order, with their values", async () => {
    await renderWithProviders(<ClassDataCard classDetail={buildClassDetail()} />);

    const data = card("Dados da turma");
    expect(labelsOf(data)).toEqual([
      "Código",
      "Curso",
      "Nível (do curso)",
      "Edição",
      "Início",
      "Término",
      "Local",
      "Status",
      "Vagas totais",
      "Matriculados",
      "Criada em",
    ]);
    expect(valueOf(data, "Código")).toHaveTextContent(/^INFO-A$/);
    expect(valueOf(data, "Curso")).toHaveTextContent(/^Informática Básica$/);
    expect(valueOf(data, "Nível (do curso)")).toHaveTextContent(/^Básico$/);
    expect(valueOf(data, "Edição")).toHaveTextContent(/^2026\.1$/);
    expect(valueOf(data, "Início")).toHaveTextContent(/^03\/03\/2026$/);
    expect(valueOf(data, "Término")).toHaveTextContent(/^27\/06\/2026$/);
    expect(valueOf(data, "Local")).toHaveTextContent(/^Laboratório 3, bloco B$/);
    expect(valueOf(data, "Status")).toHaveTextContent(/^Em andamento$/);
    expect(valueOf(data, "Vagas totais")).toHaveTextContent(/^15$/);
    expect(valueOf(data, "Matriculados")).toHaveTextContent(/^12 ativos$/);
    expect(valueOf(data, "Criada em")).toHaveTextContent(/^12\/02\/2026$/);
  });

  it("shows a dash for who sees and 'Não informado' for who hears when the location is null", async () => {
    await renderWithProviders(<ClassDataCard classDetail={buildClassDetail({ location: null })} />);

    const location = within(valueOf(card("Dados da turma"), "Local"));
    expect(location.getByText("—")).toHaveAttribute("aria-hidden", "true");
    expect(location.getByText("Não informado")).toHaveClass("sr-only");
    // The other fields keep their values.
    expect(valueOf(card("Dados da turma"), "Código")).toHaveTextContent("INFO-A");
  });

  it.each([
    [0, "0 ativos"],
    [1, "1 ativo"],
    [12, "12 ativos"],
  ])("says %s enrolled students as %s", async (enrolledCount, label) => {
    await renderWithProviders(
      <ClassDataCard
        classDetail={buildClassDetail({ summary: buildClassSummary({ enrolledCount }) })}
      />,
    );

    expect(valueOf(card("Dados da turma"), "Matriculados")).toHaveTextContent(
      new RegExp(`^${label}$`),
    );
  });

  it.each([
    [CourseCategory.basic, "Básico"],
    [CourseCategory.intermediate, "Intermediário"],
    [CourseCategory.advanced, "Avançado"],
  ])("shows the level of a %s course as %s", async (category, label) => {
    await renderWithProviders(
      <ClassDataCard classDetail={buildClassDetail({ course: buildClassCourse({ category }) })} />,
    );

    expect(valueOf(card("Dados da turma"), "Nível (do curso)")).toHaveTextContent(
      new RegExp(`^${label}$`),
    );
  });

  it("keeps the status of an archived class, which is a different thing", async () => {
    await renderWithProviders(
      <ClassDataCard classDetail={buildArchivedClassDetail({ status: ClassStatus.completed })} />,
    );

    expect(valueOf(card("Dados da turma"), "Status")).toHaveTextContent(/^Encerrada$/);
  });
});

describe("ClassSummaryCard", () => {
  it("shows the workload in hours, the students out of the seats and a dash for what does not exist yet", async () => {
    await renderWithProviders(
      <ClassSummaryCard plannedWorkloadMinutes={450} summary={buildClassSummary()} />,
    );

    const summary = card("Resumo");
    expect(labelsOf(summary)).toEqual([
      "Carga horária",
      "Aulas realizadas",
      "Alunos",
      "Frequência média",
    ]);
    expect(valueOf(summary, "Carga horária")).toHaveTextContent(/^7h30$/);
    expect(valueOf(summary, "Alunos")).toHaveTextContent(/^12 de 15$/);
    for (const label of ["Aulas realizadas", "Frequência média"]) {
      const value = within(valueOf(summary, label));
      expect(value.getByText("—")).toHaveAttribute("aria-hidden", "true");
      expect(value.getByText("Não informado")).toHaveClass("sr-only");
    }
  });

  it("shows the lessons held out of the lessons of the class and the attendance as a percentage", async () => {
    await renderWithProviders(
      <ClassSummaryCard
        plannedWorkloadMinutes={450}
        summary={buildClassSummary({ lessonsDone: 2, lessonsTotal: 12, averageAttendance: 0.89 })}
      />,
    );

    const summary = card("Resumo");
    expect(valueOf(summary, "Aulas realizadas")).toHaveTextContent(/^2 de 12$/);
    expect(valueOf(summary, "Frequência média")).toHaveTextContent(/^89%$/);
    expect(within(summary).queryByText("—")).not.toBeInTheDocument();
  });

  it("takes a zero for a value: no lessons held yet and no attendance at all", async () => {
    await renderWithProviders(
      <ClassSummaryCard
        plannedWorkloadMinutes={0}
        summary={buildClassSummary({ lessonsDone: 0, lessonsTotal: 12, averageAttendance: 0 })}
      />,
    );

    const summary = card("Resumo");
    expect(valueOf(summary, "Carga horária")).toHaveTextContent(/^0h$/);
    expect(valueOf(summary, "Aulas realizadas")).toHaveTextContent(/^0 de 12$/);
    expect(valueOf(summary, "Frequência média")).toHaveTextContent(/^0%$/);
    expect(within(summary).queryByText("—")).not.toBeInTheDocument();
  });

  it.each([
    ["the total is missing", { lessonsDone: 3, lessonsTotal: null }],
    ["the number held is missing", { lessonsDone: null, lessonsTotal: 12 }],
  ])(
    "shows a dash for the lessons when %s: one number alone says nothing",
    async (_label, lessons) => {
      await renderWithProviders(
        <ClassSummaryCard plannedWorkloadMinutes={450} summary={buildClassSummary(lessons)} />,
      );

      expect(
        within(valueOf(card("Resumo"), "Aulas realizadas")).getByText("Não informado"),
      ).toBeInTheDocument();
    },
  );

  it("shows the students of a full class as 15 de 15", async () => {
    await renderWithProviders(
      <ClassSummaryCard
        plannedWorkloadMinutes={450}
        summary={buildClassSummary({ enrolledCount: 15 })}
      />,
    );

    expect(valueOf(card("Resumo"), "Alunos")).toHaveTextContent(/^15 de 15$/);
  });
});

describe("EnrolledStudentsCard", () => {
  const preview = Array.from({ length: 5 }, (_, index) => buildEnrollment(index));

  it("shows the name and the day of enrollment of the students in the preview, in order", async () => {
    await renderWithProviders(
      <EnrolledStudentsCard classId={CLASS_ID} preview={preview} total={12} />,
    );

    const table = within(card("Alunos matriculados")).getByRole("table", {
      name: "Primeiros alunos matriculados na turma",
    });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Nome", "Matriculado em"]);
    expect(
      within(table)
        .getAllByRole("row")
        .slice(1)
        .map((row) =>
          within(row)
            .getAllByRole("cell")
            .map((cell) => cell.textContent),
        ),
    ).toEqual([
      [STUDENT_NAMES[0], "20/02/2026"],
      [STUDENT_NAMES[1], "21/02/2026"],
      [STUDENT_NAMES[2], "22/02/2026"],
      [STUDENT_NAMES[3], "23/02/2026"],
      [STUDENT_NAMES[4], "24/02/2026"],
    ]);
  });

  it("shows only the first five students even if it is given more", async () => {
    const seven = Array.from({ length: 7 }, (_, index) => buildEnrollment(index));

    await renderWithProviders(
      <EnrolledStudentsCard classId={CLASS_ID} preview={seven} total={12} />,
    );

    const rows = within(card("Alunos matriculados")).getAllByRole("row");
    expect(rows).toHaveLength(1 + 5);
    expect(screen.queryByText(STUDENT_NAMES[5])).not.toBeInTheDocument();
  });

  it("links Ver todos os 12 to the enrollment screen of the class, without the arrow in its name", async () => {
    await renderWithProviders(
      <EnrolledStudentsCard classId={CLASS_ID} preview={preview} total={12} />,
      { user: buildMeUser(Role.coordinator) },
    );

    const link = within(card("Alunos matriculados")).getByRole("link", {
      name: "Ver todos os 12",
    });
    expect(link).toHaveAttribute("href", `/enrollments?classId=${CLASS_ID}`);
    expect(link).toHaveTextContent(/^Ver todos os 12\s›$/);
    expect(within(link).getByText(/›/)).toHaveAttribute("aria-hidden", "true");
  });

  it("says it differently when there is a single student", async () => {
    await renderWithProviders(
      <EnrolledStudentsCard classId={CLASS_ID} preview={[buildEnrollment(0)]} total={1} />,
    );

    expect(screen.getByRole("link", { name: "Ver o aluno matriculado" })).toHaveAttribute(
      "href",
      `/enrollments?classId=${CLASS_ID}`,
    );
  });

  it.each([
    ["director", Role.director],
    ["coordinator", Role.coordinator],
  ])("the %s sees the link, since they manage enrollments", async (_label, role) => {
    await renderWithProviders(
      <EnrolledStudentsCard classId={CLASS_ID} preview={preview} total={12} />,
      { user: buildMeUser(role) },
    );

    expect(screen.getByRole("link", { name: "Ver todos os 12" })).toBeInTheDocument();
  });

  it("the member sees the students but not the link: only who manages enrollments reaches that screen", async () => {
    await renderWithProviders(
      <EnrolledStudentsCard classId={CLASS_ID} preview={preview} total={12} />,
      { user: buildMeUser(Role.member) },
    );

    expect(screen.getByText(STUDENT_NAMES[0])).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("says nobody is enrolled yet, with no table and no link, for a class with no enrollment", async () => {
    await renderWithProviders(<EnrolledStudentsCard classId={CLASS_ID} preview={[]} total={0} />, {
      user: buildMeUser(Role.coordinator),
    });

    const students = card("Alunos matriculados");
    expect(within(students).getByText("Nenhum aluno matriculado ainda.")).toBeInTheDocument();
    expect(within(students).queryByRole("table")).not.toBeInTheDocument();
    expect(within(students).queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("ComingSoonCard", () => {
  it("keeps the place of the card with its title and says it is coming, with no table, link or button", async () => {
    await renderWithProviders(<ComingSoonCard title="Aulas da turma" />);

    const soon = card("Aulas da turma");
    expect(within(soon).getByText("Em breve")).toBeInTheDocument();
    expect(within(soon).queryByRole("table")).not.toBeInTheDocument();
    expect(within(soon).queryByRole("link")).not.toBeInTheDocument();
    expect(within(soon).queryByRole("button")).not.toBeInTheDocument();
  });
});
