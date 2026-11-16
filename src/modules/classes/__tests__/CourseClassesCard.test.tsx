import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ClassStatus } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { CourseClassesCard } from "../components/CourseClassesCard";
import {
  buildCourseClassesPage,
  buildCourseClassItem,
  buildMeUser,
  buildMeUserWithoutClasses,
  CLASS_ID,
  COURSE_ID,
  listCourseClassesHandler,
  type ListCourseClassesCall,
} from "./handlers";
import { createDeferred, renderWithProviders, server, setupClassesTestServer } from "./test-utils";

setupClassesTestServer();

const OTHER_CLASS_ID = "01952ef7-0000-7000-8000-0000000000d2";

/** A second class, with no name (the code stands in for it), planned and with nobody enrolled. */
const UNNAMED_CLASS = buildCourseClassItem({
  id: OTHER_CLASS_ID,
  code: "TUR-2025.2",
  name: null,
  edition: { id: "01952ef7-0000-7000-8000-0000000000e2", name: "2025.2" },
  startDate: "2025-08-05",
  endDate: "2025-12-12",
  capacity: 10,
  enrolledCount: 0,
  status: ClassStatus.planned,
});

async function renderCard(options: Parameters<typeof renderWithProviders>[1] = {}) {
  return renderWithProviders(<CourseClassesCard courseId={COURSE_ID} />, options);
}

const card = () => {
  const root = screen
    .getByRole("heading", { name: "Turmas deste curso" })
    .closest("[data-slot='card']");
  if (!(root instanceof HTMLElement)) throw new Error("No card titled Turmas deste curso");
  return root;
};

const table = () => screen.getByRole("table", { name: "Turmas deste curso" });
const bodyRows = () => within(table()).getAllByRole("row").slice(1);

