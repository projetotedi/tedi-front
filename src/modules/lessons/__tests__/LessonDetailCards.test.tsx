import { createRef } from "react";
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LessonStatus, type MeResponseDto } from "@api/generated/model";

import { LessonBreadcrumb } from "../components/LessonBreadcrumb";
import { LessonChangesCard } from "../components/LessonChangesCard";
import { LessonDataCard } from "../components/LessonDataCard";
import { LessonDetailHeader } from "../components/LessonDetailHeader";
import { LessonLinksCard } from "../components/LessonLinksCard";
import {
  buildCancelledLesson,
  buildLesson,
  buildMeUser,
  buildRescheduledLesson,
  buildStandaloneLesson,
  CLASS_ID,
  CLASS_NAME,
  COURSE_ID,
  COURSE_NAME,
  LESSON_PLAN_ID,
} from "./handlers";
import { renderWithProviders, setupLessonsTestServer } from "./test-utils";

setupLessonsTestServer();

const LESSON_TITLE = "Teclado, mouse e janelas";

const tags = () => screen.getAllByRole("listitem").map((tag) => tag.textContent);

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

/** A value the lesson does not have: a dash for who sees and "Não informado" for who hears. */
function expectDash(value: HTMLElement) {
  expect(within(value).getByText("—")).toHaveAttribute("aria-hidden", "true");
  expect(within(value).getByText("Não informado")).toHaveClass("sr-only");
}

/** The coordinator of the tests, with the scope of some of the permissions of the links taken away. */
function buildUserWithout(...denied: Array<"catalog.view" | "classes.view">): MeResponseDto {
  const user = buildMeUser();
  const permissions = { ...user.permissions };
  for (const permission of denied) permissions[permission] = "none";

  return { ...user, permissions };
}

