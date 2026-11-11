import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CourseCategory, CourseStatus, type RelatedCourseResponseDto } from "@api/generated/model";

import { CourseClassesCard } from "../components/CourseClassesCard";
import { CourseDataCard } from "../components/CourseDataCard";
import { CourseDetailHeader } from "../components/CourseDetailHeader";
import { CourseHistoryCard } from "../components/CourseHistoryCard";
import { CoursePrerequisitesCard } from "../components/CoursePrerequisitesCard";
import { CourseWorkloadCard } from "../components/CourseWorkloadCard";
import { buildArchivedCourseDetail, buildCourseDetail, COURSE_CREATOR_NAME } from "./handlers";
import { renderWithProviders, setupCatalogTestServer } from "./test-utils";

setupCatalogTestServer();

const OTHER_COURSE_ID = "01952ef7-0000-7000-8000-0000000000c3";

const SMARTPHONES: RelatedCourseResponseDto = {
  id: "01952ef7-0000-7000-8000-0000000000c2",
  name: "Smartphones no dia a dia",
  category: CourseCategory.basic,
  status: CourseStatus.active,
};

const ARCHIVED_COURSE: RelatedCourseResponseDto = {
  id: OTHER_COURSE_ID,
  name: "Computador para iniciantes",
  category: CourseCategory.basic,
  status: CourseStatus.archived,
};

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