describe("CourseClassesCard", () => {
  describe("the table", () => {
    it("shows class, edition, period, students and status of each class", async () => {
      server.use(
        listCourseClassesHandler({ response: buildCourseClassesPage([buildCourseClassItem()]) }),
      );
      await renderCard();

      await screen.findByRole("table", { name: "Turmas deste curso" });
      expect(
        within(table())
          .getAllByRole("columnheader")
          .map((header) => header.textContent),
      ).toEqual(["Turma", "Edição", "Período", "Alunos", "Status"]);
      const [name, edition, period, students, status] = within(bodyRows()[0]).getAllByRole("cell");
      expect(name).toHaveTextContent("Turma 2026.1");
      expect(edition).toHaveTextContent("2026.1");
      expect(period).toHaveTextContent("03/03/26 - 27/05/26");
      expect(within(students).getByText("12/15")).toBeVisible();
      expect(status).toHaveTextContent("Em andamento");
    });

    it("shows the seats as 12/15, and a screen reader hears how many seats are taken", async () => {
      server.use(listCourseClassesHandler());
      await renderCard();

      const seats = await screen.findByText("12/15");
      expect(seats).toHaveAttribute("aria-hidden", "true");
      expect(screen.getByText("12 de 15 vagas ocupadas")).toHaveClass("sr-only");
    });

    it("opens the class from its name, and from its code when it has no name", async () => {
      server.use(
        listCourseClassesHandler({
          response: buildCourseClassesPage([buildCourseClassItem(), UNNAMED_CLASS]),
        }),
      );
      await renderCard();

      expect(await screen.findByRole("link", { name: "Turma 2026.1" })).toHaveAttribute(
        "href",
        `/classes/${CLASS_ID}`,
      );
      expect(screen.getByRole("link", { name: "TUR-2025.2" })).toHaveAttribute(
        "href",
        `/classes/${OTHER_CLASS_ID}`,
      );
    });

    it("lists the classes in the order the API sent them", async () => {
      server.use(
        listCourseClassesHandler({
          response: buildCourseClassesPage([UNNAMED_CLASS, buildCourseClassItem()]),
        }),
      );
      await renderCard();

      await screen.findByRole("table", { name: "Turmas deste curso" });
      expect(bodyRows().map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual([
        "TUR-2025.2",
        "Turma 2026.1",
      ]);
    });

    it.each([
      [ClassStatus.planned, "Planejada"],
      [ClassStatus.in_progress, "Em andamento"],
      [ClassStatus.completed, "Encerrada"],
      [ClassStatus.cancelled, "Cancelada"],
    ])("shows the %s status as %s", async (status, label) => {
      server.use(
        listCourseClassesHandler({
          response: buildCourseClassesPage([buildCourseClassItem({ status })]),
        }),
      );
      await renderCard();

      await screen.findByRole("table", { name: "Turmas deste curso" });
      expect(within(bodyRows()[0]).getAllByRole("cell")[4]).toHaveTextContent(label);
    });

    it("keeps the touch target of the links at 44px", async () => {
      server.use(listCourseClassesHandler());
      await renderCard();

      expect(await screen.findByRole("link", { name: "Turma 2026.1" })).toHaveClass("min-h-11");
      expect(screen.getByRole("link", { name: /Ver todas as 1/ })).toHaveClass("min-h-11");
    });
  });

  describe("what it asks the API", () => {
    it("asks once, for the first five classes of the course", async () => {
      const onCall = vi.fn<(call: ListCourseClassesCall) => void>();
      server.use(listCourseClassesHandler({ onCall }));
      await renderCard();

      await screen.findByRole("table", { name: "Turmas deste curso" });

      expect(onCall).toHaveBeenCalledExactlyOnceWith({
        id: COURSE_ID,
        page: null,
        limit: 5,
        status: null,
      });
    });
  });

  describe("Ver todas as N ›", () => {
    it("says how many classes the course has, not how many the card shows", async () => {
      server.use(
        listCourseClassesHandler({
          response: buildCourseClassesPage([buildCourseClassItem()], 12),
        }),
      );
      await renderCard();

      const link = await screen.findByRole("link", { name: "Ver todas as 12 turmas deste curso" });

      expect(link).toHaveTextContent("Ver todas as 12");
      expect(within(link).getByText("›")).toHaveAttribute("aria-hidden", "true");
      expect(bodyRows()).toHaveLength(1);
    });

    it("opens the list of classes already filtered by the course", async () => {
      const user = userEvent.setup();
      server.use(
        listCourseClassesHandler({
          response: buildCourseClassesPage([buildCourseClassItem()], 12),
        }),
      );
      const { router } = await renderCard();

      const link = await screen.findByRole("link", { name: "Ver todas as 12 turmas deste curso" });
      expect(link).toHaveAttribute("href", `/classes?courseId=${COURSE_ID}`);

      await user.click(link);

      await waitFor(() => expect(router.state.location.pathname).toBe("/classes"));
      expect(router.state.location.search).toBe(`?courseId=${COURSE_ID}`);
    });

    it("is not there when the course has no class", async () => {
      server.use(listCourseClassesHandler({ response: buildCourseClassesPage([], 0) }));
      await renderCard();

      await screen.findByText("Este curso ainda não tem turmas.");

      expect(within(card()).queryByRole("link")).not.toBeInTheDocument();
    });
  });

  describe("the states", () => {
    it("says the course has no class yet, with no table", async () => {
      server.use(listCourseClassesHandler({ response: buildCourseClassesPage([], 0) }));
      await renderCard();

      expect(await screen.findByText("Este curso ainda não tem turmas.")).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("shows a loading state under the title while the classes are on their way", async () => {
      const deferred = createDeferred();
      server.use(listCourseClassesHandler({ delay: deferred.promise }));
      await renderCard();

      expect(await screen.findByRole("status")).toHaveTextContent("Carregando as turmas do curso…");
      expect(screen.getByRole("heading", { name: "Turmas deste curso" })).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();

      deferred.resolve();

      expect(await screen.findByRole("table", { name: "Turmas deste curso" })).toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("goes from loading to the error, and from the error to the table with Tentar de novo", async () => {
      const user = userEvent.setup();
      const deferred = createDeferred();
      server.use(listCourseClassesHandler({ delay: deferred.promise, networkError: true }));
      await renderCard();
      expect(await screen.findByRole("status")).toBeInTheDocument();

      deferred.resolve();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar as turmas deste curso.",
      );
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Turmas deste curso" })).toBeInTheDocument();

      server.use(listCourseClassesHandler());
      await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

      expect(await screen.findByRole("table", { name: "Turmas deste curso" })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows the error also for an error of the server", async () => {
      server.use(
        listCourseClassesHandler({ error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" } }),
      );
      await renderCard();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar as turmas deste curso.",
      );
      expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
      expect(within(card()).queryByRole("link")).not.toBeInTheDocument();
    });
  });

  describe("who sees it", () => {
    it.each([
      ["member", Role.member],
      ["director", Role.director],
      ["coordinator", Role.coordinator],
    ])("the %s sees the classes of the course", async (_label, role) => {
      server.use(listCourseClassesHandler());
      await renderCard({ user: buildMeUser(role) });

      expect(await screen.findByRole("table", { name: "Turmas deste curso" })).toBeInTheDocument();
    });

    it("draws nothing and asks nothing without classes.view", async () => {
      const onCall = vi.fn<(call: ListCourseClassesCall) => void>();
      server.use(listCourseClassesHandler({ onCall }));
      const { container } = await renderCard({ user: buildMeUserWithoutClasses() });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByRole("heading", { name: "Turmas deste curso" })).not.toBeInTheDocument();
      expect(onCall).not.toHaveBeenCalled();
    });
  });
});
