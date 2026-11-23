import { useState, type ReactElement } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LessonStatus } from "@api/generated/model";

import {
  LessonFilters,
  type LessonFilterField,
  type LessonFiltersProps,
} from "../components/LessonFilters";
import type { LessonFilterValues } from "../lib/lesson-filters";
import {
  buildClassListItem,
  buildCourseListItem,
  buildLessonPlanListItem,
  buildOtherClassListItem,
  CLASS_NAME,
  COURSE_ID,
  COURSE_NAME,
  LESSON_PLAN_ID,
  OTHER_CLASS_ID,
  OTHER_CLASS_NAME,
} from "./handlers";
import { renderWithProviders, setupLessonsTestServer } from "./test-utils";

setupLessonsTestServer();

const NO_FILTERS: LessonFilterValues = {
  search: "",
  classId: "",
  courseId: "",
  status: "",
  lessonPlanId: "",
  from: "",
  to: "",
  page: 1,
};

const OPTIONS: LessonFiltersProps["options"] = {
  classes: [buildClassListItem(), buildOtherClassListItem()],
  courses: [buildCourseListItem()],
  lessonPlans: [buildLessonPlanListItem()],
};

const ALL_FIELDS: LessonFilterField[] = [
  "search",
  "classId",
  "courseId",
  "status",
  "lessonPlanId",
  "period",
];

interface HostProps {
  fields?: readonly LessonFilterField[];
  filters?: Partial<LessonFilterValues>;
  options?: LessonFiltersProps["options"];
  onFilterChange?: LessonFiltersProps["onFilterChange"];
  onPeriodChange?: LessonFiltersProps["onPeriodChange"];
  onSearchChange?: (value: string) => void;
}

/** Holds what the URL would hold, so a test can change it from the outside, like Voltar does. */
function Host({
  fields = ALL_FIELDS,
  filters = {},
  options = OPTIONS,
  onFilterChange = () => {},
  onPeriodChange = () => {},
  onSearchChange = () => {},
}: HostProps): ReactElement {
  const [current, setCurrent] = useState<LessonFilterValues>({ ...NO_FILTERS, ...filters });

  return (
    <>
      <LessonFilters
        fields={fields}
        search={current.search}
        onSearchChange={onSearchChange}
        filters={current}
        options={options}
        onFilterChange={onFilterChange}
        onPeriodChange={onPeriodChange}
      />
      <button
        type="button"
        onClick={() => setCurrent({ ...NO_FILTERS, from: "2026-05-04", to: "2026-05-29" })}
      >
        Outro período
      </button>
    </>
  );
}

const trigger = (name: RegExp) => screen.getByRole("button", { name });
const periodGroup = () => screen.getByRole("group", { name: "Período" });
const dateGroup = (name: string) => within(periodGroup()).getByRole("group", { name });
const segments = (name: string) => within(dateGroup(name)).getAllByRole("spinbutton");
const valuesOf = (name: string) =>
  segments(name).map((segment) => segment.getAttribute("aria-valuenow"));

async function type(user: ReturnType<typeof userEvent.setup>, name: string, digits: string) {
  await user.click(segments(name)[0]);
  await user.keyboard(digits);
}

