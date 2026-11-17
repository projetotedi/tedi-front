import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { Role } from "@shared/lib/role";

import { LessonPlansPage } from "../pages/LessonPlansPage";
import {
  archiveLessonPlanHandler,
  buildLessonPlan,
  buildLessonPlanDetail,
  buildLessonPlansPage,
  buildMeUser,
  createLessonPlanHandler,
  getLessonPlanHandler,
  getLessonPlanUsageHandler,
  listLessonPlanContentsHandler,
  listLessonPlansHandler,
  toLessonPlanListItem,
  unarchiveLessonPlanHandler,
  type ListLessonPlansCall,
} from "./handlers";
import { MOCK_LESSON_PLANS } from "./lesson-plan-catalog";
import { createDeferred, renderWithProviders, server, setupCatalogTestServer } from "./test-utils";

setupCatalogTestServer();

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="current-location">{`${location.pathname}${location.search}`}</output>;
}

const location = () => screen.getByTestId("current-location").textContent;

const plan = (id: string) => {
  const found = MOCK_LESSON_PLANS.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`No plan "${id}" in the catalog of the tests`);
  return found;
};

/** "Enviar um áudio no WhatsApp", in one course, with a material. */
const WHATSAPP = toLessonPlanListItem(plan("lesson-plan-04"));
/** "Conhecendo o computador". */
const COMPUTER = toLessonPlanListItem(plan("lesson-plan-01"));
const ARCHIVED = toLessonPlanListItem(plan("lesson-plan-01"), {
  status: "archived",
  archivedAt: "2026-10-10T13:00:00.000Z",
});

async function renderPage({
  route = "/lesson-plans",
  role = Role.coordinator,
  onCall,
  page = buildLessonPlansPage([COMPUTER, WHATSAPP], { total: 14 }),
}: {
  route?: string;
  role?: Role;
  onCall?: (call: ListLessonPlansCall) => void;
  page?: ReturnType<typeof buildLessonPlansPage>;
} = {}) {
  server.use(listLessonPlansHandler({ response: page, onCall }));
  const view = await renderWithProviders(
    <>
      <LessonPlansPage />
      <LocationProbe />
    </>,
    { route, user: buildMeUser(role) },
  );
  return view;
}

const table = () => screen.findByRole("table", { name: /Planos de aula/ });
const rowOf = async (title: string) =>
  within(await table()).getByRole("row", { name: new RegExp(title) });

