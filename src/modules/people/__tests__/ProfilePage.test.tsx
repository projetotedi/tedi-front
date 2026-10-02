import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MeResponseDto } from "@api/generated/model";
import { AuthProvider } from "@modules/auth";
import { buildMeUser, meHandler } from "@modules/auth/__tests__/handlers";
import {
  renderWithProviders,
  server,
  setupAuthTestServer,
} from "@modules/auth/__tests__/test-utils";
import { Role } from "@shared/lib/role";

// Registra o namespace "people".
import "../index";
import { ProfilePage } from "../pages/ProfilePage";

setupAuthTestServer();

async function renderProfile(user: MeResponseDto) {
  server.use(meHandler({ user }));
  await renderWithProviders(
    <AuthProvider>
      <ProfilePage />
    </AuthProvider>,
  );
  return screen.findByText(user.name, { selector: "p" });
}

/** As células da linha da tabela cujo nome acessível (o texto da linha) casa com `name`. */
function cellsOfRow(table: HTMLElement, name: RegExp): HTMLElement[] {
  return within(within(table).getByRole("row", { name })).getAllByRole("cell");
}

describe("ProfilePage", () => {
  it("shows the signed in user name in the header card", async () => {
    const name = await renderProfile(buildMeUser({ name: "Maria" }));

    expect(name).toHaveTextContent("Maria");
    expect(screen.queryByText("Ana Paula Torres")).not.toBeInTheDocument();
  });

  it("shows the session role and RA", async () => {
    await renderProfile(
      buildMeUser({ role: Role.director, ra: "202400001" as unknown as MeResponseDto["ra"] }),
    );

    expect(screen.getAllByText("Diretor").length).toBeGreaterThan(0);
    expect(screen.getByText("RA 202400001")).toBeInTheDocument();
  });

  it("uses a dash when the session has no RA", async () => {
    await renderProfile(buildMeUser({ ra: null }));

    expect(screen.queryByText(/^RA \d/)).not.toBeInTheDocument();
    const academic = screen.getByRole("heading", { name: "Dados acadêmicos e institucionais" });
    const card = academic.closest("[data-slot='card']") as HTMLElement;
    expect(within(card).getByText("—")).toBeInTheDocument();
  });

  it("renders every section of the prototype and flags the sample data", async () => {
    await renderProfile(buildMeUser());

    expect(screen.getByText(/Dados de exemplo/)).toBeInTheDocument();
    for (const title of [
      "Meus lançamentos",
      "Horas por categoria",
      "Informações pessoais",
      "Dados acadêmicos e institucionais",
      "Conta e acesso",
    ]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(screen.getByText("Total de horas lançadas")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Meus lançamentos" })).toBeInTheDocument();
  });

  it("keeps the modal actions disabled and offers sign out", async () => {
    await renderProfile(buildMeUser());

    expect(screen.getByRole("button", { name: "Editar meus dados" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Lançar horas" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sair do sistema" })).toBeEnabled();
  });

  it("shows the summary cards in hours", async () => {
    await renderProfile(buildMeUser());

    const summary = screen.getByRole("region", { name: "Resumo de horas" });
    const hoursByLabel = {
      "Total de horas lançadas": "58h",
      "Horas validadas": "48h",
      "Pendentes de validação": "8h",
      "Ajustadas / rejeitadas": "2h",
    };
    for (const [label, hours] of Object.entries(hoursByLabel)) {
      const card = within(summary).getByText(label).closest("li") as HTMLElement;
      expect(within(card).getByText(hours)).toBeInTheDocument();
    }
  });

  it("shows declared and validated time in hours", async () => {
    await renderProfile(buildMeUser());

    const table = screen.getByRole("table", { name: "Meus lançamentos" });

    const adjusted = cellsOfRow(table, /Planejamento de conteúdo do bimestre/);
    expect(adjusted[3]).toHaveTextContent(/^3h$/);
    expect(adjusted[4]).toHaveTextContent(/^2h$/);

    const notValidated = cellsOfRow(table, /Feira de tecnologia/);
    expect(notValidated[3]).toHaveTextContent(/^4h$/);
    expect(notValidated[4]).toHaveTextContent(/^—$/);

    const rejected = cellsOfRow(table, /Material de apoio sem comprovação/);
    expect(rejected[3]).toHaveTextContent(/^2h$/);
    expect(rejected[4]).toHaveTextContent(/^0h$/);
  });

  it("lists the category table columns without a status column", async () => {
    await renderProfile(buildMeUser());

    const table = screen.getByRole("table", { name: "Horas por categoria" });

    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Categoria", "Horas", "Pendentes", "Observação"]);
  });

  it("shows pending hours as a tag and a dash when nothing is pending", async () => {
    await renderProfile(buildMeUser());

    const table = screen.getByRole("table", { name: "Horas por categoria" });

    const planning = cellsOfRow(table, /^Planejamento/);
    expect(planning[1]).toHaveTextContent(/^8h$/);
    expect(within(planning[2]).getByText("8h")).toHaveAttribute("aria-hidden", "true");
    expect(within(planning[2]).getByText("8 horas pendentes")).toBeInTheDocument();

    const lesson = cellsOfRow(table, /^Aula/);
    expect(lesson[1]).toHaveTextContent(/^28h$/);
    expect(within(lesson[2]).getByText("—")).toHaveAttribute("aria-hidden", "true");
    expect(within(lesson[2]).getByText("Sem pendência")).toBeInTheDocument();

    expect(within(table).queryByText(/Validado|Ajustado/)).not.toBeInTheDocument();
  });

  it("never shows a duration in minutes", async () => {
    await renderProfile(buildMeUser());

    expect(screen.queryByText(/\d+\s*min\b/)).not.toBeInTheDocument();
  });
});