describe("LessonDetailHeader", () => {
  it("shows the title of the lesson as a heading of level 2", async () => {
    await renderWithProviders(<LessonDetailHeader lesson={buildLesson()} />);

    expect(screen.getByRole("heading", { level: 2, name: LESSON_TITLE })).toBeInTheDocument();
  });

  it("shows the tags: status, class, course, day and time, duration and location, in this order", async () => {
    await renderWithProviders(<LessonDetailHeader lesson={buildLesson()} />);

    expect(tags()).toEqual([
      "Planejada",
      `Turma ${CLASS_NAME}`,
      COURSE_NAME,
      "10/03/2026 · 09:00–11:00",
      "2h de aula",
      "Laboratório 2 — Bloco B",
    ]);
  });

  it("leaves the location out for a lesson that has none, with no empty tag", async () => {
    await renderWithProviders(<LessonDetailHeader lesson={buildLesson({ location: null })} />);

    expect(tags()).toEqual([
      "Planejada",
      `Turma ${CLASS_NAME}`,
      COURSE_NAME,
      "10/03/2026 · 09:00–11:00",
      "2h de aula",
    ]);
  });

  it("names a class that has no name by its code", async () => {
    const lesson = buildLesson();
    await renderWithProviders(
      <LessonDetailHeader lesson={{ ...lesson, class: { ...lesson.class, name: null } }} />,
    );

    expect(tags()[1]).toBe("Turma INFO-A");
  });

  it.each([
    [LessonStatus.planned, "Planejada", "bg-tedi-neutral"],
    [LessonStatus.confirmed, "Confirmada", "bg-tedi-badge"],
    [LessonStatus.done, "Realizada", "bg-tedi-badge-success"],
    [LessonStatus.cancelled, "Cancelada", "bg-danger-soft"],
  ])(
    "tags a %s lesson as %s, with the tone of the other lesson screens",
    async (status, label, tone) => {
      await renderWithProviders(<LessonDetailHeader lesson={buildLesson({ status })} />);

      expect(tags()[0]).toBe(label);
      expect(screen.getByText(label)).toHaveClass(tone);
    },
  );

  it.each([
    [60, "1h de aula"],
    [90, "1h30 de aula"],
    [120, "2h de aula"],
    [45, "0h45 de aula"],
  ])("says a duration of %s minutes as %s", async (durationMinutes, label) => {
    await renderWithProviders(<LessonDetailHeader lesson={buildLesson({ durationMinutes })} />);

    expect(tags()[4]).toBe(label);
  });

  it("writes the day as the locale does, from the calendar date and not from a time zone", async () => {
    await renderWithProviders(<LessonDetailHeader lesson={buildLesson({ date: "2026-12-01" })} />);

    expect(tags()[3]).toBe("01/12/2026 · 09:00–11:00");
  });

  it("draws nothing on the right of the title without the actions prop", async () => {
    await renderWithProviders(<LessonDetailHeader lesson={buildLesson()} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(document.querySelector("[data-slot='card'] .flex-wrap.gap-3")).toBeNull();
  });

  it("draws the given actions on the right of the title, in one container, in the order they come", async () => {
    await renderWithProviders(
      <LessonDetailHeader
        lesson={buildLesson()}
        actions={
          <>
            <button type="button">Remarcar aula</button>
            <button type="button">Cancelar aula</button>
            <button type="button">Editar aula</button>
          </>
        }
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Remarcar aula",
      "Cancelar aula",
      "Editar aula",
    ]);
    expect(buttons[0].parentElement).toBe(buttons[2].parentElement);
    expect(buttons[0].parentElement).toHaveClass("flex", "flex-wrap", "gap-3");
    const title = screen.getByRole("heading", { level: 2, name: LESSON_TITLE });
    expect(
      title.compareDocumentPosition(buttons[0]) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("puts the actions beside the title from the medium width on, and under it on a phone", async () => {
    await renderWithProviders(
      <LessonDetailHeader
        lesson={buildLesson()}
        actions={<button type="button">Editar aula</button>}
      />,
    );

    const row = screen.getByRole("button", { name: "Editar aula" }).parentElement?.parentElement;
    expect(row).toHaveClass("flex-col", "md:flex-row", "md:justify-between");
  });
});

describe("LessonBreadcrumb", () => {
  it("is a navigation named Trilha de navegação, with two steps: Aulas and the lesson", async () => {
    await renderWithProviders(<LessonBreadcrumb lesson={buildLesson()} />);

    const trail = screen.getByRole("navigation", { name: "Trilha de navegação" });
    expect(within(trail).getAllByRole("listitem")).toHaveLength(2);
  });

  it("takes Aulas to the lessons, with a target of at least 44px", async () => {
    await renderWithProviders(<LessonBreadcrumb lesson={buildLesson()} />);

    const link = screen.getByRole("link", { name: "Aulas" });
    expect(link).toHaveAttribute("href", "/lessons");
    expect(link).toHaveClass("min-h-11");
  });

  it("says the lesson by its day and its title, as the current page and not as a link", async () => {
    await renderWithProviders(<LessonBreadcrumb lesson={buildLesson()} />);

    const current = screen.getByText(`10/03/2026 · ${LESSON_TITLE}`);
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current.closest("a")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("hides the separator from who listens", async () => {
    await renderWithProviders(<LessonBreadcrumb lesson={buildLesson()} />);

    expect(screen.getByText("›")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("LessonDataCard", () => {
  it("shows the thirteen fields of the card, in its order", async () => {
    await renderWithProviders(<LessonDataCard lesson={buildLesson()} />);

    expect(labelsOf(card("Dados da aula"))).toEqual([
      "Data",
      "Horário",
      "Duração",
      "Local",
      "Status",
      "Ordem no plano do curso",
      "Plano de aula (origem)",
      "Material",
      "Alunos esperados",
      "Monitores esperados",
      "Assunto",
      "Professor(a)",
      "Observações pós-aula",
    ]);
  });

  it("shows the values of a lesson that came from a plan", async () => {
    await renderWithProviders(<LessonDataCard lesson={buildLesson()} />);

    const data = card("Dados da aula");
    expect(valueOf(data, "Data")).toHaveTextContent(/^10\/03\/2026$/);
    expect(valueOf(data, "Horário")).toHaveTextContent(/^09:00–11:00$/);
    expect(valueOf(data, "Duração")).toHaveTextContent(/^2h$/);
    expect(valueOf(data, "Local")).toHaveTextContent(/^Laboratório 2 — Bloco B$/);
    expect(valueOf(data, "Status")).toHaveTextContent(/^Planejada$/);
    expect(valueOf(data, "Ordem no plano do curso")).toHaveTextContent(/^1ª aula da sequência$/);
    expect(valueOf(data, "Plano de aula (origem)")).toHaveTextContent(/^Teclado, mouse e janelas$/);
    expect(valueOf(data, "Alunos esperados")).toHaveTextContent(/^12$/);
    expect(valueOf(data, "Monitores esperados")).toHaveTextContent(/^2$/);
  });

  it.each([
    [LessonStatus.planned, "Planejada"],
    [LessonStatus.confirmed, "Confirmada"],
    [LessonStatus.done, "Realizada"],
    [LessonStatus.cancelled, "Cancelada"],
  ])("says the status %s as %s", async (status, label) => {
    await renderWithProviders(<LessonDataCard lesson={buildLesson({ status })} />);

    expect(valueOf(card("Dados da aula"), "Status")).toHaveTextContent(new RegExp(`^${label}$`));
  });

  it.each([
    [90, "1h30"],
    [60, "1h"],
    [150, "2h30"],
  ])("shows the duration the API calculated, %s minutes, as %s", async (durationMinutes, label) => {
    await renderWithProviders(<LessonDataCard lesson={buildLesson({ durationMinutes })} />);

    expect(valueOf(card("Dados da aula"), "Duração")).toHaveTextContent(new RegExp(`^${label}$`));
  });

  it.each([
    [1, "1ª aula da sequência"],
    [12, "12ª aula da sequência"],
  ])("says the position %s in the sequence as %s", async (sequenceOrder, label) => {
    await renderWithProviders(<LessonDataCard lesson={buildLesson({ sequenceOrder })} />);

    expect(valueOf(card("Dados da aula"), "Ordem no plano do curso")).toHaveTextContent(
      new RegExp(`^${label}$`),
    );
  });

  it("links the plan of origin to its screen", async () => {
    await renderWithProviders(<LessonDataCard lesson={buildLesson()} />);

    const link = within(valueOf(card("Dados da aula"), "Plano de aula (origem)")).getByRole(
      "link",
      { name: LESSON_TITLE },
    );
    expect(link).toHaveAttribute("href", `/lesson-plans/${LESSON_PLAN_ID}`);
    expect(link).toHaveClass("min-h-11");
  });

  it("shows a dash that a screen reader reads as Não informado for the material and the teacher", async () => {
    await renderWithProviders(<LessonDataCard lesson={buildLesson()} />);

    const data = card("Dados da aula");
    expectDash(valueOf(data, "Material"));
    expectDash(valueOf(data, "Professor(a)"));
  });

  it("shows a dash for every field the lesson does not have, and keeps the layout whole", async () => {
    await renderWithProviders(
      <LessonDataCard
        lesson={buildStandaloneLesson({
          location: null,
          expectedStudents: null,
          expectedMonitors: null,
          subject: null,
          postNotes: null,
        })}
      />,
    );

    const data = card("Dados da aula");
    for (const label of [
      "Local",
      "Ordem no plano do curso",
      "Material",
      "Alunos esperados",
      "Monitores esperados",
      "Assunto",
      "Professor(a)",
      "Observações pós-aula",
    ]) {
      expectDash(valueOf(data, label));
    }
    expect(labelsOf(data)).toHaveLength(13);
    expect(valueOf(data, "Data")).toHaveTextContent(/^10\/03\/2026$/);
  });

  it("shows zero as a value, not as a dash, for a lesson that expects nobody", async () => {
    await renderWithProviders(
      <LessonDataCard lesson={buildLesson({ expectedStudents: 0, expectedMonitors: 0 })} />,
    );

    const data = card("Dados da aula");
    expect(valueOf(data, "Alunos esperados")).toHaveTextContent(/^0$/);
    expect(valueOf(data, "Monitores esperados")).toHaveTextContent(/^0$/);
    expect(within(valueOf(data, "Alunos esperados")).queryByText("—")).not.toBeInTheDocument();
    expect(within(valueOf(data, "Monitores esperados")).queryByText("—")).not.toBeInTheDocument();
  });

  it("shows the subject and the post-lesson notes, which take a whole row each", async () => {
    await renderWithProviders(
      <LessonDataCard
        lesson={buildLesson({
          subject: "Atalhos de teclado",
          postNotes: "A turma gostou do exercício.",
        })}
      />,
    );

    const data = card("Dados da aula");
    const subject = valueOf(data, "Assunto");
    const notes = valueOf(data, "Observações pós-aula");
    expect(subject).toHaveTextContent(/^Atalhos de teclado$/);
    expect(notes).toHaveTextContent(/^A turma gostou do exercício\.$/);
    expect(subject.parentElement).toHaveClass("md:col-span-4");
    expect(notes.parentElement).toHaveClass("md:col-span-4");
  });

  it("says a lesson on its own has no plan, with no link", async () => {
    await renderWithProviders(<LessonDataCard lesson={buildStandaloneLesson()} />);

    const data = card("Dados da aula");
    expect(valueOf(data, "Plano de aula (origem)")).toHaveTextContent(
      /^Aula avulsa \(sem plano\)$/,
    );
    expect(within(data).queryByRole("link")).not.toBeInTheDocument();
    expectDash(valueOf(data, "Ordem no plano do curso"));
  });

  it("says the plan was archived, and keeps the link to it", async () => {
    await renderWithProviders(
      <LessonDataCard
        lesson={buildLesson({
          lessonPlan: {
            id: LESSON_PLAN_ID,
            title: LESSON_TITLE,
            archivedAt: "2026-04-01T12:00:00.000Z",
          },
        })}
      />,
    );

    const plan = valueOf(card("Dados da aula"), "Plano de aula (origem)");
    expect(plan).toHaveTextContent(/^Teclado, mouse e janelas · plano arquivado$/);
    expect(within(plan).getByRole("link", { name: LESSON_TITLE })).toHaveAttribute(
      "href",
      `/lesson-plans/${LESSON_PLAN_ID}`,
    );
  });

  it("shows the plan as text, with no link, for who cannot see the catalog", async () => {
    await renderWithProviders(<LessonDataCard lesson={buildLesson()} />, {
      user: buildUserWithout("catalog.view"),
    });

    const plan = valueOf(card("Dados da aula"), "Plano de aula (origem)");
    expect(plan).toHaveTextContent(/^Teclado, mouse e janelas$/);
    expect(within(plan).queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("LessonLinksCard", () => {
  it("shows class, course, edition and lesson plan, in this order", async () => {
    await renderWithProviders(<LessonLinksCard lesson={buildLesson()} />);

    expect(labelsOf(card("Vínculos"))).toEqual(["Turma", "Curso", "Edição", "Plano de aula"]);
  });

  it("links the class, the course and the plan to their screens", async () => {
    await renderWithProviders(<LessonLinksCard lesson={buildLesson()} />);

    const links = card("Vínculos");
    expect(within(valueOf(links, "Turma")).getByRole("link", { name: CLASS_NAME })).toHaveAttribute(
      "href",
      `/classes/${CLASS_ID}`,
    );
    expect(
      within(valueOf(links, "Curso")).getByRole("link", { name: COURSE_NAME }),
    ).toHaveAttribute("href", `/courses/${COURSE_ID}`);
    expect(
      within(valueOf(links, "Plano de aula")).getByRole("link", { name: LESSON_TITLE }),
    ).toHaveAttribute("href", `/lesson-plans/${LESSON_PLAN_ID}`);
  });

  it("shows the edition as text: there is no screen of an edition", async () => {
    await renderWithProviders(<LessonLinksCard lesson={buildLesson()} />);

    const edition = valueOf(card("Vínculos"), "Edição");
    expect(edition).toHaveTextContent(/^2026\.1$/);
    expect(within(edition).queryByRole("link")).not.toBeInTheDocument();
  });

  it("says the place of the plan in the sequence as item N, with no total", async () => {
    await renderWithProviders(<LessonLinksCard lesson={buildLesson({ sequenceOrder: 3 })} />);

    const plan = valueOf(card("Vínculos"), "Plano de aula");
    expect(plan).toHaveTextContent(/^Teclado, mouse e janelas · item 3$/);
    expect(plan.textContent).not.toMatch(/ de \d/);
  });

  it("shows only the plan, with no item, when the lesson has no position in the sequence", async () => {
    await renderWithProviders(<LessonLinksCard lesson={buildLesson({ sequenceOrder: null })} />);

    expect(valueOf(card("Vínculos"), "Plano de aula")).toHaveTextContent(
      /^Teclado, mouse e janelas$/,
    );
  });

  it("says a lesson on its own has no plan, with no link", async () => {
    await renderWithProviders(<LessonLinksCard lesson={buildStandaloneLesson()} />);

    const plan = valueOf(card("Vínculos"), "Plano de aula");
    expect(plan).toHaveTextContent(/^Aula avulsa \(sem plano\)$/);
    expect(within(plan).queryByRole("link")).not.toBeInTheDocument();
  });

  it("names a class that has no name by its code", async () => {
    const lesson = buildLesson();
    await renderWithProviders(
      <LessonLinksCard lesson={{ ...lesson, class: { ...lesson.class, name: null } }} />,
    );

    const turma = within(valueOf(card("Vínculos"), "Turma")).getByRole("link", {
      name: "INFO-A",
    });
    expect(turma).toHaveAttribute("href", `/classes/${CLASS_ID}`);
  });

  it("shows the names as text, with no link, for who cannot open the screens they lead to", async () => {
    await renderWithProviders(<LessonLinksCard lesson={buildLesson()} />, {
      user: buildUserWithout("catalog.view", "classes.view"),
    });

    const links = card("Vínculos");
    expect(within(links).queryByRole("link")).not.toBeInTheDocument();
    expect(valueOf(links, "Turma")).toHaveTextContent(new RegExp(`^${CLASS_NAME}$`));
    expect(valueOf(links, "Curso")).toHaveTextContent(new RegExp(`^${COURSE_NAME}$`));
    expect(valueOf(links, "Plano de aula")).toHaveTextContent(
      /^Teclado, mouse e janelas · item 1$/,
    );
  });

  it("keeps each link for the permission of its own screen", async () => {
    await renderWithProviders(<LessonLinksCard lesson={buildLesson()} />, {
      user: buildUserWithout("catalog.view"),
    });

    const links = card("Vínculos");
    expect(
      within(links)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual([CLASS_NAME]);
  });
});

describe("LessonChangesCard", () => {
  it("draws nothing for a lesson that was never rescheduled nor cancelled", async () => {
    const { container } = await renderWithProviders(<LessonChangesCard lesson={buildLesson()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it.each([LessonStatus.confirmed, LessonStatus.done])(
    "draws nothing for a %s lesson that has no original date",
    async (status) => {
      const { container } = await renderWithProviders(
        <LessonChangesCard lesson={buildLesson({ status })} />,
      );

      expect(container).toBeEmptyDOMElement();
    },
  );

  it("titles a rescheduled lesson Remarcação and shows the original date, the reason and the note", async () => {
    await renderWithProviders(<LessonChangesCard lesson={buildRescheduledLesson()} />);

    const changes = card("Remarcação");
    expect(labelsOf(changes)).toEqual([
      "Data original",
      "Motivo da remarcação",
      "Observação da remarcação",
    ]);
    expect(valueOf(changes, "Data original")).toHaveTextContent(/^03\/03\/2026$/);
    expect(valueOf(changes, "Motivo da remarcação")).toHaveTextContent(/^Sala indisponível$/);
    expect(valueOf(changes, "Observação da remarcação")).toHaveTextContent(
      /^A sala foi usada para a prova\.$/,
    );
  });

  it("shows a dash for the reason and the note of a reschedule that gave none", async () => {
    await renderWithProviders(
      <LessonChangesCard
        lesson={buildRescheduledLesson({ rescheduleReason: null, rescheduleNote: null })}
      />,
    );

    const changes = card("Remarcação");
    expect(valueOf(changes, "Data original")).toHaveTextContent(/^03\/03\/2026$/);
    expectDash(valueOf(changes, "Motivo da remarcação"));
    expectDash(valueOf(changes, "Observação da remarcação"));
  });

  it("titles a cancelled lesson Cancelamento and shows the reason, with nothing about rescheduling", async () => {
    await renderWithProviders(<LessonChangesCard lesson={buildCancelledLesson()} />);

    const changes = card("Cancelamento");
    expect(labelsOf(changes)).toEqual(["Motivo do cancelamento"]);
    expect(valueOf(changes, "Motivo do cancelamento")).toHaveTextContent(/^Feriado municipal\.$/);
    expect(screen.queryByText("Data original")).not.toBeInTheDocument();
  });

  it("titles a lesson that was rescheduled and then cancelled Remarcação e cancelamento and shows both", async () => {
    await renderWithProviders(
      <LessonChangesCard
        lesson={buildCancelledLesson({
          originalDate: "2026-03-03",
          rescheduleReason: "Sala indisponível",
          rescheduleNote: null,
        })}
      />,
    );

    const changes = card("Remarcação e cancelamento");
    expect(labelsOf(changes)).toEqual([
      "Data original",
      "Motivo da remarcação",
      "Observação da remarcação",
      "Motivo do cancelamento",
    ]);
    expect(valueOf(changes, "Data original")).toHaveTextContent(/^03\/03\/2026$/);
    expect(valueOf(changes, "Motivo da remarcação")).toHaveTextContent(/^Sala indisponível$/);
    expectDash(valueOf(changes, "Observação da remarcação"));
    expect(valueOf(changes, "Motivo do cancelamento")).toHaveTextContent(/^Feriado municipal\.$/);
  });

  it("is a region named by its title, which the screen can focus and Tab does not stop at", async () => {
    const focusRef = createRef<HTMLDivElement>();
    await renderWithProviders(
      <LessonChangesCard lesson={buildCancelledLesson()} focusRef={focusRef} />,
    );

    const region = screen.getByRole("region", { name: "Cancelamento" });
    expect(focusRef.current).toBe(region);
    expect(region).toHaveAttribute("tabindex", "-1");

    region.focus();

    expect(region).toHaveFocus();
  });
});
