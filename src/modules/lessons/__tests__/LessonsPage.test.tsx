import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { LessonStatus } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { LessonsPage } from "../pages/LessonsPage";
import {
  buildLesson,
  buildLessonListItem,
  buildLessonsPage,
  buildMeUser,
  CLASS_NAME,
  createLessonHandler,
  getLessonHandler,
  LESSON_ID,
  LESSON_PLAN_ID,
  listClassesHandler,
  listCourseLessonPlansHandler,
  listLessonPlansHandler,
  listLessonsHandler,
  OTHER_CLASS_ID,
  OTHER_CLASS_NAME,
  OTHER_LESSON_ID,
  type ListCall,
} from "./handlers";
import { createDeferred, renderWithProviders, server, setupLessonsTestServer } from "./test-utils";

setupLessonsTestServer();

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="current-location">{`${location.pathname}${location.search}`}</output>;
}

const location = () => screen.getByTestId("current-location").textContent;

const KEYBOARD = buildLessonListItem({ teacher: { id: "person-1", name: "Marina Souza" } });
const PASSWORDS = buildLessonListItem({
  id: OTHER_LESSON_ID,
  title: "Senhas e privacidade",
  date: "2026-03-17",
  startTime: "14:00",
  endTime: "15:30",
  status: LessonStatus.confirmed,
  class: {
    ...buildLessonListItem().class,
    id: OTHER_CLASS_ID,
    name: OTHER_CLASS_NAME,
    colorIndex: 1,
  },
});
const CANCELLED = buildLessonListItem({
  id: "01952ef7-0000-7000-8000-0000000000f3",
  title: "Aula de revisão",
  status: LessonStatus.cancelled,
});

async function renderPage({
  route = "/lessons",
  role = Role.coordinator,
  onCall,
  response = buildLessonsPage([KEYBOARD, PASSWORDS], { total: 14 }),
}: {
  route?: string;
  role?: Role;
  onCall?: (call: ListCall) => void;
  response?: ReturnType<typeof buildLessonsPage>;
} = {}) {
  server.use(
    listClassesHandler(),
    listLessonPlansHandler(),
    listLessonsHandler({ response, onCall }),
  );
  return renderWithProviders(
    <>
      <LessonsPage />
      <LocationProbe />
    </>,
    { route, user: buildMeUser(role) },
  );
}

const table = () => screen.findByRole("table", { name: "Lista de aulas" });
const rowOf = async (title: string) =>
  within(await table()).getByRole("row", { name: new RegExp(title) });
const trigger = (name: RegExp) => screen.getByRole("button", { name });
const searchBox = () => screen.getByRole("textbox", { name: "Buscar aula por conteúdo" });
const periodGroup = () => screen.getByRole("group", { name: "Período" });

async function typeDate(user: UserEvent, name: "De" | "Até", digits: string) {
  await user.click(
    within(within(periodGroup()).getByRole("group", { name })).getAllByRole("spinbutton")[0],
  );
  await user.keyboard(digits);
}

async function choose(user: UserEvent, name: RegExp, option: string) {
  await user.click(trigger(name));
  await user.click(await screen.findByRole("option", { name: option }));
}

