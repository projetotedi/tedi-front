import { useState } from "react";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CourseCategory, CourseStatus, type ClassCourseResponseDto } from "@api/generated/model";

import { CourseOriginCard } from "../components/CourseOriginCard";
import {
  buildCourseClassesPage,
  buildCourseClassItem,
  buildCourseDetail,
  COURSE_ID,
  getCourseHandler,
  listCourseClassesHandler,
  PREREQUISITE_COURSE,
  type CourseCall,
  type ListCourseClassesCall,
} from "./handlers";
import { createDeferred, renderWithProviders, server, setupClassesTestServer } from "./test-utils";

setupClassesTestServer();

function buildCourse(overrides: Partial<ClassCourseResponseDto> = {}): ClassCourseResponseDto {
  return {
    id: COURSE_ID,
    name: "Informática Básica",
    category: CourseCategory.basic,
    status: CourseStatus.active,
    ...overrides,
  };
}

interface RenderOptions {
  course?: ClassCourseResponseDto;
  isClassArchived?: boolean;
}

async function renderCard({ course = buildCourse(), isClassArchived = false }: RenderOptions = {}) {
  return renderWithProviders(
    <CourseOriginCard isClassArchived={isClassArchived} course={course} />,
  );
}

/** The card (the root with `data-slot="card"`) titled "Curso de origem". */
function card(): HTMLElement {
  const root = screen
    .getByRole("heading", { name: "Curso de origem" })
    .closest("[data-slot='card']");
  if (!(root instanceof HTMLElement)) throw new Error('No card titled "Curso de origem"');
  return root;
}

/** The value (`<dd>`) of the field `label` (`<dt>`) of the card. */
function valueOf(label: string): HTMLElement {
  const value = within(card()).getByText(label, { selector: "dt" }).nextElementSibling;
  if (!(value instanceof HTMLElement)) throw new Error(`No value for "${label}"`);
  return value;
}

/** A page of classes whose total is `total`: only the total is read by the card. */
const classesTotal = (total: number) =>
  listCourseClassesHandler({ response: buildCourseClassesPage([buildCourseClassItem()], total) });

/** Waits for the three fields that come from the API to be on the card. */
const loaded = () => screen.findByText("Planos de aula", { selector: "dt" });

