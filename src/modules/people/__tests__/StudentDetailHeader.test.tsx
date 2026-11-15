import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { AccessibilityNeed } from "@api/generated/model";
import i18n from "@shared/i18n";

// Registers the "people" namespace.
import "../index";
import { StudentDetailHeader } from "../components/StudentDetailHeader";
import { buildStudentDetail, STUDENT_NAME } from "./handlers";

const tags = () => within(screen.getByRole("list")).getAllByRole("listitem");

/** The row that holds the name block and, when there is one, the area of the actions. */
function row(): HTMLElement {
  const block = screen.getByRole("heading", { name: STUDENT_NAME }).parentElement;
  const container = block?.parentElement;
  if (!(container instanceof HTMLElement)) throw new Error("No row around the name");
  return container;
}

describe("StudentDetailHeader", () => {
  // The i18n instance is global to the test file and the language detector reads the browser.
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("shows the name as the h2 of the card and the tags under it", () => {
    render(<StudentDetailHeader student={buildStudentDetail()} />);

    expect(screen.getByRole("heading", { level: 2, name: STUDENT_NAME })).toBeInTheDocument();
    expect(tags().map((tag) => tag.textContent)).toEqual([
      "Ativa",
      "67 anos",
      "Acessibilidade: visual",
    ]);
  });

  it("translates the tags", async () => {
    await i18n.changeLanguage("en-US");
    render(<StudentDetailHeader student={buildStudentDetail({ age: 1 })} />);

    expect(tags().map((tag) => tag.textContent)).toEqual([
      "Active",
      "1 year old",
      "Accessibility: visual",
    ]);
  });

  it("has no tag of accessibility for the none category", () => {
    render(
      <StudentDetailHeader
        student={buildStudentDetail({ accessibilityNeed: AccessibilityNeed.none })}
      />,
    );

    expect(tags().map((tag) => tag.textContent)).toEqual(["Ativa", "67 anos"]);
  });

  it("shows the actions it receives, after the name, in the order they were given", () => {
    render(
      <StudentDetailHeader
        student={buildStudentDetail()}
        actions={
          <>
            <button type="button">Editar dados</button>
            <button type="button">Matricular em turma</button>
          </>
        }
      />,
    );

    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Editar dados",
      "Matricular em turma",
    ]);
    // Name block first, area of the actions second.
    expect(row().children).toHaveLength(2);
    expect(within(row().children[1] as HTMLElement).getAllByRole("button")).toHaveLength(2);
  });

  it("draws no area of actions when it receives none, so there is no empty box", () => {
    render(<StudentDetailHeader student={buildStudentDetail()} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(row().children).toHaveLength(1);
  });

  it("draws no area of actions when the actions are empty", () => {
    render(<StudentDetailHeader student={buildStudentDetail()} actions={null} />);

    expect(row().children).toHaveLength(1);
  });
});
