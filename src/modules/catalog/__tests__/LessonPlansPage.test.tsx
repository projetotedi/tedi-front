import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@shared/i18n";

const permissionMock = vi.hoisted(() => ({ canManage: true }));

vi.mock("@modules/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@modules/auth")>();
  return {
    ...actual,
    useCan: () => permissionMock.canManage,
  };
});

import "../index";
import { LessonPlansPage } from "../pages/LessonPlansPage";

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="current-location">{`${location.pathname}${location.search}`}</output>;
}

async function renderPage(route = "/lesson-plans") {
  await i18n.changeLanguage("pt-BR");

  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <LessonPlansPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LessonPlansPage (mock UI)", () => {
  beforeEach(() => {
    permissionMock.canManage = true;
  });

  it("renders the mocked plan list, columns and pagination summary", async () => {
    renderPage();

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
    expect(screen.getByRole("button", { name: "+ Novo plano de aula" })).toBeInTheDocument();
  });

  it("filters mock rows by title without accents and mirrors search in the URL", async () => {
    const user = userEvent.setup();
    await renderPage();

    const search = screen.getByRole("textbox", { name: "Buscar plano de aula por título" });
    await user.type(search, "AUDIO");

    expect(screen.getByRole("link", { name: "Enviar um áudio no WhatsApp" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Conhecendo o computador" })).not.toBeInTheDocument();
    expect(screen.getByTestId("current-location").textContent).toContain("search=AUDIO");

    await user.clear(search);
    await user.type(search, "GOLPES");
    expect(screen.getByRole("link", { name: "Reconhecendo golpes" })).toBeInTheDocument();
  });

  it("applies the content filter from the URL", async () => {
    await renderPage("/lesson-plans?content=C%C3%A2mera+e+fotos&usage=unused");
    expect(screen.getByRole("link", { name: "Fotos no celular" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Navegando na internet" })).not.toBeInTheDocument();
  });

  it("applies the duration filter from the URL", async () => {
    await renderPage("/lesson-plans?minDuration=121");
    expect(screen.getByRole("link", { name: "Reconhecendo golpes" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Teclado, mouse e janelas" }),
    ).not.toBeInTheDocument();
  });

  it("shows archived plans only when usage=archived", async () => {
    await renderPage("/lesson-plans?usage=archived");
    expect(screen.getByRole("link", { name: "Noções de segurança digital" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Enviar um áudio no WhatsApp" }),
    ).not.toBeInTheDocument();
  });

  it("updates filter parameters and resets the page", async () => {
    const user = userEvent.setup();
    await renderPage("/lesson-plans?page=2");

    await user.type(
      screen.getByRole("textbox", { name: "Buscar plano de aula por título" }),
      "internet",
    );

    const url = screen.getByTestId("current-location").textContent ?? "";
    expect(url).toContain("search=internet");
    expect(url).not.toContain("page=2");
  });

  it("paginates the mock data and persists the selected page in the URL", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("button", { name: "Página 2" }));

    expect(screen.getByRole("link", { name: "Mapas e localização" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Conhecendo o computador" })).not.toBeInTheDocument();
    expect(screen.getByTestId("current-location").textContent).toBe("/lesson-plans?page=2");
  });

  it("shows a no-results state and clears all mock filters", async () => {
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
  ])("shows the %s state while keeping filters visible", async (mockState, expectedText) => {
    await renderPage(`/lesson-plans?mockState=${mockState}`);

    expect(screen.getByText(expectedText)).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Buscar plano de aula por título" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "PLANO DE AULA" })).toBeInTheDocument();
  });

  it("retries the mock error state", async () => {
    const user = userEvent.setup();
    await renderPage("/lesson-plans?mockState=error");

    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(screen.getByRole("link", { name: "Conhecendo o computador" })).toBeInTheDocument();
  });

  it("opens and closes the create, edit and archive mock dialogs without persisting data", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("button", { name: "+ Novo plano de aula" }));
    expect(screen.getByRole("dialog", { name: "Novo plano de aula" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Salvar plano" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Planos de aula (14)" })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /Editar plano de aula:/ })[0]);
    expect(screen.getByRole("dialog", { name: "Editar plano de aula" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /Arquivar plano de aula:/ })[0]);
    expect(screen.getByRole("dialog", { name: "Arquivar plano de aula" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Arquivar plano" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Planos de aula (14)" })).toBeInTheDocument();
  });

  it("hides create, edit and archive actions for a member", async () => {
    permissionMock.canManage = false;
    await renderPage();

    expect(screen.queryByRole("button", { name: "+ Novo plano de aula" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar plano de aula:/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Arquivar plano de aula:/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps material links and row actions separate from the row-detail target", async () => {
    const user = userEvent.setup();
    await renderPage();
    const row = screen.getByRole("row", { name: /Enviar um áudio no WhatsApp/ });

    await user.click(within(row).getByRole("button", { name: /Editar plano de aula:/ }));
    expect(screen.getByRole("dialog", { name: "Editar plano de aula" })).toBeInTheDocument();
    expect(screen.getByTestId("current-location").textContent).toBe("/lesson-plans");
  });

  it("opens the mock detail destination when clicking a non-action row cell", async () => {
    const user = userEvent.setup();
    await renderPage();
    const row = screen.getByRole("row", { name: /Enviar um áudio no WhatsApp/ });

    await user.click(within(row).getByText("WhatsApp: mensagens e áudios"));

    expect(screen.getByTestId("current-location").textContent).toBe("/lesson-plans/lesson-plan-04");
  });

  it("keeps the material link from opening the row detail", async () => {
    const user = userEvent.setup();
    await renderPage();
    const row = screen.getByRole("row", { name: /Enviar um áudio no WhatsApp/ });

    await user.click(
      within(row).getByRole("link", { name: "Abrir material de Enviar um áudio no WhatsApp" }),
    );

    expect(screen.getByTestId("current-location").textContent).toBe("/lesson-plans");
  });
});