describe("LessonPlansPage", () => {
  describe("reading the API", () => {
    it("shows the plans of listLessonPlans with the columns of the Figma", async () => {
      await renderPage();

      const row = await rowOf("Enviar um áudio no WhatsApp");

      expect(screen.getByRole("heading", { name: "Planos de aula (14)" })).toBeInTheDocument();
      expect(screen.getByRole("table")).toHaveAccessibleName("Planos de aula (14)");
      expect(screen.getByRole("columnheader", { name: "PLANO DE AULA" })).toBeInTheDocument();
      expect(
        screen.getByRole("columnheader", { name: "TURMAS QUE JÁ USARAM" }),
      ).toBeInTheDocument();
      expect(
        within(row).getByRole("link", { name: "Enviar um áudio no WhatsApp" }),
      ).toHaveAttribute("href", `/lesson-plans/${WHATSAPP.id}`);
      expect(within(row).getByText(WHATSAPP.contents.join(", "))).toBeInTheDocument();
      expect(
        within(row).getByLabelText(
          "Contagem de turmas disponível quando o módulo de aulas existir",
        ),
      ).toBeInTheDocument();
      expect(screen.getByText("Mostrando 2 de 14 planos de aula")).toBeInTheDocument();
    });

    it("asks the first page by title, with no filter", async () => {
      const onCall = vi.fn();
      await renderPage({ onCall });

      await table();
      expect(onCall).toHaveBeenCalledWith({ page: "1", limit: "7", sort: "title" });
    });

    it("sends the filters of the URL to the API", async () => {
      const onCall = vi.fn();
      await renderPage({
        onCall,
        route:
          "/lesson-plans?search=audio&content=Janela&usage=unused&minDuration=91&maxDuration=120&page=2",
      });

      await waitFor(() =>
        expect(onCall).toHaveBeenCalledWith({
          page: "2",
          limit: "7",
          sort: "title",
          search: "audio",
          content: "Janela",
          usage: "unused",
          minDuration: "91",
          maxDuration: "120",
        }),
      );
      expect(screen.getByRole("button", { name: /Duração/ })).toHaveTextContent(/1h31 a 2h/i);
    });

    it("tags an archived plan and offers Reativar instead of the pencil and the bin", async () => {
      const onCall = vi.fn();
      server.use(unarchiveLessonPlanHandler({ onCall }));
      const user = userEvent.setup();
      await renderPage({
        page: buildLessonPlansPage([ARCHIVED]),
        route: "/lesson-plans?usage=archived",
      });

      const row = await rowOf("Conhecendo o computador");
      expect(within(row).getByText("Arquivado")).toBeInTheDocument();
      expect(
        within(row).queryByRole("button", { name: /Editar plano de aula/ }),
      ).not.toBeInTheDocument();
      await user.click(
        within(row).getByRole("button", { name: "Reativar plano: Conhecendo o computador" }),
      );

      expect(await screen.findByText("Plano de aula reativado.")).toBeInTheDocument();
      expect(onCall).toHaveBeenCalledWith({ id: ARCHIVED.id });
    });
  });

  describe("filters", () => {
    it("searches by title after the typing stops, back on page 1, in the URL", async () => {
      const onCall = vi.fn();
      const user = userEvent.setup();
      await renderPage({ onCall, route: "/lesson-plans?page=2" });
      await table();

      await user.type(
        screen.getByRole("textbox", { name: "Buscar plano de aula por título" }),
        "AUDIO",
      );

      await waitFor(() =>
        expect(onCall).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: "AUDIO", page: "1" }),
        ),
      );
      expect(location()).toContain("search=AUDIO");
      expect(location()).not.toContain("page=");
    });

    it("suggests contents from the API and applies the one picked", async () => {
      const onSuggest = vi.fn();
      const onCall = vi.fn();
      server.use(
        listLessonPlanContentsHandler({ response: ["Janelas do sistema"], onCall: onSuggest }),
      );
      const user = userEvent.setup();
      await renderPage({ onCall });
      await table();

      await user.type(screen.getByRole("combobox", { name: "Conteúdo" }), "jan");
      // The suggestions are asked with the text once the typing stops.
      await waitFor(() => expect(onSuggest).toHaveBeenCalledWith("jan"));
      await user.click(await screen.findByRole("option", { name: "Janelas do sistema" }));

      await waitFor(() =>
        expect(onCall).toHaveBeenLastCalledWith(
          expect.objectContaining({ content: "Janelas do sistema" }),
        ),
      );
    });

    it("filters by duration and usage", async () => {
      const onCall = vi.fn();
      const user = userEvent.setup();
      await renderPage({ onCall });
      await table();

      await user.click(screen.getByRole("button", { name: /Duração/ }));
      await user.click(await screen.findByRole("option", { name: /Até 1h30/i }));
      await waitFor(() =>
        expect(onCall).toHaveBeenLastCalledWith(expect.objectContaining({ maxDuration: "90" })),
      );

      await user.click(screen.getByRole("button", { name: /Uso/ }));
      await user.click(await screen.findByRole("option", { name: "Sem uso" }));
      await waitFor(() =>
        expect(onCall).toHaveBeenLastCalledWith(
          expect.objectContaining({ maxDuration: "90", usage: "unused" }),
        ),
      );
    });

    it("keeps the page in the URL", async () => {
      const onCall = vi.fn();
      const user = userEvent.setup();
      await renderPage({ onCall, page: buildLessonPlansPage([COMPUTER], { total: 14 }) });
      await table();

      await user.click(screen.getByRole("button", { name: "Página 2" }));

      await waitFor(() =>
        expect(onCall).toHaveBeenLastCalledWith(expect.objectContaining({ page: "2" })),
      );
      expect(location()).toContain("page=2");
    });
  });

  describe("states", () => {
    it("shows the loading state while the first page comes", async () => {
      const pending = createDeferred();
      server.use(listLessonPlansHandler({ delay: pending.promise }));
      await renderWithProviders(<LessonPlansPage />);

      expect(await screen.findByText("Carregando planos de aula…")).toBeInTheDocument();
      pending.resolve();
    });

    it("says when there is no plan yet and offers + Novo plano de aula", async () => {
      await renderPage({ page: buildLessonPlansPage([]) });

      expect(await screen.findByText("Nenhum plano de aula ainda")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "+ Novo plano de aula" })).toHaveLength(2);
    });

    it("says when the filters find nothing, and Limpar filtros brings the list back", async () => {
      const onCall = vi.fn();
      const user = userEvent.setup();
      await renderPage({
        onCall,
        page: buildLessonPlansPage([]),
        route: "/lesson-plans?search=xyz",
      });

      expect(await screen.findByText("Nada encontrado")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Limpar filtros" }));

      await waitFor(() =>
        expect(onCall).toHaveBeenLastCalledWith({ page: "1", limit: "7", sort: "title" }),
      );
      expect(screen.getByRole("textbox", { name: "Buscar plano de aula por título" })).toHaveValue(
        "",
      );
    });

    it("shows the error and Tentar de novo asks again", async () => {
      server.use(listLessonPlansHandler({ networkError: true }));
      const user = userEvent.setup();
      await renderWithProviders(<LessonPlansPage />);

      const retry = await screen.findByRole("button", { name: "Tentar de novo" });
      server.use(listLessonPlansHandler({ response: buildLessonPlansPage([WHATSAPP]) }));
      await user.click(retry);

      expect(await table()).toBeInTheDocument();
    });
  });

  describe("actions", () => {
    it("the member does not see create, edit or archive actions", async () => {
      await renderPage({ role: Role.member });
      await table();

      expect(
        screen.queryByRole("button", { name: "+ Novo plano de aula" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Editar plano de aula:/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Arquivar plano de aula:/ }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("columnheader", { name: "AÇÕES" })).not.toBeInTheDocument();
    });

    it("creates a plan through the API, shows the success toast and opens its detail", async () => {
      const onCall = vi.fn();
      const created = buildLessonPlan({ title: "Plano novo" });
      server.use(createLessonPlanHandler({ response: created, onCall }));
      const user = userEvent.setup();
      await renderPage();
      await table();

      await user.click(screen.getByRole("button", { name: "+ Novo plano de aula" }));
      await screen.findByRole("dialog", { name: "Novo plano de aula" });
      await user.type(screen.getByRole("textbox", { name: "Título do plano" }), "Plano novo");
      await user.type(screen.getByRole("textbox", { name: "Horas" }), "1");
      await user.type(screen.getByRole("textbox", { name: "Minutos" }), "30");
      await user.type(screen.getByRole("textbox", { name: "Conteúdo 1" }), "Teclado e mouse");
      await user.click(screen.getByRole("button", { name: "Salvar plano" }));

      expect(await screen.findByText("Plano de aula criado.")).toBeInTheDocument();
      expect(onCall).toHaveBeenCalledWith({
        body: {
          title: "Plano novo",
          objective: null,
          expectedDurationMinutes: 90,
          contents: ["Teclado e mouse"],
          materialUrl: null,
        },
      });
      await waitFor(() => expect(location()).toBe(`/lesson-plans/${created.id}`));
    });

    it("the pencil opens the real Editar plano de aula, filled with the plan", async () => {
      server.use(
        getLessonPlanHandler({
          response: buildLessonPlanDetail({ id: WHATSAPP.id, title: WHATSAPP.title }),
        }),
        getLessonPlanUsageHandler(),
      );
      const user = userEvent.setup();
      await renderPage();

      await user.click(
        within(await rowOf("Enviar um áudio no WhatsApp")).getByRole("button", {
          name: "Editar plano de aula: Enviar um áudio no WhatsApp",
        }),
      );

      const dialog = await screen.findByRole("dialog", { name: "Editar plano de aula" });
      expect(await within(dialog).findByDisplayValue(WHATSAPP.title)).toBeInTheDocument();
      expect(location()).toBe("/lesson-plans");
    });

    it("the bin archives through the API and the list is asked again", async () => {
      const onArchive = vi.fn();
      const onList = vi.fn();
      server.use(
        archiveLessonPlanHandler({ onCall: onArchive }),
        getLessonPlanUsageHandler(),
        getLessonPlanHandler({ response: buildLessonPlanDetail({ id: WHATSAPP.id }) }),
      );
      const user = userEvent.setup();
      await renderPage({ onCall: onList });

      await user.click(
        within(await rowOf("Enviar um áudio no WhatsApp")).getByRole("button", {
          name: "Arquivar plano de aula: Enviar um áudio no WhatsApp",
        }),
      );
      const dialog = await screen.findByRole("dialog", { name: "Arquivar plano de aula" });
      const callsBefore = onList.mock.calls.length;
      await user.click(within(dialog).getByRole("button", { name: "Arquivar plano" }));

      expect(await screen.findByText("Plano de aula arquivado.")).toBeInTheDocument();
      expect(onArchive).toHaveBeenCalledWith(expect.objectContaining({ id: WHATSAPP.id }));
      await waitFor(() => expect(onList.mock.calls.length).toBeGreaterThan(callsBefore));
    });

    it("opens the detail from a cell of the row, but not from the material link", async () => {
      const user = userEvent.setup();
      await renderPage();
      const row = await rowOf("Enviar um áudio no WhatsApp");

      await user.click(
        within(row).getByRole("link", { name: "Abrir material de Enviar um áudio no WhatsApp" }),
      );
      expect(location()).toBe("/lesson-plans");

      await user.click(within(row).getByText(WHATSAPP.contents.join(", ")));
      expect(location()).toBe(`/lesson-plans/${WHATSAPP.id}`);
    });
  });
});
