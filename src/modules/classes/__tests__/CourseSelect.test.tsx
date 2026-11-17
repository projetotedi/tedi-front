import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CourseCategory, CourseStatus, type ClassCourseResponseDto } from "@api/generated/model";
import i18n from "@shared/i18n";

import "../index";
import { CourseSelect, type CourseSelectProps } from "../components/CourseSelect";

const COURSES: ClassCourseResponseDto[] = [
  {
    id: "smartphones",
    name: "Smartphones no dia a dia",
    category: CourseCategory.basic,
    status: CourseStatus.active,
  },
  {
    id: "photo",
    name: "Fotografia digital",
    category: CourseCategory.advanced,
    status: CourseStatus.archived,
  },
  {
    id: "computer",
    name: "Informática Básica",
    category: CourseCategory.basic,
    status: CourseStatus.active,
  },
  {
    id: "old",
    name: "Curso antigo",
    category: CourseCategory.basic,
    status: CourseStatus.archived,
  },
  {
    id: "internet",
    name: "Internet",
    category: CourseCategory.intermediate,
    status: CourseStatus.active,
  },
];

const LOCKED_HINT = "O curso só pode ser trocado enquanto a turma está Planejada e sem matrículas.";

type HarnessProps = Partial<Omit<CourseSelectProps, "value">> & { initial?: string | null };

function Harness({ initial = null, onChange, ...props }: HarnessProps) {
  const [value, setValue] = useState<string | null>(initial);

  return (
    <CourseSelect
      label="Curso"
      courses={COURSES}
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

const trigger = () => screen.getByRole("button", { name: /Curso/ });
const optionNames = () => screen.getAllByRole("option").map((option) => option.textContent);

beforeEach(async () => {
  await i18n.changeLanguage("pt-BR");
});

describe("CourseSelect", () => {
  it("offers only the active courses, ordered by name", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(trigger());

    expect(optionNames()).toEqual(["Informática Básica", "Internet", "Smartphones no dia a dia"]);
  });

  it("does not offer an archived course", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(trigger());

    expect(screen.queryByRole("option", { name: /Fotografia digital/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Curso antigo/ })).not.toBeInTheDocument();
  });

  it("keeps the course the class already has when it was archived since, marked, and no other archived one", async () => {
    const user = userEvent.setup();
    render(<Harness initial="photo" currentCourseId="photo" />);

    expect(trigger()).toHaveTextContent("Fotografia digital (arquivado)");

    await user.click(trigger());

    expect(optionNames()).toEqual([
      "Fotografia digital (arquivado)",
      "Informática Básica",
      "Internet",
      "Smartphones no dia a dia",
    ]);
    expect(screen.getByRole("option", { name: "Fotografia digital (arquivado)" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByRole("option", { name: /Curso antigo/ })).not.toBeInTheDocument();
  });

  it("does not mark an active course as archived", async () => {
    const user = userEvent.setup();
    render(<Harness initial="computer" currentCourseId="computer" />);

    expect(trigger()).toHaveTextContent("Informática Básica");
    expect(trigger()).not.toHaveTextContent("arquivado");

    await user.click(trigger());

    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("reports the id of the course that was chosen", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(trigger());
    await user.click(screen.getByRole("option", { name: "Internet" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith("internet");
    expect(trigger()).toHaveTextContent("Internet");
  });

  it("asks to choose a course while there is none", () => {
    render(<Harness />);

    expect(trigger()).toHaveTextContent("Selecione o curso");
  });

  it("treats an empty value as no course", () => {
    render(<CourseSelect label="Curso" courses={COURSES} value="" onChange={() => {}} />);

    expect(trigger()).toHaveTextContent("Selecione o curso");
  });

  it("is named by its label", () => {
    render(<Harness label="Curso da turma" />);

    expect(screen.getByRole("button", { name: /Curso da turma/ })).toBeInTheDocument();
  });

  describe("turned off", () => {
    it("cannot be opened and has the hint as its description", async () => {
      const user = userEvent.setup();
      render(<Harness initial="computer" isDisabled description={LOCKED_HINT} />);

      expect(trigger()).toBeDisabled();
      expect(trigger()).toHaveAccessibleDescription(LOCKED_HINT);
      expect(screen.getByText(LOCKED_HINT)).toBeVisible();

      await user.click(trigger());

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("keeps showing the course that is chosen", () => {
      render(<Harness initial="computer" isDisabled description={LOCKED_HINT} />);

      expect(trigger()).toHaveTextContent("Informática Básica");
    });
  });

  describe("with an error", () => {
    it("tells it as the description of the field", () => {
      render(
        <Harness initial="computer" errorMessage="Curso não encontrado. Escolha outro curso." />,
      );

      expect(trigger()).toHaveAccessibleDescription("Curso não encontrado. Escolha outro curso.");
    });

    it("gives the place of the hint to the error, so the two are not read together", () => {
      render(
        <Harness
          initial="computer"
          isDisabled
          description={LOCKED_HINT}
          errorMessage="Esta turma não pode mais trocar de curso."
        />,
      );

      expect(screen.queryByText(LOCKED_HINT)).not.toBeInTheDocument();
      expect(trigger()).toHaveAccessibleDescription("Esta turma não pode mais trocar de curso.");
    });
  });

  it("keeps the 44px touch target of the shared select", () => {
    render(<Harness />);

    expect(trigger()).toHaveClass("min-h-11", "text-base");
  });
});
