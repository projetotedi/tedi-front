import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { MyProfileResponseDto } from "@api/generated/model";
import { getGetMyProfileQueryKey } from "@api/generated/people/people";
import { AuthProvider } from "@modules/auth";
import { meHandler } from "@modules/auth/__tests__/handlers";
import {
  renderWithProviders,
  server,
  setupAuthTestServer,
} from "@modules/auth/__tests__/test-utils";
import { Role } from "@shared/lib/role";

// Registers the "people" namespace.
import "../index";
import { ProfilePage } from "../pages/ProfilePage";
import { buildMyProfile, buildSeedProfile, myProfileHandler } from "./handlers";
import { STUB_PROFILE_PAGE_PROPS } from "./test-routes";

setupAuthTestServer();

function renderPage() {
  return renderWithProviders(
    <AuthProvider>
      <ProfilePage {...STUB_PROFILE_PAGE_PROPS} />
    </AuthProvider>,
  );
}

/** Whether `first` comes before `second` in the order of the document. */
function isBefore(first: Node, second: Node): boolean {
  return (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

/**
 * Renders the page with the profile and waits for it to be ready: the name of the header and the
 * sign out button, which only exists once `GET /auth/me` has answered too.
 */
async function renderProfile(profile: MyProfileResponseDto = buildMyProfile()) {
  server.use(meHandler(), myProfileHandler({ profile }));
  const view = await renderPage();
  await screen.findByText(profile.name, { selector: "p" });
  await screen.findByRole("button", { name: "Sair do sistema" });
  return view;
}

/** The value (`<dd>`) of the field `label` (`<dt>`). */
function valueOf(label: string): HTMLElement {
  const value = screen.getByText(label, { selector: "dt" }).nextElementSibling;
  if (!(value instanceof HTMLElement)) throw new Error(`No value for "${label}"`);
  return value;
}

/** The block of the header that holds the name of the person and the chips under it. */
function headerOf(name: string): HTMLElement {
  const block = screen.getByText(name, { selector: "p" }).parentElement;
  if (!(block instanceof HTMLElement)) throw new Error("No header around the name");
  return block;
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("ProfilePage", () => {
  it("shows the name of the profile in the header card", async () => {
    await renderProfile(buildMyProfile({ name: "Maria" }));

    expect(screen.getByText("Maria", { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByText("Ana Torres")).not.toBeInTheDocument();
  });

  it("shows the role and RA of the profile", async () => {
    await renderProfile(buildMyProfile({ role: Role.director, ra: "202400001" }));

    expect(screen.getAllByText("Diretor").length).toBeGreaterThan(0);
    expect(screen.getByText("RA 202400001")).toBeInTheDocument();
    expect(valueOf("RA")).toHaveTextContent(/^202400001$/);
  });

  it("uses a dash when the profile has no RA", async () => {
    await renderProfile(buildMyProfile({ ra: null }));

    expect(screen.queryByText(/^RA /)).not.toBeInTheDocument();
    expect(valueOf("RA")).toHaveTextContent("—");
    expect(valueOf("RA")).toHaveTextContent("Não informado");
  });

  it("renders the three sections of the registration and the places of the hours", async () => {
    await renderProfile();

    for (const title of [
      "Informações pessoais",
      "Dados acadêmicos e institucionais",
      "Conta e acesso",
    ]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(screen.getByRole("region", { name: "Resumo de horas (slot)" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Cards de horas (slot)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ação de horas (slot)" })).toBeInTheDocument();
  });

  it("puts the hours summary between the header and the columns, and the hours cards at the top of the main column", async () => {
    await renderProfile();

    const name = screen.getByText("Ana Torres", { selector: "p" });
    const summary = screen.getByRole("region", { name: "Resumo de horas (slot)" });
    const cards = screen.getByRole("region", { name: "Cards de horas (slot)" });
    const personal = screen.getByRole("heading", { name: "Informações pessoais" });

    expect(isBefore(name, summary)).toBe(true);
    expect(isBefore(summary, cards)).toBe(true);
    expect(isBefore(cards, personal)).toBe(true);
    // The cards open the main column: nothing comes before them in it.
    expect(cards.parentElement?.firstElementChild).toBe(cards);
  });

  it("shows the registration of an approved member", async () => {
    await renderProfile();

    const chips = within(headerOf("Ana Torres"));
    expect(chips.getByText("Tecnologia")).toBeInTheDocument();
    expect(chips.getByText("Desde 01/10/2026")).toBeInTheDocument();
    expect(chips.getByText("RA a2210001")).toBeInTheDocument();

    expect(valueOf("Nome completo")).toHaveTextContent(/^Ana Torres$/);
    expect(valueOf("Data de nascimento")).toHaveTextContent(/^22\/07\/1999$/);
    expect(valueOf("E-mail pessoal")).toHaveTextContent(/^ana\.torres@example\.com$/);
    expect(valueOf("Endereço")).toHaveTextContent(/^Rua das Acácias, 120, apto 42$/);
    expect(valueOf("Cidade")).toHaveTextContent(/^São Paulo$/);
    expect(valueOf("Estado (UF)")).toHaveTextContent(/^SP$/);

    expect(valueOf("RA")).toHaveTextContent(/^a2210001$/);
    expect(valueOf("Departamento")).toHaveTextContent(/^Tecnologia$/);
    expect(valueOf("Função principal")).toHaveTextContent(/^Monitora de informática$/);
    expect(valueOf("Curso da faculdade")).toHaveTextContent(/^Sistemas de Informação$/);
    expect(valueOf("Turma")).toHaveTextContent(/^SI-2024-N$/);
    expect(valueOf("Período")).toHaveTextContent(/^7º$/);
    expect(valueOf("E-mail institucional")).toHaveTextContent(/^ana\.torres@example\.edu$/);
    expect(valueOf("CPF")).toHaveTextContent(/^\*\*\*\.\*\*\*\.247-25$/);

    expect(valueOf("Perfil de acesso")).toHaveTextContent(/^Membro$/);
    expect(valueOf("Status")).toHaveTextContent(/^Ativa$/);
    expect(valueOf("Entrada no projeto")).toHaveTextContent(/^01\/10\/2026$/);
  });

  it("shows a dash in every member field for the seeded coordinator", async () => {
    await renderProfile(buildSeedProfile());

    for (const label of [
      "Data de nascimento",
      "Telefone",
      "E-mail pessoal",
      "Endereço",
      "Cidade",
      "Estado (UF)",
      "Departamento",
      "Função principal",
      "Curso da faculdade",
      "Turma",
      "Período",
      "E-mail institucional",
      "CPF",
      "Termo de voluntariado",
      "Entrada no projeto",
      "Último acesso",
    ]) {
      expect(valueOf(label), label).toHaveTextContent("—");
      expect(valueOf(label), label).toHaveTextContent("Não informado");
    }

    // What the seed does have is shown as it is.
    expect(screen.getAllByText("Coordenadora").length).toBeGreaterThan(0);
    expect(valueOf("RA")).toHaveTextContent(/^a0000001$/);
    expect(valueOf("Nome completo")).toHaveTextContent(/^Marina Albuquerque$/);
    // No member profile, so no chip for the department or the date of joining.
    const chips = within(headerOf("Marina Albuquerque"));
    expect(chips.queryByText("Tecnologia")).not.toBeInTheDocument();
    expect(chips.queryByText(/^Desde/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("formats the phone number", async () => {
    await renderProfile(buildMyProfile({ phone: "11981813030" }));

    expect(valueOf("Telefone")).toHaveTextContent(/^\(11\) 98181-3030$/);
  });

  it("links the volunteer term in a new tab", async () => {
    await renderProfile();

    const link = screen.getByRole("link", { name: "Abrir o termo (abre em nova aba)" });
    expect(link).toHaveAttribute("href", "https://drive.google.com/file/d/exemplo/view");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(valueOf("Termo de voluntariado")).toContainElement(link);
  });

  it("shows the volunteer term as text when it is not an http link", async () => {
    await renderProfile(buildMyProfile({ volunteerTermUrl: "javascript:alert(1)" }));

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(valueOf("Termo de voluntariado")).toHaveTextContent(/^javascript:alert\(1\)$/);
  });

  it("shows the last access in the local time zone", async () => {
    const lastLoginAt = "2026-10-20T13:00:00.000Z";
    await renderProfile(buildMyProfile({ lastLoginAt }));

    // Computed here with the same options: the suite does not pin the time zone of the machine.
    const expected = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(lastLoginAt));
    expect(valueOf("Último acesso")).toHaveTextContent(expected);
  });

  it("shows a dash for the last access before the second login", async () => {
    await renderProfile(buildMyProfile({ lastLoginAt: null }));

    expect(valueOf("Último acesso")).toHaveTextContent("—");
    expect(valueOf("Último acesso")).toHaveTextContent("Não informado");
  });

  it("shows a skeleton while the profile loads", async () => {
    const deferred = createDeferred();
    server.use(meHandler(), myProfileHandler({ delay: deferred.promise }));
    await renderPage();

    expect(await screen.findByText("Carregando o seu perfil…")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Carregando o seu perfil…");
    expect(screen.queryByText("Ana Torres")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Conta e acesso" })).not.toBeInTheDocument();

    deferred.resolve();

    expect(await screen.findByText("Ana Torres", { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByText("Carregando o seu perfil…")).not.toBeInTheDocument();
  });

  it("shows an error with a retry that reloads the profile", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler(),
      myProfileHandler({ error: { statusCode: 500, error: "Internal Server Error" } }),
    );
    await renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar o seu perfil. Tente novamente.",
    );
    expect(screen.queryByRole("heading", { name: "Conta e acesso" })).not.toBeInTheDocument();

    server.use(myProfileHandler());
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("Ana Torres", { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not show the sample data notice", async () => {
    await renderProfile();

    expect(screen.queryByText(/Dados de exemplo/)).not.toBeInTheDocument();
  });

  it("keeps Editar meus dados disabled, puts the actions of the slot after it and offers sign out", async () => {
    await renderProfile();

    const editData = screen.getByRole("button", { name: "Editar meus dados" });
    const slotAction = screen.getByRole("button", { name: "Ação de horas (slot)" });
    expect(editData).toBeDisabled();
    expect(isBefore(editData, slotAction)).toBe(true);
    expect(slotAction.parentElement).toBe(editData.parentElement);
    expect(screen.getByRole("button", { name: "Sair do sistema" })).toBeEnabled();
  });

  it("does not draw the slots while the profile loads or fails", async () => {
    const deferred = createDeferred();
    server.use(
      meHandler(),
      myProfileHandler({
        delay: deferred.promise,
        error: { statusCode: 500, error: "Internal Server Error" },
      }),
    );
    await renderPage();

    await screen.findByText("Carregando o seu perfil…");
    expect(screen.queryByRole("region", { name: /\(slot\)/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ação de horas (slot)" })).not.toBeInTheDocument();

    deferred.resolve();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar o seu perfil. Tente novamente.",
    );
    expect(screen.queryByRole("region", { name: /\(slot\)/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ação de horas (slot)" })).not.toBeInTheDocument();
  });

  it("drops the cached profile when the page unmounts", async () => {
    const { unmount, queryClient } = await renderProfile();
    expect(queryClient.getQueryState(getGetMyProfileQueryKey())).toBeDefined();

    unmount();

    await waitFor(() =>
      expect(queryClient.getQueryState(getGetMyProfileQueryKey())).toBeUndefined(),
    );
  });
});
