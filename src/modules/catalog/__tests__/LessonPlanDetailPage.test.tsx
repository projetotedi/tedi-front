import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getGetLessonPlanQueryKey } from "@api/generated/catalog/catalog";
import { Role } from "@shared/lib/role";

import { catalogRoutes } from "../routes";
import {
  buildArchivedLessonPlanDetail,
  buildInUseLessonPlanDetail,
  buildLessonPlan,
  buildLessonPlanDetail,
  buildMeUser,
  COURSE_SMARTPHONES,
  COURSE_SOCIAL_NETWORKS,
  getLessonPlanHandler,
  getLessonPlanUsageHandler,
  LESSON_PLAN_ID,
  listCourseLessonPlansHandler,
  NOT_FOUND_ERROR,
  updateLessonPlanHandler,
} from "./handlers";
import { createDeferred, renderRoutes, server, setupCatalogTestServer } from "./test-utils";

setupCatalogTestServer();

const DETAIL_ROUTE = `/lesson-plans/${LESSON_PLAN_ID}`;

type DetailPlan = ReturnType<typeof buildLessonPlanDetail>;

interface RenderOptions {
  plan?: DetailPlan;
  role?: Role;
}

async function renderDetail({
  plan = buildLessonPlanDetail(),
  role = Role.coordinator,
}: RenderOptions = {}) {
  server.use(getLessonPlanHandler({ response: plan }));
  const view = await renderRoutes(catalogRoutes, { route: DETAIL_ROUTE, user: buildMeUser(role) });
  await screen.findByRole("heading", { name: "Dados do plano de aula" });
  return view;
}

/**
 * The card (the root with `data-slot="card"`) whose `<h2>` is `name`. It also finds the cards of the
 * page while a dialog is open over it, when the page is hidden from the accessibility tree.
 */
function card(name: string): HTMLElement {
  const root = screen.getByRole("heading", { name, hidden: true }).closest("[data-slot='card']");
  if (!(root instanceof HTMLElement)) throw new Error(`No card titled "${name}"`);
  return root;
}

/** The value (`<dd>`) of the field `label` (`<dt>`) inside `scope`. */
function valueOf(scope: HTMLElement, label: string): string | null {
  return within(scope).getByText(label, { selector: "dt" }).nextElementSibling?.textContent ?? null;
}

/** The tags of the header, found through the one that every plan has. */
function headerTags(): HTMLElement {
  const list = screen.getByText(/ previstos$/).closest("ul");
  if (!(list instanceof HTMLElement)) throw new Error("No tag list in the header");
  return list;
}

async function changeDuration(user: UserEvent, hours: string, minutes: string) {
  const hoursField = await screen.findByRole("textbox", { name: "Horas" });
  await user.clear(hoursField);
  await user.type(hoursField, hours);
  await user.clear(screen.getByRole("textbox", { name: "Minutos" }));
  await user.type(screen.getByRole("textbox", { name: "Minutos" }), minutes);
}