describe("CourseDetailHeader", () => {
  it("shows the name as a heading and the tags: category, status, lesson plans and workload", async () => {
    await renderWithProviders(
      <CourseDetailHeader course={buildCourseDetail()} isArchived={false} />,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Redes Sociais com Segurança" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((tag) => tag.textContent)).toEqual([
      "Intermediário",
      "Ativo",
      "4 planos de aula",
      "7h previstas",
    ]);
  });

  it("shows Arquivado in the place of Ativo for an archived course", async () => {
    await renderWithProviders(
      <CourseDetailHeader course={buildArchivedCourseDetail()} isArchived />,
    );

    expect(screen.getAllByRole("listitem").map((tag) => tag.textContent)).toEqual([
      "Intermediário",
      "Arquivado",
      "4 planos de aula",
      "7h previstas",
    ]);
    expect(screen.queryByText("Ativo")).not.toBeInTheDocument();
  });

  it("goes by isArchived, which also says what a refused save learned", async () => {
    await renderWithProviders(<CourseDetailHeader course={buildCourseDetail()} isArchived />);

    expect(screen.getByText("Arquivado")).toBeInTheDocument();
    expect(screen.queryByText("Ativo")).not.toBeInTheDocument();
  });

  it.each([
    [0, "0 planos de aula"],
    [1, "1 plano de aula"],
    [2, "2 planos de aula"],
  ])("says %s lesson plans as %s", async (count, expected) => {
    const lessonPlans = buildCourseDetail().lessonPlans.slice(0, count);

    await renderWithProviders(
      <CourseDetailHeader course={buildCourseDetail({ lessonPlans })} isArchived={false} />,
    );

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it.each([
    [90, "1h30 previstas"],
    [420, "7h previstas"],
    [0, "0h previstas"],
  ])("shows %s minutes of workload as %s, in hours", async (minutes, expected) => {
    await renderWithProviders(
      <CourseDetailHeader
        course={buildCourseDetail({ plannedWorkloadMinutes: minutes })}
        isArchived={false}
      />,
    );

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("has no actions yet and no tag of classes, which wait for their own tasks", async () => {
    await renderWithProviders(
      <CourseDetailHeader course={buildCourseDetail()} isArchived={false} />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/turma/)).not.toBeInTheDocument();
  });
});

describe("CourseDataCard", () => {
  it("shows the data of the course", async () => {
    await renderWithProviders(<CourseDataCard course={buildCourseDetail()} isArchived={false} />);

    const data = card("Dados do curso");
    expect(
      within(data)
        .getAllByRole("term")
        .map((label) => label.textContent),
    ).toEqual(["Nome do curso", "Categoria", "Status", "Criado em", "Descrição", "Objetivo"]);
    expect(valueOf(data, "Nome do curso")).toHaveTextContent("Redes Sociais com Segurança");
    expect(valueOf(data, "Categoria")).toHaveTextContent("Intermediário");
    expect(valueOf(data, "Status")).toHaveTextContent("Ativo");
    expect(valueOf(data, "Criado em")).toHaveTextContent("12/02/2024");
    expect(valueOf(data, "Descrição")).toHaveTextContent(
      "WhatsApp, Instagram e os golpes mais comuns.",
    );
    expect(valueOf(data, "Objetivo")).toHaveTextContent(
      "Participar das redes sociais reconhecendo os riscos.",
    );
  });

  it.each([
    [CourseCategory.basic, "Básico"],
    [CourseCategory.intermediate, "Intermediário"],
    [CourseCategory.advanced, "Avançado"],
  ])("writes the category %s as %s", async (category, expected) => {
    await renderWithProviders(
      <CourseDataCard course={buildCourseDetail({ category })} isArchived={false} />,
    );

    expect(valueOf(card("Dados do curso"), "Categoria")).toHaveTextContent(expected);
  });

  it("shows Arquivado as the status of an archived course", async () => {
    await renderWithProviders(<CourseDataCard course={buildArchivedCourseDetail()} isArchived />);

    expect(valueOf(card("Dados do curso"), "Status")).toHaveTextContent("Arquivado");
  });

  it("shows a dash for a missing objective, read as Não informado", async () => {
    await renderWithProviders(
      <CourseDataCard course={buildCourseDetail({ objective: null })} isArchived={false} />,
    );

    const objective = valueOf(card("Dados do curso"), "Objetivo");

    expect(objective).toHaveTextContent("—Não informado");
    expect(within(objective).getByText("—")).toHaveAttribute("aria-hidden", "true");
    expect(within(objective).getByText("Não informado")).toHaveClass("sr-only");
  });

  it("treats an empty description as missing too, and shows the objective that is there", async () => {
    await renderWithProviders(
      <CourseDataCard course={buildCourseDetail({ description: "" })} isArchived={false} />,
    );

    const data = card("Dados do curso");

    expect(valueOf(data, "Descrição")).toHaveTextContent("—Não informado");
    expect(valueOf(data, "Objetivo")).toHaveTextContent(
      "Participar das redes sociais reconhecendo os riscos.",
    );
  });
});

describe("CourseClassesCard", () => {
  it("says the classes are not available yet, with no table, no link and no button", async () => {
    await renderWithProviders(<CourseClassesCard />);

    const classes = card("Turmas deste curso");

    expect(
      within(classes).getByText("As turmas deste curso vão aparecer aqui em breve."),
    ).toBeInTheDocument();
    expect(within(classes).queryByRole("table")).not.toBeInTheDocument();
    expect(within(classes).queryByRole("link")).not.toBeInTheDocument();
    expect(within(classes).queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("CourseWorkloadCard", () => {
  it("shows Total previsto and Aulas por turma", async () => {
    await renderWithProviders(
      <CourseWorkloadCard plannedWorkloadMinutes={420} lessonPlanCount={4} />,
    );

    const workload = card("Carga horária prevista");

    expect(valueOf(workload, "Total previsto")).toHaveTextContent(/^7h$/);
    expect(valueOf(workload, "Aulas por turma")).toHaveTextContent(/^4$/);
  });

  it("formats 90 minutes as 1h30", async () => {
    await renderWithProviders(
      <CourseWorkloadCard plannedWorkloadMinutes={90} lessonPlanCount={1} />,
    );

    expect(valueOf(card("Carga horária prevista"), "Total previsto")).toHaveTextContent(/^1h30$/);
  });

  it("shows 0h and 0 for a course with no plans", async () => {
    await renderWithProviders(
      <CourseWorkloadCard plannedWorkloadMinutes={0} lessonPlanCount={0} />,
    );

    const workload = card("Carga horária prevista");

    expect(valueOf(workload, "Total previsto")).toHaveTextContent(/^0h$/);
    expect(valueOf(workload, "Aulas por turma")).toHaveTextContent(/^0$/);
  });
});

describe("CoursePrerequisitesCard", () => {
  it("lists the required courses as links to /courses/:id, and the courses that require this one", async () => {
    await renderWithProviders(
      <CoursePrerequisitesCard prerequisites={[SMARTPHONES]} requiredBy={[ARCHIVED_COURSE]} />,
    );

    const prerequisites = card("Pré-requisitos");
    const required = within(valueOf(prerequisites, "Cursos exigidos"));
    const requiredBy = within(valueOf(prerequisites, "É pré-requisito de"));

    expect(required.getByRole("link", { name: "Smartphones no dia a dia" })).toHaveAttribute(
      "href",
      `/courses/${SMARTPHONES.id}`,
    );
    expect(requiredBy.getByRole("link", { name: "Computador para iniciantes" })).toHaveAttribute(
      "href",
      `/courses/${OTHER_COURSE_ID}`,
    );
  });

  it("lists every course of a field, in the order it received them", async () => {
    await renderWithProviders(
      <CoursePrerequisitesCard prerequisites={[ARCHIVED_COURSE, SMARTPHONES]} requiredBy={[]} />,
    );

    const links = within(valueOf(card("Pré-requisitos"), "Cursos exigidos")).getAllByRole("link");

    expect(links.map((link) => link.textContent)).toEqual([
      "Computador para iniciantes",
      "Smartphones no dia a dia",
    ]);
  });

  it("tags an archived course with Arquivado and leaves the active ones alone", async () => {
    await renderWithProviders(
      <CoursePrerequisitesCard prerequisites={[SMARTPHONES, ARCHIVED_COURSE]} requiredBy={[]} />,
    );

    const [active, archived] = within(
      valueOf(card("Pré-requisitos"), "Cursos exigidos"),
    ).getAllByRole("listitem");

    expect(within(active).queryByText("Arquivado")).not.toBeInTheDocument();
    expect(within(archived).getByText("Arquivado")).toBeInTheDocument();
  });

  it("makes the links 44px targets", async () => {
    await renderWithProviders(
      <CoursePrerequisitesCard prerequisites={[SMARTPHONES]} requiredBy={[]} />,
    );

    expect(screen.getByRole("link", { name: "Smartphones no dia a dia" })).toHaveClass("min-h-11");
  });

  it("shows a dash when there are no prerequisites, read as Não informado", async () => {
    await renderWithProviders(<CoursePrerequisitesCard prerequisites={[]} requiredBy={[]} />);

    const prerequisites = card("Pré-requisitos");

    for (const label of ["Cursos exigidos", "É pré-requisito de"]) {
      const value = valueOf(prerequisites, label);

      expect(value).toHaveTextContent("—Não informado");
      expect(within(value).getByText("—")).toHaveAttribute("aria-hidden", "true");
      expect(within(value).getByText("Não informado")).toHaveClass("sr-only");
    }
    expect(within(prerequisites).queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows the dash only in the field that is empty", async () => {
    await renderWithProviders(
      <CoursePrerequisitesCard prerequisites={[SMARTPHONES]} requiredBy={[]} />,
    );

    const prerequisites = card("Pré-requisitos");

    expect(valueOf(prerequisites, "Cursos exigidos")).not.toHaveTextContent("—");
    expect(valueOf(prerequisites, "É pré-requisito de")).toHaveTextContent("—Não informado");
  });
});

describe("CourseHistoryCard", () => {
  it("shows Criado por", async () => {
    await renderWithProviders(<CourseHistoryCard createdBy={buildCourseDetail().createdBy} />);

    expect(valueOf(card("Catálogo e histórico"), "Criado por")).toHaveTextContent(
      COURSE_CREATOR_NAME,
    );
  });

  it("shows a dash when createdBy is null, read as Não informado", async () => {
    await renderWithProviders(<CourseHistoryCard createdBy={null} />);

    const createdBy = valueOf(card("Catálogo e histórico"), "Criado por");

    expect(createdBy).toHaveTextContent("—Não informado");
    expect(within(createdBy).getByText("—")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("the side cards", () => {
  it.each([
    ["Carga horária prevista", ["Total previsto", "Aulas por turma"], ["7h", "4"]],
    [
      "Pré-requisitos",
      ["Cursos exigidos", "É pré-requisito de"],
      ["Smartphones no dia a dia", "—Não informado"],
    ],
    ["Catálogo e histórico", ["Criado por"], [COURSE_CREATOR_NAME]],
  ])("the %s card has only labels and values", async (title, labels, values) => {
    const course = buildCourseDetail();
    await renderWithProviders(
      <>
        <CourseWorkloadCard
          plannedWorkloadMinutes={course.plannedWorkloadMinutes}
          lessonPlanCount={course.lessonPlanCount}
        />
        <CoursePrerequisitesCard
          prerequisites={course.prerequisites}
          requiredBy={course.requiredBy}
        />
        <CourseHistoryCard createdBy={course.createdBy} />
      </>,
    );

    const side = card(title);

    expect(
      within(side)
        .getAllByRole("term")
        .map((label) => label.textContent),
    ).toEqual(labels);
    expect(
      within(side)
        .getAllByRole("definition")
        .map((value) => value.textContent),
    ).toEqual(values);
    // No sentence of explanation: nothing but the title and the label/value pairs.
    expect(side.querySelectorAll("p")).toHaveLength(0);
    expect(side.textContent).toBe(
      `${title}${labels.map((label, index) => `${label}${values[index]}`).join("")}`,
    );
  });
});
