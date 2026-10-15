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
    expect(screen.getByRole("link", { name: /Turma 2026\.2/ })).toBeInTheDocument();
    expect(screen.getByText("12/15")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Ações" })).toBeInTheDocument();
    expect(screen.getByText("Mostrando 10 de 12 turmas")).toBeInTheDocument();
  });

  it("applies search and supports creating a local record", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(
      screen.getByRole("textbox", { name: "Buscar por código, turma ou curso" }),
      "TUR-2025.2",
    );
    expect(screen.getByRole("link", { name: /Turma 2025\.2/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Turma 2026\.2/ })).not.toBeInTheDocument();
    await user.clear(screen.getByRole("textbox", { name: "Buscar por código, turma ou curso" }));
    await user.click(screen.getByRole("button", { name: "+ Nova turma" }));
    expect(screen.getByRole("dialog", { name: "Nova turma" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Curso/ })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Edição" })).toBeInTheDocument();
    expect(screen.getByLabelText("Local")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Status/ })).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Código da turma" }), "TUR-NEW");
    await user.click(screen.getByRole("button", { name: "Salvar turma" }));
    expect(await screen.findByRole("link", { name: "TUR-NEW" })).toBeInTheDocument();
  }, 10000);

  it("initializes the course filter from the URL and clears unmatched search", async () => {
    renderPage("/classes?courseId=internet");
    expect(screen.getByRole("link", { name: /Turma 2025\.2/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Turma 2026\.2/ })).not.toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: "Buscar por código, turma ou curso" });
    fireEvent.change(input, { target: { value: "impossível" } });
    const state = await screen.findByText("Nada encontrado");
    expect(state).toBeInTheDocument();
    await userEvent.click(
      within(state.parentElement as HTMLElement).getByRole("button", { name: "Limpar filtros" }),
    );
    expect(await screen.findByRole("link", { name: /Turma 2026\.2/ })).toBeInTheDocument();
  });

  it.each([
    ["loading", "Carregando turmas…"],
    ["error", "Não foi possível carregar as turmas"],
    ["empty", "Nenhuma turma ainda"],
  ])("shows only the %s state and keeps filters available", (state, label) => {
    renderPage(`/classes?mockState=${state}&courseId=internet`);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Turma" })).toBeInTheDocument();
  });

  it("shows Brazilian date formatting and supports cancelling an edit", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByText("03/03/26 - 27/05/26")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    await user.clear(screen.getByRole("textbox", { name: "Código da turma" }));
    await user.type(
      screen.getByRole("textbox", { name: "Código da turma" }),
      "ALTERACAO-DESCARTADA",
    );
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Turma 2026.2" })).toBeInTheDocument();
  });

  it("saves edits locally without changing the class name", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    fireEvent.change(screen.getByLabelText(/Data de início/), {
      target: { value: "2026-03-04" },
    });
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByText("04/03/26 - 27/05/26")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Turma 2026.2" })).toBeInTheDocument();
  });

  it("blocks a class whose end date is before its start date", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "+ Nova turma" }));
    await user.type(screen.getByRole("textbox", { name: "Código da turma" }), "INFO-NEW");
    fireEvent.change(screen.getByLabelText(/Data de início/), {
      target: { value: "2026-06-27" },
    });
    fireEvent.change(screen.getByLabelText(/Data de término/), {
      target: { value: "2026-03-03" },
    });
    await user.click(screen.getByRole("button", { name: "Salvar turma" }));
    expect(
      await screen.findByText("A data de término deve ser igual ou posterior à data de início."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "INFO-NEW" })).not.toBeInTheDocument();
  });

  it("uses two pages for twelve mock classes", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByRole("button", { name: "Página 2" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Página 3" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Página 2" }));
    expect(screen.getByRole("link", { name: "Mensagens e contatos" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Turma 2026.2" })).not.toBeInTheDocument();
  });

  it("archives and restores a class without deleting it", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getAllByRole("button", { name: "Arquivar" })[0]);
    expect(screen.getByRole("dialog", { name: "Deseja arquivar esta turma?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Arquivar" }));
    expect(screen.queryByRole("link", { name: /Turma 2026\.2/ })).not.toBeInTheDocument();
    await user.click(screen.getByText(/^Status:/));
    await user.click(screen.getByRole("checkbox", { name: "Arquivadas" }));
    expect(screen.getByRole("link", { name: /Turma 2026\.2/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Restaurar" }));
    expect(screen.queryByRole("link", { name: /Turma 2026\.2/ })).not.toBeInTheDocument();
  });

  it("shows active classes when more than one status is selected", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByText(/^Status:/));
    await user.click(screen.getByRole("checkbox", { name: "Planejada" }));
    await user.click(screen.getByRole("checkbox", { name: "Em andamento" }));
    expect(screen.getByRole("link", { name: /Turma 2026\.2/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Turma 2024/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Informática Básica — B/ })).not.toBeInTheDocument();
  });

  it("retries the mock error state", async () => {
    const user = userEvent.setup();
    renderPage("/classes?mockState=error");
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByRole("link", { name: /Turma 2026\.2/ })).toBeInTheDocument();
  });
});