describe("LessonsPage", () => {
  describe("reading the API", () => {
    it("shows the lessons of listLessons with the columns and the title Aulas (N)", async () => {
      await renderPage();

      const row = await rowOf("Teclado, mouse e janelas");

      expect(screen.getByRole("heading", { name: "Aulas (14)" })).toBeInTheDocument();
      for (const name of [
        "Turma",
        "Data",
        "Horário",
        "Conteúdo",
        "Responsável",
        "Status",
        "Ações",
      ]) {
        expect(screen.getByRole("columnheader", { name })).toBeInTheDocument();
      }
      expect(within(row).getByRole("cell", { name: CLASS_NAME })).toBeInTheDocument();
      expect(within(row).getByRole("cell", { name: "10/03/2026" })).toBeInTheDocument();
      expect(within(row).getByRole("cell", { name: "09:00–11:00" })).toBeInTheDocument();
      expect(within(row).getByRole("link", { name: "Teclado, mouse e janelas" })).toHaveAttribute(
        "href",
        `/lessons/${LESSON_ID}`,
      );
      expect(within(row).getByText("Planejada")).toBeInTheDocument();
      expect(
        within(await rowOf("Senhas e privacidade")).getByText("Confirmada"),
      ).toBeInTheDocument();
      expect(screen.getByText("Mostrando 2 de 14 aulas")).toBeInTheDocument();
    });

    it("Responsável is the teacher's name, or a dash read as Não informado", async () => {
      await renderPage();

      expect(
        within(await rowOf("Teclado, mouse e janelas")).getByRole("cell", { name: "Marina Souza" }),
      ).toBeInTheDocument();
      const noTeacher = within(await rowOf("Senhas e privacidade")).getByRole("cell", {
        name: "Não informado",
      });
      expect(noTeacher).toHaveTextContent("—");
    });

    it("says Aulas, with no number, until the first page comes", async () => {
      const pending = createDeferred();
      server.use(listClassesHandler(), listLessonPlansHandler());
      server.use(listLessonsHandler({ delay: pending.promise }));
      await renderWithProviders(<LessonsPage />);

      expect(screen.getByRole("heading", { name: "Aulas" })).toBeInTheDocument();
      pending.resolve();
      expect(await screen.findByRole("heading", { name: "Aulas (1)" })).toBeInTheDocument();
    });

    it("asks the first page with no filter", async () => {
      const onCall = vi.fn();
      await renderPage({ onCall });

      await table();
      expect(onCall).toHaveBeenCalledWith({ page: "1", limit: "10" });
    });

    it("does not show Candidaturas pendentes, which is hidden until the allocation exists", async () => {
      await renderPage();
      await table();

      expect(screen.queryByText(/Candidaturas pendentes/)).not.toBeInTheDocument();
    });

    it("tags a cancelled lesson and shows its icons disabled", async () => {
      await renderPage({ response: buildLessonsPage([CANCELLED]) });

      const row = within(await rowOf("Aula de revisão"));
      expect(row.getByText("Cancelada")).toBeInTheDocument();
      expect(row.getByRole("button", { name: "Editar a aula Aula de revisão" })).toBeDisabled();
      expect(row.getByRole("button", { name: "Cancelar a aula Aula de revisão" })).toBeDisabled();
    });
  });

  describe("filters", () => {
    it("searches after the typing stops, back on page 1, in the URL", async () => {
      const onCall = vi.fn();
      const user = userEvent.setup();
      await renderPage({ onCall, route: "/lessons?page=2" });
      await table();

      await user.type(searchBox(), "senhas");

      await waitFor(() =>
        expect(onCall).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: "senhas", page: "1" }),
        ),
      );
      expect(location()).toContain("search=senhas");
      expect(location()).not.toContain("page=");
    });

    it("does not ask while the typing goes on", async () => {
      const onCall = vi.fn();
      const user = userEvent.setup();
      await renderPage({ onCall });
      await table();
      const asked = onCall.mock.calls.length;

      await user.type(searchBox(), "sen");

      expect(onCall.mock.calls.length).toBe(asked);
      expect(location()).toBe("/lessons");
    });

    it("filters by class, status, period and plan, back on page 1", async () => {
      const onCall = vi.fn();
      const user = userEvent.setup();
      await renderPage({ onCall, route: "/lessons?page=2" });
      await table();

      await choose(user, /^Turma/, OTHER_CLASS_NAME);
      await choose(user, /^Status/, "Confirmada");
      await choose(user, /^Plano de aula/, "Teclado, mouse e janelas");
      await typeDate(user, "De", "02032026");
      await typeDate(user, "Até", "31032026");

      await waitFor(() =>
        expect(onCall).toHaveBeenLastCalledWith({
          page: "1",
          limit: "10",
          classId: OTHER_CLASS_ID,
          lessonPlanId: LESSON_PLAN_ID,
          status: "confirmed",
          from: "2026-03-02",
          to: "2026-03-31",
        }),
      );
      expect(location()).not.toContain("page=");
      expect(location()).toContain("classId=");
      expect(location()).toContain("from=2026-03-02");
    });

    it("a URL with filters fills the controls and sends them to the API", async () => {
      const onCall = vi.fn();
      await renderPage({
        onCall,
        route: `/lessons?search=senhas&classId=${OTHER_CLASS_ID}&status=confirmed&lessonPlanId=${LESSON_PLAN_ID}&from=2026-03-02&to=2026-03-31&page=2`,
      });

      await waitFor(() =>
        expect(onCall).toHaveBeenCalledWith({
          page: "2",
          limit: "10",
          search: "senhas",
          classId: OTHER_CLASS_ID,
          lessonPlanId: LESSON_PLAN_ID,
          status: "confirmed",
          from: "2026-03-02",
          to: "2026-03-31",
        }),
      );
      expect(searchBox()).toHaveValue("senhas");
      expect(trigger(/^Status/)).toHaveTextContent("Status: Confirmada");
      await waitFor(() =>
        expect(trigger(/^Turma/)).toHaveTextContent(`Turma: ${OTHER_CLASS_NAME}`),
      );
      await waitFor(() =>
        expect(trigger(/^Plano de aula/)).toHaveTextContent(
          "Plano de aula: Teclado, mouse e janelas",
        ),
      );
      const [day, month, year] = within(within(periodGroup()).getByRole("group", { name: "De" }))
        .getAllByRole("spinbutton")
        .map((segment) => segment.getAttribute("aria-valuenow"));
      expect([day, month, year]).toEqual(["2", "3", "2026"]);
    });

    it("drops an id that is not a UUID and an inverted period of the URL, which the API would refuse", async () => {
      const onCall = vi.fn();
      await renderPage({
        onCall,
        route: "/lessons?classId=banana&status=archived&from=2026-03-31&to=2026-03-02",
      });

      await table();
      expect(onCall).toHaveBeenCalledWith({ page: "1", limit: "10", from: "2026-03-31" });
      expect(onCall).not.toHaveBeenCalledWith(expect.objectContaining({ classId: "banana" }));
    });

    it("an inverted period typed in shows the error on Até and does not ask the API", async () => {
      const onCall = vi.fn();
      const user = userEvent.setup();
      await renderPage({ onCall, route: "/lessons?from=2026-03-10&to=2026-03-20" });
      await table();
      const asked = onCall.mock.calls.length;

      await typeDate(user, "Até", "05032026");

      expect(
        await within(periodGroup()).findByText(
          "A data final precisa ser igual ou depois da data inicial.",
        ),
      ).toBeInTheDocument();
      expect(onCall.mock.calls.length).toBe(asked);
      expect(location()).toBe("/lessons?from=2026-03-10&to=2026-03-20");
    });

    it("keeps the page in the URL and asks that page", async () => {
      const onCall = vi.fn();
      const user = userEvent.setup();
      await renderPage({ onCall });
      await table();

      await user.click(screen.getByRole("button", { name: "Página 2" }));

      await waitFor(() =>
        expect(onCall).toHaveBeenLastCalledWith(expect.objectContaining({ page: "2" })),
      );
      expect(location()).toContain("page=2");
    });

    it("keeps the rows on the screen, busy, while the next page comes", async () => {
      const pending = createDeferred();
      const user = userEvent.setup();
      await renderPage();
      await table();

      server.use(
        listLessonsHandler({
          delay: pending.promise,
          response: buildLessonsPage([PASSWORDS], { total: 14, page: 2 }),
        }),
      );
      await user.click(screen.getByRole("button", { name: "Página 2" }));

      expect(await rowOf("Teclado, mouse e janelas")).toBeInTheDocument();
      expect(screen.getByRole("table").closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");
      pending.resolve();
      await waitFor(() =>
        expect(
          screen.queryByRole("link", { name: "Teclado, mouse e janelas" }),
        ).not.toBeInTheDocument(),
      );
      expect(screen.getByRole("table").closest("[aria-busy]")).toHaveAttribute(
        "aria-busy",
        "false",
      );
    });

    it("the box follows the URL when it changes by another way, and does not write the old text back", async () => {
      const onCall = vi.fn();
      const user = userEvent.setup();
      const { router } = await renderPage({ onCall });
      await table();
      await user.type(searchBox(), "senhas");
      await waitFor(() => expect(location()).toContain("search=senhas"));

      await act(() => router.navigate("/lessons?search=teclado"));

      expect(searchBox()).toHaveValue("teclado");
      await waitFor(() =>
        expect(onCall).toHaveBeenLastCalledWith(expect.objectContaining({ search: "teclado" })),
      );
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(location()).toBe("/lessons?search=teclado");
    });

    it("the box empties when the URL goes back to /lessons, as the menu item does", async () => {
      const { router } = await renderPage({ route: "/lessons?search=senhas" });
      await table();
      expect(searchBox()).toHaveValue("senhas");

      await act(() => router.navigate("/lessons"));

      expect(searchBox()).toHaveValue("");
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(location()).toBe("/lessons");
    });
  });

  describe("states", () => {
    it("shows the loading state while the first page comes", async () => {
      const pending = createDeferred();
      server.use(listClassesHandler(), listLessonPlansHandler());
      server.use(listLessonsHandler({ delay: pending.promise }));
      await renderWithProviders(<LessonsPage />);

      expect(await screen.findByText("Carregando aulas…")).toBeInTheDocument();
      pending.resolve();
      await table();
    });

    it("says there is no lesson yet and offers + Nova aula", async () => {
      await renderPage({ response: buildLessonsPage([]) });

      expect(await screen.findByText("Nenhuma aula ainda")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "Nova aula" })).toHaveLength(2);
      expect(screen.getByRole("heading", { name: "Aulas (0)" })).toBeInTheDocument();
    });

    it("the member is not offered + Nova aula, not even in the empty state", async () => {
      await renderPage({ response: buildLessonsPage([]), role: Role.member });

      expect(await screen.findByText("Nenhuma aula ainda")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Nova aula" })).not.toBeInTheDocument();
    });

    it("says when the filters find nothing, and Limpar filtros brings the list back and focuses the search", async () => {
      const onCall = vi.fn();
      const user = userEvent.setup();
      await renderPage({
        onCall,
        response: buildLessonsPage([]),
        route: "/lessons?search=xyz&status=done",
      });

      expect(await screen.findByText("Nada encontrado")).toBeInTheDocument();
      server.use(listLessonsHandler({ onCall, response: buildLessonsPage([KEYBOARD]) }));
      await user.click(screen.getByRole("button", { name: "Limpar filtros" }));

      await waitFor(() => expect(onCall).toHaveBeenLastCalledWith({ page: "1", limit: "10" }));
      expect(searchBox()).toHaveValue("");
      expect(searchBox()).toHaveFocus();
      expect(location()).toBe("/lessons");
      expect(trigger(/^Status/)).toHaveTextContent("Status: todos");
      expect(await rowOf("Teclado, mouse e janelas")).toBeInTheDocument();
    });

    it("does not say there is no lesson yet in the moment after Limpar filtros", async () => {
      const pending = createDeferred();
      const user = userEvent.setup();
      await renderPage({ response: buildLessonsPage([]), route: "/lessons?search=xyz" });
      await screen.findByText("Nada encontrado");

      server.use(
        listLessonsHandler({ delay: pending.promise, response: buildLessonsPage([KEYBOARD]) }),
      );
      await user.click(screen.getByRole("button", { name: "Limpar filtros" }));

      expect(await screen.findByText("Carregando aulas…")).toBeInTheDocument();
      expect(screen.queryByText("Nenhuma aula ainda")).not.toBeInTheDocument();
      pending.resolve();
      await table();
    });

    it("shows the error and Tentar de novo asks again", async () => {
      server.use(listClassesHandler(), listLessonPlansHandler());
      server.use(listLessonsHandler({ networkError: true }));
      const user = userEvent.setup();
      await renderWithProviders(<LessonsPage />);

      const retry = await screen.findByRole("button", { name: "Tentar de novo" });
      expect(screen.getByText("Não foi possível carregar as aulas")).toBeInTheDocument();
      server.use(listLessonsHandler({ response: buildLessonsPage([KEYBOARD]) }));
      await user.click(retry);

      expect(await rowOf("Teclado, mouse e janelas")).toBeInTheDocument();
    });

    it("keeps the error panel, with its button loading, while Tentar de novo is on its way", async () => {
      const pending = createDeferred();
      server.use(listClassesHandler(), listLessonPlansHandler());
      server.use(listLessonsHandler({ networkError: true }));
      const user = userEvent.setup();
      await renderWithProviders(<LessonsPage />);
      const retry = await screen.findByRole("button", { name: "Tentar de novo" });

      server.use(listLessonsHandler({ delay: pending.promise, networkError: true }));
      await user.click(retry);

      // While it loads the button is the same one, marked as pending (it stays in the page, so it
      // keeps the focus), and the error panel is not replaced by the skeleton.
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /Tentar de novo/ })).toHaveAttribute(
          "data-pending",
          "true",
        ),
      );
      expect(screen.getByRole("button", { name: /Tentar de novo/ })).toBe(retry);
      expect(screen.queryByText("Carregando aulas…")).not.toBeInTheDocument();
      expect(screen.getByText("Não foi possível carregar as aulas")).toBeInTheDocument();
      pending.resolve();
    });
  });

  describe("actions", () => {
    it("the member sees no column Ações, no icon and no + Nova aula", async () => {
      await renderPage({ role: Role.member });
      await table();

      expect(screen.queryByRole("columnheader", { name: "Ações" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Editar a aula/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Cancelar a aula/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Nova aula" })).not.toBeInTheDocument();
    });

    it.each([
      ["director", Role.director],
      ["coordinator", Role.coordinator],
    ])(
      "the %s sees the column Ações, the icons of every row and + Nova aula",
      async (_label, role) => {
        await renderPage({ role });
        await table();

        expect(screen.getByRole("columnheader", { name: "Ações" })).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: "Editar a aula Senhas e privacidade" }),
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Nova aula" })).toHaveTextContent("+ Nova aula");
      },
    );

    it("a click on a cell opens /lessons/:id", async () => {
      const user = userEvent.setup();
      await renderPage();
      const row = await rowOf("Senhas e privacidade");

      await user.click(within(row).getByRole("cell", { name: "17/03/2026" }));

      expect(location()).toBe(`/lessons/${OTHER_LESSON_ID}`);
    });

    it("a click on the link of the content opens /lessons/:id", async () => {
      const user = userEvent.setup();
      await renderPage();

      await user.click(
        within(await rowOf("Teclado, mouse e janelas")).getByRole("link", {
          name: "Teclado, mouse e janelas",
        }),
      );

      expect(location()).toBe(`/lessons/${LESSON_ID}`);
    });

    it("the pencil opens Editar aula and stays on /lessons, also after clicking inside the dialog", async () => {
      server.use(getLessonHandler());
      const user = userEvent.setup();
      await renderPage();

      await user.click(
        within(await rowOf("Teclado, mouse e janelas")).getByRole("button", {
          name: "Editar a aula Teclado, mouse e janelas",
        }),
      );
      const dialog = await screen.findByRole("dialog", { name: "Editar aula" });
      expect(await within(dialog).findByRole("textbox", { name: "Título da aula" })).toHaveValue(
        "Teclado, mouse e janelas",
      );
      await user.click(within(dialog).getByRole("textbox", { name: "Título da aula" }));
      await user.click(within(dialog).getByRole("heading", { name: "Editar aula" }));

      expect(location()).toBe("/lessons");
      expect(screen.getByRole("dialog", { name: "Editar aula" })).toBeInTheDocument();
    });

    it("the trash opens Cancelar aula without leaving", async () => {
      const user = userEvent.setup();
      await renderPage();

      await user.click(
        within(await rowOf("Senhas e privacidade")).getByRole("button", {
          name: "Cancelar a aula Senhas e privacidade",
        }),
      );

      const dialog = await screen.findByRole("dialog", { name: "Cancelar aula" });
      await user.click(within(dialog).getByRole("textbox", { name: "Motivo do cancelamento" }));
      expect(location()).toBe("/lessons");
    });

    it("+ Nova aula asks for the class, and the class of the filter comes chosen", async () => {
      const user = userEvent.setup();
      await renderPage({ route: `/lessons?classId=${OTHER_CLASS_ID}` });
      await table();

      await user.click(screen.getByRole("button", { name: "Nova aula" }));

      const dialog = await screen.findByRole("dialog", { name: "Escolha a turma da aula" });
      await waitFor(() =>
        expect(within(dialog).getByRole("button", { name: /Turma/ })).toHaveTextContent(
          OTHER_CLASS_NAME,
        ),
      );
    });

    it("+ Nova aula of the empty state opens the same flow", async () => {
      const user = userEvent.setup();
      await renderPage({ response: buildLessonsPage([]) });
      await screen.findByText("Nenhuma aula ainda");

      await user.click(screen.getAllByRole("button", { name: "Nova aula" })[1]);

      expect(
        await screen.findByRole("dialog", { name: "Escolha a turma da aula" }),
      ).toBeInTheDocument();
    });

    it("creates a lesson from the flow and asks the list again", async () => {
      const onCall = vi.fn();
      const created = buildLesson({ title: "Aula de teclado" });
      server.use(listCourseLessonPlansHandler(), createLessonHandler({ response: created }));
      const user = userEvent.setup();
      await renderPage({ onCall });
      await table();
      const asked = onCall.mock.calls.length;

      await user.click(screen.getByRole("button", { name: "Nova aula" }));
      const chooser = await screen.findByRole("dialog", { name: "Escolha a turma da aula" });
      await user.click(await within(chooser).findByRole("button", { name: /Turma/ }));
      await user.click(await screen.findByRole("option", { name: CLASS_NAME }));
      await user.click(within(chooser).getByRole("button", { name: "Continuar" }));
      await user.type(
        await screen.findByRole("textbox", { name: "Título da aula" }),
        "Aula de teclado",
      );
      fireEvent.change(screen.getByLabelText(/^Data da aula/), { target: { value: "2026-03-10" } });
      fireEvent.change(screen.getByLabelText(/^Hora de início/), { target: { value: "09:00" } });
      fireEvent.change(screen.getByLabelText(/^Hora de término/), { target: { value: "11:00" } });
      await user.click(screen.getByRole("button", { name: "Salvar aula" }));

      expect(await screen.findByText("Aula criada")).toBeInTheDocument();
      await waitFor(() => expect(onCall.mock.calls.length).toBeGreaterThan(asked));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(location()).toBe("/lessons");
    });
  });
});