describe("LessonPlanDetailPage", () => {
  describe("loading the plan", () => {
    it("shows a loading state while the plan is on its way", async () => {
      const deferred = createDeferred();
      server.use(getLessonPlanHandler({ delay: deferred.promise }));
      await renderRoutes(catalogRoutes, { route: DETAIL_ROUTE });

      expect(await screen.findByRole("status")).toHaveTextContent("Carregando o plano de aula…");
      expect(
        screen.queryByRole("heading", { name: "Dados do plano de aula" }),
      ).not.toBeInTheDocument();

      deferred.resolve();
      expect(
        await screen.findByRole("heading", { name: "Dados do plano de aula" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("asks the plan by the id of the route", async () => {
      const onCall = vi.fn();
      server.use(getLessonPlanHandler({ onCall }));
      await renderRoutes(catalogRoutes, { route: DETAIL_ROUTE });

      await screen.findByRole("heading", { name: "Dados do plano de aula" });

      expect(onCall).toHaveBeenCalledWith({ id: LESSON_PLAN_ID });
    });

    it("shows not found with a link to the list for an unknown id", async () => {
      server.use(getLessonPlanHandler({ error: NOT_FOUND_ERROR }));
      const user = userEvent.setup();
      await renderRoutes(catalogRoutes, { route: DETAIL_ROUTE });

      expect(
        await screen.findByRole("heading", { name: "Plano de aula não encontrado" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Dados do plano de aula" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Editar plano" })).not.toBeInTheDocument();
      const link = screen.getByRole("link", { name: "Voltar para planos de aula" });
      expect(link).toHaveAttribute("href", "/lesson-plans");

      await user.click(link);

      expect(
        await screen.findByRole("heading", { name: /Planos de aula \(\d+\)/ }),
      ).toBeInTheDocument();
    });

    it.each([
      ["a word", "abc"],
      ["the id of a mocked row of the list", "lesson-plan-04"],
      ["a UUID with something after it", `${LESSON_PLAN_ID}-extra`],
    ])(
      "shows not found with a link to the list, without asking the API, for an id that is %s",
      async (_label, id) => {
        const onCall = vi.fn();
        server.use(getLessonPlanHandler({ onCall }));
        const user = userEvent.setup();
        const { queryClient } = await renderRoutes(catalogRoutes, { route: `/lesson-plans/${id}` });

        expect(
          await screen.findByRole("heading", { name: "Plano de aula não encontrado" }),
        ).toBeInTheDocument();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Editar plano" })).not.toBeInTheDocument();
        expect(queryClient.getQueryState(getGetLessonPlanQueryKey(id))).toMatchObject({
          status: "pending",
          fetchStatus: "idle",
        });
        expect(onCall).not.toHaveBeenCalled();
        const link = screen.getByRole("link", { name: "Voltar para planos de aula" });
        expect(link).toHaveAttribute("href", "/lesson-plans");

        await user.click(link);

        expect(
          await screen.findByRole("heading", { name: /Planos de aula \(\d+\)/ }),
        ).toBeInTheDocument();
        expect(onCall).not.toHaveBeenCalled();
      },
    );

    it("shows an error with retry when the plan cannot be loaded", async () => {
      server.use(getLessonPlanHandler({ networkError: true }));
      const user = userEvent.setup();
      await renderRoutes(catalogRoutes, { route: DETAIL_ROUTE });

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar o plano de aula. Tente novamente.",
      );
      expect(
        screen.queryByRole("heading", { name: "Plano de aula não encontrado" }),
      ).not.toBeInTheDocument();

      server.use(getLessonPlanHandler());
      await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

      expect(
        await screen.findByRole("heading", { name: "Dados do plano de aula" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("header", () => {
    it("shows the title, the status and duration tags and Editar plano for who can manage", async () => {
      await renderDetail({ plan: buildLessonPlanDetail({ title: "Enviar um áudio no WhatsApp" }) });

      expect(
        screen.getByRole("heading", { level: 2, name: "Enviar um áudio no WhatsApp" }),
      ).toBeInTheDocument();
      const tags = within(headerTags());
      expect(tags.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
        "Sem uso",
        "1h30 previstos",
        "Com material",
      ]);
      expect(screen.getByRole("button", { name: "Editar plano" })).toBeEnabled();
    });

    it("tells the courses that use the plan in the tags", async () => {
      await renderDetail({ plan: buildInUseLessonPlanDetail() });

      expect(
        within(headerTags())
          .getAllByRole("listitem")
          .map((item) => item.textContent),
      ).toEqual(["Em uso", "1h30 previstos", "2 cursos", "Com material"]);
    });

    it("leaves out the tags that do not apply: no courses, no material", async () => {
      await renderDetail({ plan: buildLessonPlanDetail({ materialUrl: null }) });

      const tags = within(headerTags());
      expect(tags.queryByText("Com material")).not.toBeInTheDocument();
      expect(tags.queryByText(/curso/)).not.toBeInTheDocument();
    });

    it("hides Editar plano from the member", async () => {
      await renderDetail({ role: Role.member });

      expect(screen.getByRole("heading", { name: "Dados do plano de aula" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Editar plano" })).not.toBeInTheDocument();
    });

    it("offers Editar plano to the director too", async () => {
      await renderDetail({ role: Role.director });

      expect(screen.getByRole("button", { name: "Editar plano" })).toBeInTheDocument();
    });

    it("does not offer Duplicar plano nor an exclude button", async () => {
      await renderDetail({ plan: buildInUseLessonPlanDetail() });

      expect(screen.queryByRole("button", { name: /Duplicar/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Excluir/ })).not.toBeInTheDocument();
    });

    it("hides Editar plano for an archived plan and shows Arquivado", async () => {
      await renderDetail({ plan: buildArchivedLessonPlanDetail() });

      expect(within(headerTags()).getByText("Arquivado")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Editar plano" })).not.toBeInTheDocument();
    });

    it("keeps the 44px touch target of Editar plano", async () => {
      await renderDetail();

      expect(screen.getByRole("button", { name: "Editar plano" })).toHaveClass("min-h-11");
    });
  });

  describe("plan data", () => {
    it("shows the data of the plan, with the material as an external link", async () => {
      await renderDetail({
        plan: buildLessonPlanDetail({
          title: "Navegador e busca",
          objective: "Pesquisar com segurança.",
          expectedDurationMinutes: 135,
          contents: ["Abrir o navegador", "Fazer uma busca"],
          materialUrl: "https://exemplo.com/navegador",
        }),
      });

      const data = card("Dados do plano de aula");
      expect(valueOf(data, "Título")).toBe("Navegador e busca");
      expect(valueOf(data, "Duração prevista")).toBe("2h15");
      expect(valueOf(data, "Situação")).toBe("Sem uso");
      expect(valueOf(data, "Objetivo")).toBe("Pesquisar com segurança.");
      const contents = within(within(data).getByRole("list"));
      expect(contents.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
        "Abrir o navegador",
        "Fazer uma busca",
      ]);
      const link = within(data).getByRole("link", { name: /exemplo\.com\/navegador/ });
      expect(link).toHaveAttribute("href", "https://exemplo.com/navegador");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveAccessibleName("https://exemplo.com/navegador (abre em nova aba)");
    });

    it("shows the situation of a plan in use", async () => {
      await renderDetail({ plan: buildInUseLessonPlanDetail() });

      expect(valueOf(card("Dados do plano de aula"), "Situação")).toBe("Em uso");
    });

    it("shows a dash for the material and the objective that were not informed", async () => {
      await renderDetail({ plan: buildLessonPlanDetail({ materialUrl: null, objective: null }) });

      const data = card("Dados do plano de aula");
      expect(valueOf(data, "Material")).toBe("—");
      expect(valueOf(data, "Objetivo")).toBe("—");
      expect(within(data).queryByRole("link")).not.toBeInTheDocument();
    });

    it("shows who created the plan and when it last changed", async () => {
      await renderDetail({
        plan: buildLessonPlanDetail({
          createdAt: "2024-02-12T13:00:00.000Z",
          updatedAt: "2026-03-03T13:00:00.000Z",
        }),
      });

      const data = card("Dados do plano de aula");
      expect(valueOf(data, "Criado por")).toBe("Beatriz Nunes — 12/02/2024");
      expect(valueOf(data, "Última alteração")).toBe("03/03/2026");
      const history = card("Histórico");
      expect(valueOf(history, "Criado por")).toBe("Beatriz Nunes");
      expect(valueOf(history, "Última alteração")).toBe("03/03/2026");
    });

    it("says Não informado when the creator was removed", async () => {
      await renderDetail({
        plan: buildLessonPlanDetail({ createdBy: null, createdAt: "2024-02-12T13:00:00.000Z" }),
      });

      expect(valueOf(card("Dados do plano de aula"), "Criado por")).toBe(
        "Não informado — 12/02/2024",
      );
      expect(valueOf(card("Histórico"), "Criado por")).toBe("Não informado");
    });
  });

  describe("where the plan is used", () => {
    it("lists the courses that use the plan with the position and the category", async () => {
      await renderDetail({ plan: buildInUseLessonPlanDetail() });

      const table = within(screen.getByRole("table", { name: "Onde este plano é usado" }));
      expect(table.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
        "Curso",
        "Ordem no curso",
        "Categoria",
      ]);
      const [social, smartphones] = table.getAllByRole("row").slice(1);
      expect(
        within(social)
          .getAllByRole("cell")
          .map((cell) => cell.textContent),
      ).toEqual(["Redes Sociais com Segurança", "2 de 4", "Intermediário"]);
      expect(
        within(smartphones)
          .getAllByRole("cell")
          .map((cell) => cell.textContent),
      ).toEqual(["Smartphones no dia a diaCurso arquivado", "4 de 5", "Básico"]);
    });

    it("marks only the archived course as archived", async () => {
      await renderDetail({ plan: buildInUseLessonPlanDetail() });

      expect(screen.getAllByText("Curso arquivado")).toHaveLength(1);
    });

    it("explains that a change does not touch the classes in progress", async () => {
      await renderDetail({ plan: buildInUseLessonPlanDetail() });

      expect(card("Onde este plano é usado")).toHaveTextContent(
        "As turmas já em andamento não mudam: elas guardam a cópia do título e do objetivo feita na geração das aulas (RN-18).",
      );
    });

    it("says the plan is in no course when unused", async () => {
      await renderDetail();

      expect(
        within(card("Onde este plano é usado")).getByText(
          "Este plano ainda não faz parte de nenhum curso.",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("the course name links to /courses/:courseId", async () => {
      await renderDetail({ plan: buildInUseLessonPlanDetail() });

      const usage = card("Onde este plano é usado");
      expect(within(usage).getAllByRole("link")).toHaveLength(2);
      expect(
        within(usage).getByRole("link", { name: "Redes Sociais com Segurança" }),
      ).toHaveAttribute("href", `/courses/${COURSE_SOCIAL_NETWORKS.courseId}`);
      expect(within(usage).getByRole("link", { name: "Smartphones no dia a dia" })).toHaveAttribute(
        "href",
        `/courses/${COURSE_SMARTPHONES.courseId}`,
      );
      expect(within(usage).getByRole("link", { name: "Smartphones no dia a dia" })).toHaveClass(
        "min-h-11",
      );
      // The whole screen of the course ("Ver curso") is another task.
      expect(screen.queryByText("Ver curso")).not.toBeInTheDocument();
    });

    it("opens the plan of the course when its name is pressed", async () => {
      const user = userEvent.setup();
      server.use(listCourseLessonPlansHandler());
      await renderDetail({ plan: buildInUseLessonPlanDetail() });

      await user.click(
        within(card("Onde este plano é usado")).getByRole("link", {
          name: "Redes Sociais com Segurança",
        }),
      );

      expect(await screen.findByRole("heading", { name: "Plano do curso" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Conhecendo o WhatsApp" })).toBeInTheDocument();
    });

    it("keeps the course name as the text of the cell, with the archived tag after it", async () => {
      await renderDetail({ plan: buildInUseLessonPlanDetail() });

      const archived = within(card("Onde este plano é usado")).getByText("Curso arquivado");

      expect(archived.parentElement).toHaveTextContent("Smartphones no dia a diaCurso arquivado");
    });
  });

  describe("side cards", () => {
    it("shows the classes card as empty until the lessons module exists", async () => {
      await renderDetail({ plan: buildInUseLessonPlanDetail() });

      expect(
        within(card("Turmas que já usaram este plano")).getByText(
          "O histórico de turmas aparece aqui quando o módulo de aulas estiver disponível.",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText(/turmas já ofertadas/)).not.toBeInTheDocument();
    });

    it("shows how many courses a change affects", async () => {
      await renderDetail({ plan: buildInUseLessonPlanDetail() });

      expect(valueOf(card("Antes de alterar"), "Cursos afetados")).toBe("2");
    });

    it("shows zero affected courses for a plan nobody uses", async () => {
      await renderDetail();

      expect(valueOf(card("Antes de alterar"), "Cursos afetados")).toBe("0");
    });
  });

  describe("editing", () => {
    it("opens the edit form with the plan from the Editar plano button", async () => {
      server.use(getLessonPlanHandler({ response: buildLessonPlanDetail() }));
      const user = userEvent.setup();
      await renderDetail();

      await user.click(screen.getByRole("button", { name: "Editar plano" }));

      const dialog = await screen.findByRole("dialog", { name: "Editar plano de aula" });
      expect(await within(dialog).findByRole("textbox", { name: "Título do plano" })).toHaveValue(
        "Teclado, mouse e janelas",
      );
    });

    it("does not ask the usage when opening the page", async () => {
      const onUsage = vi.fn();
      server.use(getLessonPlanUsageHandler({ onCall: onUsage }));
      await renderDetail({ plan: buildInUseLessonPlanDetail() });

      expect(onUsage).not.toHaveBeenCalled();
    });

    it("does not ask the usage when only opening the edit form either", async () => {
      const onUsage = vi.fn();
      server.use(getLessonPlanUsageHandler({ onCall: onUsage }));
      const user = userEvent.setup();
      await renderDetail({ plan: buildInUseLessonPlanDetail() });

      await user.click(screen.getByRole("button", { name: "Editar plano" }));
      await screen.findByRole("textbox", { name: "Título do plano" });

      expect(onUsage).not.toHaveBeenCalled();
    });

    it("gives the focus back to Editar plano when the form is cancelled", async () => {
      const user = userEvent.setup();
      await renderDetail();
      await user.click(screen.getByRole("button", { name: "Editar plano" }));
      await screen.findByRole("textbox", { name: "Título do plano" });

      await user.click(screen.getByRole("button", { name: "Cancelar" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Editar plano" })).toHaveFocus(),
      );
    });

    it("saves an unused plan with a new duration without the confirmation dialog", async () => {
      const onUsage = vi.fn();
      const onUpdate = vi.fn();
      server.use(
        getLessonPlanUsageHandler({ onCall: onUsage }),
        updateLessonPlanHandler({ response: buildLessonPlan(), onCall: onUpdate }),
      );
      const user = userEvent.setup();
      await renderDetail({ plan: buildLessonPlanDetail() });
      await user.click(screen.getByRole("button", { name: "Editar plano" }));
      await changeDuration(user, "2", "0");

      await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

      expect(await screen.findByText("Plano de aula atualizado.")).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(
        screen.queryByRole("dialog", { name: "Confirmar alteração do plano" }),
      ).not.toBeInTheDocument();
      expect(onUpdate).toHaveBeenCalledTimes(1);
      expect(onUpdate.mock.calls[0]?.[0].body.expectedDurationMinutes).toBe(120);
      expect(onUsage).not.toHaveBeenCalled();
    });

    it("asks for confirmation with the new workload of each course before saving a plan in use", async () => {
      const onUsage = vi.fn();
      const onUpdate = vi.fn();
      const onGet = vi.fn();
      const updatedPlan = buildInUseLessonPlanDetail({
        expectedDurationMinutes: 120,
        updatedAt: "2026-10-20T13:00:00.000Z",
      });
      server.use(
        getLessonPlanHandler({ response: buildInUseLessonPlanDetail(), onCall: onGet }),
        getLessonPlanUsageHandler({ onCall: onUsage }),
        updateLessonPlanHandler({
          response: buildLessonPlan({ expectedDurationMinutes: 120 }),
          onCall: (call) => {
            onUpdate(call);
            server.use(getLessonPlanHandler({ response: updatedPlan, onCall: onGet }));
          },
        }),
      );
      const user = userEvent.setup();
      await renderRoutes(catalogRoutes, { route: DETAIL_ROUTE });
      await screen.findByRole("heading", { name: "Dados do plano de aula" });
      expect(valueOf(card("Dados do plano de aula"), "Duração prevista")).toBe("1h30");
      await user.click(screen.getByRole("button", { name: "Editar plano" }));
      await changeDuration(user, "2", "0");

      await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

      const confirmation = await screen.findByRole("dialog", {
        name: "Confirmar alteração do plano",
      });
      expect(onUsage).toHaveBeenCalledWith({ id: LESSON_PLAN_ID, expectedDurationMinutes: 120 });
      expect(onUpdate).not.toHaveBeenCalled();
      const rows = within(confirmation).getAllByRole("row").slice(1);
      expect(
        rows.map((row) =>
          within(row)
            .getAllByRole("cell")
            .map((cell) => cell.textContent),
        ),
      ).toEqual([
        ["Redes Sociais com SegurançaItem 2 de 4", "7h05", "7h35"],
        ["Smartphones no dia a diaItem 4 de 5", "8h30", "9h"],
      ]);
      expect(
        within(confirmation).getByText(
          "Duração prevista: 1h30 → 2h. A carga horária de cada curso é recalculada.",
        ),
      ).toBeInTheDocument();
      const callsBeforeSaving = onGet.mock.calls.length;

      await user.click(within(confirmation).getByRole("button", { name: "Salvar alteração" }));

      expect(await screen.findByText("Plano de aula atualizado.")).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(onUpdate).toHaveBeenCalledTimes(1);
      expect(onUpdate.mock.calls[0]?.[0]).toMatchObject({
        id: LESSON_PLAN_ID,
        body: { expectedDurationMinutes: 120 },
      });
      await waitFor(() => expect(onGet.mock.calls.length).toBeGreaterThan(callsBeforeSaving));
      await waitFor(() =>
        expect(valueOf(card("Dados do plano de aula"), "Duração prevista")).toBe("2h"),
      );
      expect(within(headerTags()).getByText("2h previstos")).toBeInTheDocument();
      expect(valueOf(card("Dados do plano de aula"), "Última alteração")).toBe("20/10/2026");
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Editar plano" })).toHaveFocus(),
      );
    });

    it("goes back to the form and keeps the page as it was when the person gives up", async () => {
      const onUpdate = vi.fn();
      server.use(getLessonPlanUsageHandler(), updateLessonPlanHandler({ onCall: onUpdate }));
      const user = userEvent.setup();
      await renderDetail({ plan: buildInUseLessonPlanDetail() });
      await user.click(screen.getByRole("button", { name: "Editar plano" }));
      await changeDuration(user, "2", "0");
      await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
      const confirmation = await screen.findByRole("dialog", {
        name: "Confirmar alteração do plano",
      });

      await user.click(within(confirmation).getByRole("button", { name: "Voltar" }));

      expect(
        await screen.findByRole("dialog", { name: "Editar plano de aula" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Horas" })).toHaveValue("2");
      expect(onUpdate).not.toHaveBeenCalled();
      expect(valueOf(card("Dados do plano de aula"), "Duração prevista")).toBe("1h30");
    });
  });
});
