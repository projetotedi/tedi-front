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
});
