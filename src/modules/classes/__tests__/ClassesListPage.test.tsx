import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import "../index";
import i18n from "@shared/i18n";
import { ClassesListPage } from "../pages/ClassesListPage";

function renderPage(route = "/classes") {
  void i18n.changeLanguage("pt-BR");
  window.history.replaceState({}, "", route);
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ClassesListPage />
    </MemoryRouter>,
  );
}

describe("classes list", () => {
  it("renders mock rows, seats, status and pagination", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Turmas (12)" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Celular para iniciantes/ })).toBeInTheDocument();
    expect(screen.getByText("18/20")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Ações" })).toBeInTheDocument();
    expect(screen.getByText("Mostrando 10 de 12 turmas")).toBeInTheDocument();
  });

  it("applies search and supports creating a local record", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(
      screen.getByRole("textbox", { name: "Buscar por código, turma ou curso" }),
      "TUR-002",
    );
    expect(screen.getByRole("link", { name: /Internet e comunicação/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Celular para iniciantes/ })).not.toBeInTheDocument();
    await user.clear(screen.getByRole("textbox", { name: "Buscar por código, turma ou curso" }));
    await user.click(screen.getByRole("button", { name: "+ Nova turma" }));
    await user.type(screen.getByRole("textbox", { name: "Código" }), "TUR-NEW");
    await user.type(screen.getByRole("textbox", { name: "Nome da turma" }), "Turma de teste");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("link", { name: /Turma de teste/ })).toBeInTheDocument();
  }, 10000);

  it("initializes the course filter from the URL and clears unmatched search", async () => {
    renderPage("/classes?courseId=internet");
    expect(screen.getByRole("link", { name: /Internet e comunicação/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Celular para iniciantes/ })).not.toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: "Buscar por código, turma ou curso" });
    fireEvent.change(input, { target: { value: "impossível" } });
    const state = await screen.findByText("Nada encontrado");
    expect(state).toBeInTheDocument();
    await userEvent.click(
      within(state.parentElement as HTMLElement).getByRole("button", { name: "Limpar filtros" }),
    );
    expect(
      await screen.findByRole("link", { name: /Celular para iniciantes/ }),
    ).toBeInTheDocument();
  });

  it.each([
    ["loading", "Carregando turmas…"],
    ["error", "Não foi possível carregar as turmas"],
    ["empty", "Nenhuma turma ainda"],
  ])("shows only the %s state and keeps filters available", (state, label) => {
    renderPage(`/classes?mockState=${state}&courseId=internet`);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Curso/ })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows Brazilian date formatting and supports cancelling an edit", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByText("02/02/26 - 30/06/26")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    await user.clear(screen.getByRole("textbox", { name: "Nome da turma" }));
    await user.type(screen.getByRole("textbox", { name: "Nome da turma" }), "Alteração descartada");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Alteração descartada")).not.toBeInTheDocument();
  });

  it("archives and restores a class without deleting it", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getAllByRole("button", { name: "Excluir" })[0]);
    expect(screen.getByRole("dialog", { name: "Deseja arquivar esta turma?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Arquivar" }));
    expect(screen.queryByRole("link", { name: /Celular para iniciantes/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Status/ }));
    await user.click(await screen.findByRole("option", { name: "Arquivadas" }));
    expect(screen.getByRole("link", { name: /Celular para iniciantes/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Restaurar" }));
    expect(screen.queryByRole("link", { name: /Celular para iniciantes/ })).not.toBeInTheDocument();
  });
});
