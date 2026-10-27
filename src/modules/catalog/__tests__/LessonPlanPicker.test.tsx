import { useState } from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LessonPlanPicker } from "../components/LessonPlanPicker";
import { toSequenceItems, type SequenceItem } from "../lib/course-sequence";
import { MOCK_LESSON_PLANS } from "../mocks/lesson-plans.mock";
import { buildCourseSequence, buildMockSequenceItem, COURSE_ID } from "./handlers";
import { renderWithProviders, setupCatalogTestServer } from "./test-utils";

const optionsOverride = vi.hoisted(() => ({
  current: null as { isPending: boolean; isError: boolean } | null,
}));

// The real hook reads the mock catalog and never loads or fails. The states of the future API
// (GUS-95) are forced here, so that the picker is known to handle them before the swap.
vi.mock("../hooks/useLessonPlanOptions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hooks/useLessonPlanOptions")>();

  return {
    ...actual,
    useLessonPlanOptions: (courseId: string) =>
      optionsOverride.current
        ? { options: [], ...optionsOverride.current }
        : actual.useLessonPlanOptions(courseId),
  };
});

setupCatalogTestServer();

const SEQUENCE = toSequenceItems(buildCourseSequence());
const ALL_OPTIONS = MOCK_LESSON_PLANS.filter((plan) => plan.usage !== "archived").map(
  (plan) => toSequenceItems(buildCourseSequence([buildMockSequenceItem(plan.id)]))[0],
);

interface HarnessProps {
  saved?: SequenceItem[];
  initialDraft?: SequenceItem[];
  isAtLimit?: boolean;
  onAdd?: (item: SequenceItem) => void;
}

function Harness({ saved = SEQUENCE, initialDraft = SEQUENCE, isAtLimit, onAdd }: HarnessProps) {
  const [draft, setDraft] = useState(initialDraft);

  return (
    <LessonPlanPicker
      courseId={COURSE_ID}
      saved={saved}
      draft={draft}
      isAtLimit={isAtLimit ?? false}
      onAdd={(item) => {
        setDraft((current) => [...current, item]);
        onAdd?.(item);
      }}
    />
  );
}

const trigger = () => screen.getByRole("button", { name: /Adicionar plano de aula/ });
const addButton = () => screen.getByRole("button", { name: "Adicionar" });

async function openOptions(user: ReturnType<typeof userEvent.setup>) {
  await user.click(trigger());
  return screen.findAllByRole("option");
}

const names = (options: HTMLElement[]) => options.map((option) => option.textContent);

