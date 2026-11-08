import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { Role } from "@shared/lib/role";

import { LessonPlansPage } from "../pages/LessonPlansPage";
import { buildLessonPlan, buildMeUser, createLessonPlanHandler } from "./handlers";
import { renderWithProviders, server, setupCatalogTestServer } from "./test-utils";

setupCatalogTestServer();

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="current-location">{`${location.pathname}${location.search}`}</output>;
}

async function renderPage(route = "/lesson-plans", user = buildMeUser(Role.coordinator)) {
  return renderWithProviders(
    <>
      <LessonPlansPage />
      <LocationProbe />
    </>,
    { route, user },
  );
}

describe("LessonPlansPage", () => {
  it("renders the GUS-171 mocked rows, filters, columns and pagination summary", async () => {
    await renderPage();

    expect(await screen.findByRole("heading", { name: "Planos de aula (14)" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toHaveAccessibleName("Planos de aula (14)");
    expect(screen.getByRole("columnheader", { name: "PLANO DE AULA" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "TURMAS QUE JÁ USARAM" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enviar um áudio no WhatsApp" })).toBeInTheDocument();
    expect(screen.getByText("4 turmas")).toBeInTheDocument();
    expect(
      screen.getAllByLabelText("Contagem de turmas disponível quando o módulo de aulas existir"),
    ).toHaveLength(2);
    expect(screen.getByText("Mostrando 7 de 14 planos de aula")).toBeInTheDocument();
  });

  it("filters fixture rows by title and mirrors the search in the URL", async () => {
    const user = userEvent.setup();
    await renderPage();

    const search = screen.getByRole("textbox", { name: "Buscar plano de aula por título" });
    await user.type(search, "AUDIO");

    expect(screen.getByRole("link", { name: "Enviar um áudio no WhatsApp" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Conhecendo o computador" })).not.toBeInTheDocument();
    expect(screen.getByTestId("current-location").textContent).toContain("search=AUDIO");
  });

  it("applies content, duration and usage filters from the URL", async () => {
    await renderPage("/lesson-plans?content=C%C3%A2mera+e+fotos&usage=unused");
    expect(screen.getByRole("link", { name: "Fotos no celular" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Navegando na internet" })).not.toBeInTheDocument();

    await renderPage("/lesson-plans?minDuration=121");
    expect(screen.getByRole("link", { name: "Reconhecendo golpes" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Teclado, mouse e janelas" }),
    ).not.toBeInTheDocument();

    await renderPage("/lesson-plans?usage=archived");
    expect(screen.getByRole("link", { name: "Noções de segurança digital" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Enviar um áudio no WhatsApp" }),
    ).not.toBeInTheDocument();
  });

  it("resets the page when a filter changes and persists pagination in the URL", async () => {
    const user = userEvent.setup();
    await renderPage("/lesson-plans?page=2");

    await user.type(
      screen.getByRole("textbox", { name: "Buscar plano de aula por título" }),
      "internet",
    );
    expect(screen.getByTestId("current-location").textContent).toContain("search=internet");
    expect(screen.getByTestId("current-location").textContent).not.toContain("page=2");

    await user.clear(screen.getByRole("textbox", { name: "Buscar plano de aula por título" }));
    await user.click(screen.getByRole("button", { name: "Página 2" }));
    expect(screen.getByTestId("current-location").textContent).toBe("/lesson-plans?page=2");
    expect(screen.getByRole("link", { name: "Mapas e localização" })).toBeInTheDocument();
  });

  it("shows no-results and clears filters", async () => {
    const user = userEvent.setup();
    await renderPage("/lesson-plans?search=plano-inexistente&content=Conte%C3%BAdo+fantasma");

    expect(screen.getByRole("heading", { name: "Nada encontrado" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));

    expect(screen.getByRole("link", { name: "Conhecendo o computador" })).toBeInTheDocument();
    expect(screen.getByTestId("current-location").textContent).toBe("/lesson-plans");
  });

  it.each([
    ["empty", "Nenhum plano de aula ainda"],
    ["loading", "Carregando planos de aula…"],
    ["error", "Não foi possível carregar os planos de aula"],
  ])("shows the %s mock state", async (mockState, expectedText) => {
    await renderPage(`/lesson-plans?mockState=${mockState}`);
    expect(screen.getByText(expectedText)).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "PLANO DE AULA" })).toBeInTheDocument();
  });

  it("retries the mock error state", async () => {
    const user = userEvent.setup();
    await renderPage("/lesson-plans?mockState=error");

    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(screen.getByRole("link", { name: "Conhecendo o computador" })).toBeInTheDocument();
  });

  it.each([
    ["coordinator", Role.coordinator],
    ["director", Role.director],
  ])("the %s sees the API-backed create action", async (_label, role) => {
    await renderPage("/lesson-plans", buildMeUser(role));
    expect(screen.getByRole("button", { name: "+ Novo plano de aula" })).toBeInTheDocument();
  });

  it("the member does not see create, edit or archive actions", async () => {
    await renderPage("/lesson-plans", buildMeUser(Role.member));

    expect(screen.queryByRole("button", { name: "+ Novo plano de aula" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar plano de aula:/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Arquivar plano de aula:/ }),
    ).not.toBeInTheDocument();
  });

  it("opens and cancels the API-backed create form", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("button", { name: "+ Novo plano de aula" }));
    expect(await screen.findByRole("dialog", { name: "Novo plano de aula" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "+ Novo plano de aula" })).toHaveFocus(),
    );
  });

  it("creates a plan through the API, shows the success toast and opens its detail", async () => {
    const onCall = vi.fn();
    const created = buildLessonPlan({ title: "Plano novo" });
    server.use(createLessonPlanHandler({ response: created, onCall }));
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("button", { name: "+ Novo plano de aula" }));
    await screen.findByRole("dialog", { name: "Novo plano de aula" });
    await user.type(screen.getByRole("textbox", { name: "Título do plano" }), "Plano novo");
    await user.type(screen.getByRole("textbox", { name: "Horas" }), "1");
    await user.type(screen.getByRole("textbox", { name: "Minutos" }), "30");
    await user.type(screen.getByRole("textbox", { name: "Conteúdo 1" }), "Teclado e mouse");

    await user.click(screen.getByRole("button", { name: "Salvar plano" }));

    expect(await screen.findByText("Plano de aula criado.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onCall).toHaveBeenCalledWith({
      body: {
        title: "Plano novo",
        objective: null,
        expectedDurationMinutes: 90,
        contents: ["Teclado e mouse"],
        materialUrl: null,
      },
    });
    expect(screen.getByTestId("current-location").textContent).toBe(`/lesson-plans/${created.id}`);
  });

  it("keeps the API-backed create form open when required fields are invalid", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("button", { name: "+ Novo plano de aula" }));
    await screen.findByRole("dialog", { name: "Novo plano de aula" });
    await user.click(screen.getByRole("button", { name: "Salvar plano" }));

    expect(await screen.findByText("Informe o título do plano.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Novo plano de aula" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Título do plano" })).toHaveFocus(),
    );
  });

  it("opens and closes mock edit/archive previews without sending API mutations", async () => {
    const user = userEvent.setup();
    await renderPage();

    const row = screen.getByRole("row", { name: /Enviar um áudio no WhatsApp/ });
    await user.click(within(row).getByRole("button", { name: /Editar plano de aula:/ }));
    expect(screen.getByRole("dialog", { name: "Editar plano de aula" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(within(row).getByRole("button", { name: /Arquivar plano de aula:/ }));
    expect(screen.getByRole("dialog", { name: "Arquivar plano de aula" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Arquivar plano" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("navigates from a row cell but keeps material links and actions separate", async () => {
    const user = userEvent.setup();
    await renderPage();
    const row = screen.getByRole("row", { name: /Enviar um áudio no WhatsApp/ });

    await user.click(
      within(row).getByRole("link", { name: "Abrir material de Enviar um áudio no WhatsApp" }),
    );
    expect(screen.getByTestId("current-location").textContent).toBe("/lesson-plans");

    await user.click(within(row).getByText("WhatsApp: mensagens e áudios"));
    expect(screen.getByTestId("current-location").textContent).toBe("/lesson-plans/lesson-plan-04");
  });
});
