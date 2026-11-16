import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  ClassStatus,
  CourseCategory,
  CourseStatus,
  type ClassCourseResponseDto,
} from "@api/generated/model";
import i18n from "@shared/i18n";

import "../index";
import { ClassDataCard } from "../components/ClassDataCard";
import { ClassDetailHeader } from "../components/ClassDetailHeader";
import { InheritedLevelBadge } from "../components/InheritedLevelBadge";
import { initialClasses, type ClassRecord } from "../mocks/classes.mock";

function buildCourse(overrides: Partial<ClassCourseResponseDto> = {}): ClassCourseResponseDto {
  return {
    id: "computer",
    name: "Informática Básica",
    category: CourseCategory.basic,
    status: CourseStatus.active,
    ...overrides,
  };
}

function classRecord(id: string): ClassRecord {
  const found = initialClasses.find((record) => record.id === id);
  if (found === undefined) throw new Error(`No mock class "${id}"`);
  return found;
}

/** The field (`<dt>` and its `<dd>`) of the card, by label. */
function valueOf(label: string): HTMLElement {
  const value = screen.getByText(label, { selector: "dt" }).nextElementSibling;
  if (!(value instanceof HTMLElement)) throw new Error(`No value for "${label}"`);
  return value;
}

const tags = () => screen.getAllByRole("listitem").map((tag) => tag.textContent);

beforeEach(async () => {
  await i18n.changeLanguage("pt-BR");
});

describe("InheritedLevelBadge", () => {
  it.each([
    [CourseCategory.basic, "Nível básico — herdado do curso"],
    [CourseCategory.intermediate, "Nível intermediário — herdado do curso"],
    [CourseCategory.advanced, "Nível avançado — herdado do curso"],
  ])("says the %s level comes from the course", (category, text) => {
    render(<InheritedLevelBadge category={category} />);

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("is in English when the language is English", async () => {
    await i18n.changeLanguage("en-US");
    render(<InheritedLevelBadge category={CourseCategory.advanced} />);

    expect(screen.getByText("Advanced level — inherited from the course")).toBeInTheDocument();
  });
});

describe("ClassDetailHeader", () => {
  it("shows the name of the class as a heading, with its status and the level inherited from the course", () => {
    render(
      <ClassDetailHeader
        title="Turma 2026.2"
        status={ClassStatus.in_progress}
        isArchived={false}
        course={buildCourse()}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Turma 2026.2" })).toBeInTheDocument();
    expect(tags()).toEqual(["Em andamento", "Nível básico — herdado do curso"]);
  });

  it("adds Arquivada, and keeps the status the class had", () => {
    render(
      <ClassDetailHeader
        title="Turma 2026.2"
        status={ClassStatus.completed}
        isArchived
        course={buildCourse()}
      />,
    );

    expect(tags()).toEqual(["Encerrada", "Arquivada", "Nível básico — herdado do curso"]);
  });

  it.each([
    [ClassStatus.planned, "Planejada"],
    [ClassStatus.in_progress, "Em andamento"],
    [ClassStatus.completed, "Encerrada"],
    [ClassStatus.cancelled, "Cancelada"],
  ])("writes the %s status as %s", (status, label) => {
    render(
      <ClassDetailHeader title="Turma" status={status} isArchived={false} course={buildCourse()} />,
    );

    expect(tags()[0]).toBe(label);
  });

  it("takes the level from the category of the course it was given", () => {
    const { rerender } = render(
      <ClassDetailHeader
        title="Turma"
        status={ClassStatus.planned}
        isArchived={false}
        course={buildCourse({ category: CourseCategory.basic })}
      />,
    );
    expect(screen.getByText("Nível básico — herdado do curso")).toBeInTheDocument();

    rerender(
      <ClassDetailHeader
        title="Turma"
        status={ClassStatus.planned}
        isArchived={false}
        course={buildCourse({ category: CourseCategory.intermediate })}
      />,
    );

    expect(screen.getByText("Nível intermediário — herdado do curso")).toBeInTheDocument();
    expect(screen.queryByText("Nível básico — herdado do curso")).not.toBeInTheDocument();
  });
});

describe("ClassDataCard", () => {
  it("shows the data of the class: code, edition, period, seats, and the course with its level", () => {
    render(<ClassDataCard classRecord={classRecord("1")} course={buildCourse()} />);

    expect(screen.getByRole("heading", { name: "Dados da turma" })).toBeInTheDocument();
    expect(valueOf("Código")).toHaveTextContent("TUR-2026.2");
    expect(valueOf("Edição")).toHaveTextContent("1º semestre 2026");
    expect(valueOf("Período")).toHaveTextContent("03/03/26 - 27/05/26");
    expect(within(valueOf("Vagas")).getByText("12/15")).toBeVisible();
    expect(valueOf("Curso")).toHaveTextContent("Informática Básica");
    expect(valueOf("Nível (do curso)")).toHaveTextContent("Básico");
  });

  it("tells a screen reader how many seats are taken", () => {
    render(<ClassDataCard classRecord={classRecord("1")} course={buildCourse()} />);

    expect(within(valueOf("Vagas")).getByText("12 de 15 vagas ocupadas")).toHaveClass("sr-only");
    expect(within(valueOf("Vagas")).getByText("12/15")).toHaveAttribute("aria-hidden", "true");
  });

  it("says Não informado when the class has no location, and shows it when it has", () => {
    const { rerender } = render(
      <ClassDataCard classRecord={classRecord("1")} course={buildCourse()} />,
    );
    expect(valueOf("Local")).toHaveTextContent("Não informado");

    rerender(
      <ClassDataCard
        classRecord={{ ...classRecord("1"), location: "Laboratório 2 — Bloco B" }}
        course={buildCourse()}
      />,
    );

    expect(valueOf("Local")).toHaveTextContent("Laboratório 2 — Bloco B");
  });

  it.each([
    [CourseCategory.basic, "Básico"],
    [CourseCategory.intermediate, "Intermediário"],
    [CourseCategory.advanced, "Avançado"],
  ])(
    "shows the level of a %s course as %s: it is always the level of the course",
    (category, label) => {
      render(<ClassDataCard classRecord={classRecord("1")} course={buildCourse({ category })} />);

      expect(valueOf("Nível (do curso)")).toHaveTextContent(new RegExp(`^${label}$`));
    },
  );

  it("has no level of its own to show: a class record carries no level", () => {
    expect(classRecord("1")).not.toHaveProperty("level");
  });
});