describe("LessonFilters", () => {
  it("shows only the fields asked for", async () => {
    await renderWithProviders(<Host fields={["classId", "status"]} />);

    expect(trigger(/^Turma/)).toBeInTheDocument();
    expect(trigger(/^Status/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Curso/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Plano de aula/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Período" })).not.toBeInTheDocument();
  });

  it("shows every field, in the order asked, with the name and the value in each trigger", async () => {
    await renderWithProviders(<Host />);

    expect(screen.getByRole("textbox", { name: "Buscar aula por conteúdo" })).toBeInTheDocument();
    expect(trigger(/^Turma/)).toHaveTextContent("Turma: todas");
    expect(trigger(/^Curso/)).toHaveTextContent("Curso: todos");
    expect(trigger(/^Status/)).toHaveTextContent("Status: todos");
    expect(trigger(/^Plano de aula/)).toHaveTextContent("Plano de aula: todos");
    expect(dateGroup("De")).toBeInTheDocument();
    expect(dateGroup("Até")).toBeInTheDocument();

    const order = [
      screen.getByRole("textbox", { name: "Buscar aula por conteúdo" }),
      trigger(/^Turma/),
      trigger(/^Curso/),
      trigger(/^Status/),
      trigger(/^Plano de aula/),
      periodGroup(),
    ];
    for (let index = 1; index < order.length; index += 1) {
      expect(
        order[index - 1].compareDocumentPosition(order[index]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("asks for the order the screen gave, not a fixed one", async () => {
    await renderWithProviders(<Host fields={["status", "classId"]} />);

    expect(
      trigger(/^Status/).compareDocumentPosition(trigger(/^Turma/)) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("types in the search box through onSearchChange", async () => {
    const onSearchChange = vi.fn();
    const user = userEvent.setup();
    await renderWithProviders(<Host fields={["search"]} onSearchChange={onSearchChange} />);

    await user.type(screen.getByRole("textbox", { name: "Buscar aula por conteúdo" }), "a");

    expect(onSearchChange).toHaveBeenCalledWith("a");
    expect(screen.getByPlaceholderText("Buscar por conteúdo...")).toBeInTheDocument();
  });

  it("offers every class by name and tells the choice by its key", async () => {
    const onFilterChange = vi.fn();
    const user = userEvent.setup();
    await renderWithProviders(<Host fields={["classId"]} onFilterChange={onFilterChange} />);

    await user.click(trigger(/^Turma/));
    expect(await screen.findByRole("option", { name: "Todas" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: CLASS_NAME })).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: OTHER_CLASS_NAME }));

    expect(onFilterChange).toHaveBeenCalledExactlyOnceWith("classId", OTHER_CLASS_ID);
  });

  it("offers the four statuses and the course and the plan by name", async () => {
    const onFilterChange = vi.fn();
    const user = userEvent.setup();
    await renderWithProviders(
      <Host fields={["status", "courseId", "lessonPlanId"]} onFilterChange={onFilterChange} />,
    );

    await user.click(trigger(/^Status/));
    for (const name of ["Planejada", "Confirmada", "Realizada", "Cancelada"]) {
      expect(await screen.findByRole("option", { name })).toBeInTheDocument();
    }
    await user.click(screen.getByRole("option", { name: "Realizada" }));
    expect(onFilterChange).toHaveBeenLastCalledWith("status", LessonStatus.done);

    await user.click(trigger(/^Curso/));
    await user.click(await screen.findByRole("option", { name: COURSE_NAME }));
    expect(onFilterChange).toHaveBeenLastCalledWith("courseId", COURSE_ID);

    await user.click(trigger(/^Plano de aula/));
    await user.click(await screen.findByRole("option", { name: "Teclado, mouse e janelas" }));
    expect(onFilterChange).toHaveBeenLastCalledWith("lessonPlanId", LESSON_PLAN_ID);
  });

  it("shows the class of the URL by its name once the page lists it", async () => {
    await renderWithProviders(<Host fields={["classId"]} filters={{ classId: OTHER_CLASS_ID }} />);

    expect(trigger(/^Turma/)).toHaveTextContent(`Turma: ${OTHER_CLASS_NAME}`);
  });

  it("an unknown classId gets the option Turma selecionada", async () => {
    const user = userEvent.setup();
    await renderWithProviders(
      <Host
        fields={["classId"]}
        filters={{ classId: OTHER_CLASS_ID }}
        options={{ ...OPTIONS, classes: [] }}
      />,
    );

    expect(trigger(/^Turma/)).toHaveTextContent("Turma: Turma selecionada");
    await user.click(trigger(/^Turma/));
    expect(await screen.findByRole("option", { name: "Turma selecionada" })).toBeInTheDocument();
  });

  it("an unknown lessonPlanId gets the option Plano selecionado", async () => {
    await renderWithProviders(
      <Host
        fields={["lessonPlanId"]}
        filters={{ lessonPlanId: "01952ef7-0000-7000-8000-0000000000a9" }}
      />,
    );

    expect(trigger(/^Plano de aula/)).toHaveTextContent("Plano de aula: Plano selecionado");
  });

  describe("period", () => {
    it("fills the two dates from the URL", async () => {
      await renderWithProviders(
        <Host fields={["period"]} filters={{ from: "2026-03-02", to: "2026-03-31" }} />,
      );

      expect(valuesOf("De")).toEqual(["2", "3", "2026"]);
      expect(valuesOf("Até")).toEqual(["31", "3", "2026"]);
    });

    it("gives the period when the two dates make one", async () => {
      const onPeriodChange = vi.fn();
      const user = userEvent.setup();
      await renderWithProviders(<Host fields={["period"]} onPeriodChange={onPeriodChange} />);

      await type(user, "De", "02032026");
      await waitFor(() => expect(onPeriodChange).toHaveBeenLastCalledWith("2026-03-02", ""));
      await type(user, "Até", "31032026");

      await waitFor(() =>
        expect(onPeriodChange).toHaveBeenLastCalledWith("2026-03-02", "2026-03-31"),
      );
    });

    it("an inverted period shows the error on Até and keeps the URL", async () => {
      const onPeriodChange = vi.fn();
      const user = userEvent.setup();
      await renderWithProviders(
        <Host
          fields={["period"]}
          filters={{ from: "2026-03-10", to: "2026-03-20" }}
          onPeriodChange={onPeriodChange}
        />,
      );

      await type(user, "Até", "05032026");

      expect(
        await within(periodGroup()).findByText(
          "A data final precisa ser igual ou depois da data inicial.",
        ),
      ).toBeInTheDocument();
      expect(onPeriodChange).not.toHaveBeenCalled();
      expect(valuesOf("Até")).toEqual(["5", "3", "2026"]);
    });

    it("takes the error away and gives the period when the end is fixed", async () => {
      const onPeriodChange = vi.fn();
      const user = userEvent.setup();
      await renderWithProviders(
        <Host
          fields={["period"]}
          filters={{ from: "2026-03-10", to: "2026-03-20" }}
          onPeriodChange={onPeriodChange}
        />,
      );
      await type(user, "Até", "05032026");
      await within(periodGroup()).findByText(/A data final precisa/);

      await type(user, "Até", "25032026");

      await waitFor(() =>
        expect(onPeriodChange).toHaveBeenLastCalledWith("2026-03-10", "2026-03-25"),
      );
      expect(within(periodGroup()).queryByText(/A data final precisa/)).not.toBeInTheDocument();
    });

    it("a one-day period is a period", async () => {
      const onPeriodChange = vi.fn();
      const user = userEvent.setup();
      await renderWithProviders(
        <Host
          fields={["period"]}
          filters={{ from: "2026-03-10" }}
          onPeriodChange={onPeriodChange}
        />,
      );

      await type(user, "Até", "10032026");

      await waitFor(() =>
        expect(onPeriodChange).toHaveBeenLastCalledWith("2026-03-10", "2026-03-10"),
      );
      expect(within(periodGroup()).queryByText(/A data final precisa/)).not.toBeInTheDocument();
    });

    it("follows the URL when it brings another period, as Voltar and Limpar filtros do", async () => {
      const user = userEvent.setup();
      await renderWithProviders(
        <Host fields={["period"]} filters={{ from: "2026-03-02", to: "2026-03-31" }} />,
      );

      await user.click(screen.getByRole("button", { name: "Outro período" }));

      expect(valuesOf("De")).toEqual(["4", "5", "2026"]);
      expect(valuesOf("Até")).toEqual(["29", "5", "2026"]);
    });
  });
});