describe("LessonPlanPicker", () => {
  it("offers the plans of the catalog with the title and the duration, by title", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<Harness saved={[]} initialDraft={[]} />);

    const options = names(await openOptions(user));

    expect(options).toHaveLength(ALL_OPTIONS.length);
    expect(options).toContain("Fotos no celular · 1h30");
    expect(options).toContain("Conhecendo o computador · 2h");
    expect(options).toEqual([...options].sort((a, b) => a!.localeCompare(b!, "pt-BR")));
  });

  it("does not offer plans already in the sequence", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<Harness />);

    const options = names(await openOptions(user));

    for (const inSequence of [
      "Enviar um áudio no WhatsApp · 1h30",
      "Senhas e privacidade · 1h30",
      "Reconhecendo golpes · 2h30",
    ]) {
      expect(options).not.toContain(inSequence);
    }
    expect(options).toContain("Fotos no celular · 1h30");
  });

  it("does not offer archived plans", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<Harness saved={[]} initialDraft={[]} />);

    const options = names(await openOptions(user));

    expect(options.some((option) => option?.startsWith("Noções de segurança digital"))).toBe(false);
  });

  it("does not offer a plan of the saved sequence that was archived since", async () => {
    const user = userEvent.setup();
    const archived = toSequenceItems(
      buildCourseSequence([
        buildMockSequenceItem("lesson-plan-08", { archivedAt: "2026-10-10T13:00:00.000Z" }),
      ]),
    );
    await renderWithProviders(<Harness saved={archived} initialDraft={[]} />);

    const options = names(await openOptions(user));

    expect(options.some((option) => option?.startsWith("Organizando arquivos"))).toBe(false);
  });

  it("offers again a saved plan that was taken out of the draft", async () => {
    const user = userEvent.setup();
    const withoutFirst = SEQUENCE.slice(1);
    await renderWithProviders(<Harness initialDraft={withoutFirst} />);

    const options = names(await openOptions(user));

    // "Conhecendo o WhatsApp" is not in the mock catalog: it comes from the saved sequence.
    expect(options).toContain("Conhecendo o WhatsApp · 1h30");
  });

  it("adds the chosen plan and clears the choice", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    await renderWithProviders(<Harness onAdd={onAdd} />);

    await openOptions(user);
    await user.click(screen.getByRole("option", { name: "Fotos no celular · 1h30" }));
    expect(trigger()).toHaveTextContent("Fotos no celular · 1h30");
    await user.click(addButton());

    expect(onAdd).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        lessonPlanId: "lesson-plan-07",
        title: "Fotos no celular",
        expectedDurationMinutes: 90,
      }),
    );
    expect(trigger()).toHaveTextContent("Escolha um plano de aula");
    expect(trigger()).not.toHaveTextContent("Fotos no celular");
    expect(addButton()).toHaveFocus();
  });

  it("takes the added plan out of the options", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<Harness />);

    await openOptions(user);
    await user.click(screen.getByRole("option", { name: "Fotos no celular · 1h30" }));
    await user.click(addButton());
    const options = names(await openOptions(user));

    expect(options).not.toContain("Fotos no celular · 1h30");
  });

  it("Adicionar without a choice shows the error of the field and adds nothing", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    await renderWithProviders(<Harness onAdd={onAdd} />);

    await user.click(addButton());

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByText("Escolha um plano de aula para adicionar.")).toBeInTheDocument();
    expect(trigger()).toHaveAccessibleDescription("Escolha um plano de aula para adicionar.");
    expect(addButton()).toBeEnabled();
    expect(addButton()).toHaveFocus();
  });

  it("clears the error when a plan is chosen", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<Harness />);

    await user.click(addButton());
    await openOptions(user);
    await user.click(screen.getByRole("option", { name: "Fotos no celular · 1h30" }));

    expect(screen.queryByText("Escolha um plano de aula para adicionar.")).not.toBeInTheDocument();
  });

  it("disables the select and says why when every plan is already in the sequence", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    await renderWithProviders(<Harness saved={[]} initialDraft={ALL_OPTIONS} onAdd={onAdd} />);

    expect(trigger()).toBeDisabled();
    expect(
      screen.getByText("Todos os planos de aula do catálogo já estão na sequência."),
    ).toBeInTheDocument();

    await user.click(addButton());

    expect(onAdd).not.toHaveBeenCalled();
    expect(
      screen.getAllByText("Todos os planos de aula do catálogo já estão na sequência."),
    ).toHaveLength(1);
  });

  it("disables Adicionar at the limit of the sequence and shows the limit", async () => {
    await renderWithProviders(<Harness isAtLimit />);

    expect(addButton()).toBeDisabled();
    expect(
      screen.getByText("A sequência pode ter no máximo 100 planos de aula."),
    ).toBeInTheDocument();
  });

  it("shows no limit text below the limit", async () => {
    await renderWithProviders(<Harness />);

    expect(screen.queryByText(/no máximo 100/)).not.toBeInTheDocument();
    expect(addButton()).toBeEnabled();
  });

  it("makes both controls 44px targets", async () => {
    await renderWithProviders(<Harness />);

    expect(addButton()).toHaveClass("min-h-11");
    expect(trigger()).toHaveClass("min-h-11");
  });

  describe("when the options come from the API", () => {
    it("disables the select while the options load", async () => {
      optionsOverride.current = { isPending: true, isError: false };
      try {
        await renderWithProviders(<Harness />);

        expect(trigger()).toBeDisabled();
        expect(screen.queryByText(/já estão na sequência/)).not.toBeInTheDocument();
      } finally {
        optionsOverride.current = null;
      }
    });

    it("disables the select and shows an error when the options fail", async () => {
      optionsOverride.current = { isPending: false, isError: true };
      try {
        await renderWithProviders(<Harness />);

        expect(trigger()).toBeDisabled();
        expect(
          within(document.body).getByText(
            "Não foi possível carregar os planos de aula do catálogo. Tente de novo mais tarde.",
          ),
        ).toBeInTheDocument();
      } finally {
        optionsOverride.current = null;
      }
    });
  });
});