describe("CourseOriginCard", () => {
  describe("with the course loaded", () => {
    it("shows the course, its prerequisites, its lesson plans and its other classes", async () => {
      server.use(
        getCourseHandler({
          response: buildCourseDetail({
            prerequisites: [
              {
                ...PREREQUISITE_COURSE,
                category: CourseCategory.basic,
                status: CourseStatus.active,
              },
            ],
            lessonPlanCount: 6,
          }),
        }),
        classesTotal(4),
      );
      await renderCard();
      await loaded();

      expect(within(card()).getByRole("heading", { name: "Curso de origem" })).toBeInTheDocument();
      expect(valueOf("Curso")).toHaveTextContent("Informática Básica");
      expect(valueOf("Curso")).toHaveTextContent("Básico");
      expect(valueOf("Pré-requisitos")).toHaveTextContent("Smartphones no dia a dia");
      expect(valueOf("Planos de aula")).toHaveTextContent("6 planos de aula");
      expect(valueOf("Outras turmas")).toHaveTextContent("3 turmas");
    });

    it("asks the API once for the course and once, for a single class, for its classes", async () => {
      const onCourse = vi.fn<(call: CourseCall) => void>();
      const onClasses = vi.fn<(call: ListCourseClassesCall) => void>();
      server.use(
        getCourseHandler({ onCall: onCourse }),
        listCourseClassesHandler({ onCall: onClasses }),
      );
      await renderCard();
      await loaded();

      expect(onCourse).toHaveBeenCalledExactlyOnceWith({ id: COURSE_ID });
      expect(onClasses).toHaveBeenCalledExactlyOnceWith({
        id: COURSE_ID,
        page: null,
        limit: 1,
        status: null,
      });
    });

    it.each([
      [4, false, "3 turmas"],
      [4, true, "4 turmas"],
      [2, false, "1 turma"],
      [1, false, "Nenhuma"],
      [0, true, "Nenhuma"],
    ])(
      "with %i classes in the course (archived class: %s), the other classes are %s",
      async (total, isClassArchived, text) => {
        server.use(getCourseHandler(), classesTotal(total));
        await renderCard({ isClassArchived });
        await loaded();

        expect(valueOf("Outras turmas")).toHaveTextContent(new RegExp(`^${text}$`));
      },
    );

    it("says Nenhum when the course has no prerequisite", async () => {
      server.use(
        getCourseHandler({ response: buildCourseDetail({ prerequisites: [] }) }),
        classesTotal(1),
      );
      await renderCard();
      await loaded();

      expect(valueOf("Pré-requisitos")).toHaveTextContent(/^Nenhum$/);
    });

    it("lists several prerequisites, separated by commas", async () => {
      server.use(
        getCourseHandler({
          response: buildCourseDetail({
            prerequisites: [
              {
                ...PREREQUISITE_COURSE,
                category: CourseCategory.basic,
                status: CourseStatus.active,
              },
              {
                id: "01952ef7-0000-7000-8000-0000000000c3",
                name: "Internet",
                category: CourseCategory.basic,
                status: CourseStatus.archived,
              },
            ],
          }),
        }),
        classesTotal(1),
      );
      await renderCard();
      await loaded();

      expect(valueOf("Pré-requisitos")).toHaveTextContent(/^Smartphones no dia a dia, Internet$/);
    });

    it.each([
      [0, "Nenhum plano de aula"],
      [1, "1 plano de aula"],
      [6, "6 planos de aula"],
    ])("writes %i lesson plans as %s", async (count, text) => {
      server.use(
        getCourseHandler({ response: buildCourseDetail({ lessonPlanCount: count }) }),
        classesTotal(1),
      );
      await renderCard();
      await loaded();

      expect(valueOf("Planos de aula")).toHaveTextContent(new RegExp(`^${text}$`));
    });
  });

  describe("what the class brings with it", () => {
    it("tags an archived course as Arquivado", async () => {
      server.use(getCourseHandler(), classesTotal(1));
      await renderCard({ course: buildCourse({ status: CourseStatus.archived }) });

      expect(within(valueOf("Curso")).getByText("Arquivado")).toBeInTheDocument();
    });

    it("has no Arquivado tag for an active course", async () => {
      server.use(getCourseHandler(), classesTotal(1));
      await renderCard();
      await loaded();

      expect(within(card()).queryByText("Arquivado")).not.toBeInTheDocument();
    });

    it.each([
      [CourseCategory.basic, "Básico"],
      [CourseCategory.intermediate, "Intermediário"],
      [CourseCategory.advanced, "Avançado"],
    ])("shows the %s category of the course as %s", async (category, label) => {
      server.use(getCourseHandler(), classesTotal(1));
      await renderCard({ course: buildCourse({ category }) });

      expect(within(valueOf("Curso")).getByText(label)).toBeInTheDocument();
    });

    it("follows the category of the course when it changes: the level is never kept apart", async () => {
      const user = userEvent.setup();
      server.use(getCourseHandler(), classesTotal(1));

      function CategorySwitch() {
        const [category, setCategory] = useState<CourseCategory>(CourseCategory.basic);

        return (
          <>
            <button type="button" onClick={() => setCategory(CourseCategory.advanced)}>
              Mudar a categoria do curso
            </button>
            <CourseOriginCard isClassArchived={false} course={buildCourse({ category })} />
          </>
        );
      }
      await renderWithProviders(<CategorySwitch />);
      await loaded();
      expect(within(valueOf("Curso")).getByText("Básico")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Mudar a categoria do curso" }));

      expect(within(valueOf("Curso")).getByText("Avançado")).toBeInTheDocument();
      expect(within(valueOf("Curso")).queryByText("Básico")).not.toBeInTheDocument();
    });
  });

  describe("Abrir curso ›", () => {
    it("opens the course, and its name tells which one", async () => {
      server.use(getCourseHandler(), classesTotal(1));
      await renderCard();

      const link = screen.getByRole("link", { name: "Abrir curso Informática Básica" });

      expect(link).toHaveAttribute("href", `/courses/${COURSE_ID}`);
      expect(link).toHaveTextContent("Abrir curso");
      expect(within(link).getByText("›")).toHaveAttribute("aria-hidden", "true");
      expect(link).toHaveClass("min-h-11");
      await loaded();
    });

    it("goes to the course screen when it is pressed", async () => {
      const user = userEvent.setup();
      server.use(getCourseHandler(), classesTotal(1));
      const { router } = await renderCard();
      await loaded();

      await user.click(screen.getByRole("link", { name: "Abrir curso Informática Básica" }));

      await waitFor(() => expect(router.state.location.pathname).toBe(`/courses/${COURSE_ID}`));
    });
  });

  describe("while the data is on its way", () => {
    it("shows a loading state, and the name, the level and the link are already there", async () => {
      const deferred = createDeferred();
      server.use(getCourseHandler({ delay: deferred.promise }), classesTotal(1));
      await renderCard();

      expect(await screen.findByRole("status")).toHaveTextContent("Carregando os dados do curso…");
      expect(valueOf("Curso")).toHaveTextContent("Informática Básica");
      expect(screen.getByRole("link", { name: "Abrir curso Informática Básica" })).toBeVisible();
      expect(
        within(card()).queryByText("Planos de aula", { selector: "dt" }),
      ).not.toBeInTheDocument();

      deferred.resolve();
      await loaded();

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  describe("when the data cannot be loaded", () => {
    it("shows the error and keeps the name, the level and the link of the course", async () => {
      server.use(getCourseHandler({ networkError: true }), classesTotal(1));
      await renderCard({ course: buildCourse({ category: CourseCategory.intermediate }) });

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar os dados do curso.",
      );
      expect(valueOf("Curso")).toHaveTextContent("Informática Básica");
      expect(valueOf("Curso")).toHaveTextContent("Intermediário");
      expect(screen.getByRole("link", { name: "Abrir curso Informática Básica" })).toBeVisible();
      expect(
        within(card()).queryByText("Planos de aula", { selector: "dt" }),
      ).not.toBeInTheDocument();
    });

    it("shows the error when only the classes fail, and no half of the data", async () => {
      server.use(getCourseHandler(), listCourseClassesHandler({ networkError: true }));
      await renderCard();

      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(
        within(card()).queryByText("Pré-requisitos", { selector: "dt" }),
      ).not.toBeInTheDocument();
    });

    it("tries again with Tentar de novo, and asks again only for what failed", async () => {
      const user = userEvent.setup();
      const onCourse = vi.fn<(call: CourseCall) => void>();
      const onClasses = vi.fn<(call: ListCourseClassesCall) => void>();
      server.use(
        getCourseHandler({ networkError: true, onCall: onCourse }),
        listCourseClassesHandler({ onCall: onClasses }),
      );
      await renderCard();
      await screen.findByRole("alert");

      server.use(getCourseHandler({ onCall: onCourse }));
      await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
      await loaded();

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(valueOf("Planos de aula")).toHaveTextContent("6 planos de aula");
      expect(onCourse).toHaveBeenCalledTimes(2);
      expect(onClasses).toHaveBeenCalledTimes(1);
    });
  });

  describe("a course that cannot exist for the API", () => {
    it("asks nothing and says the data is not available, with the link and the level still there", async () => {
      const requests: string[] = [];
      server.events.on("request:start", ({ request }) => {
        requests.push(`${request.method} ${new URL(request.url).pathname}`);
      });

      try {
        await renderCard({ course: buildCourse({ id: "computer" }) });
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
        });

        expect(screen.getByText("Os dados deste curso não estão disponíveis.")).toBeInTheDocument();
        expect(valueOf("Curso")).toHaveTextContent("Informática Básica");
        expect(
          screen.getByRole("link", { name: "Abrir curso Informática Básica" }),
        ).toHaveAttribute("href", "/courses/computer");
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(requests.filter((request) => !request.endsWith("/auth/me"))).toEqual([]);
      } finally {
        server.events.removeAllListeners("request:start");
      }
    });
  });
});
