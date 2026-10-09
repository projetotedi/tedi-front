import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InviteType, type AcceptInviteDto } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { AuthProvider } from "../AuthProvider";
import { SLOW_NOTICE_DELAY_MS } from "../hooks/useSlowRequestNotice";
import { InvitePage } from "../pages/InvitePage";
import {
  acceptInviteHandler,
  buildInvite,
  buildMeUser,
  getInviteHandler,
  meHandler,
} from "./handlers";
import { renderWithProviders, server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

const TOKEN = "abc";
const NAME = "Lucas Andrade Souza";
const RA = "202600117";
const EMAIL = "lucas@instituicao.edu.br";
const PASSWORD = "senha-segura-1";
const SLOW_NOTICE = "Conectando ao servidor, isso pode levar até um minuto";
const INVALID_INVITE_TITLE = "Este link não é mais válido";
const NO_BREAK_SPACE = String.fromCharCode(160);

const RESET_NAME = "Beatriz Nunes Carvalho";
const RESET_RA = "202400003";
const PASSWORD_RESET_INVITE = buildInvite({
  type: InviteType.password_reset,
  role: null,
  person: { name: RESET_NAME, ra: RESET_RA },
});

function renderInvitePage(route: string) {
  return renderWithProviders(
    <AuthProvider>
      <Routes>
        <Route path="/invite" element={<InvitePage />} />
        <Route path="/reset-password" element={<InvitePage />} />
        <Route path="*" element={<p>Destino do redirecionamento</p>} />
      </Routes>
    </AuthProvider>,
    { route },
  );
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const nameField = () => screen.getByLabelText("Nome completo");
const raField = () => screen.getByLabelText("RA");
const emailField = () => screen.getByLabelText("E-mail institucional");
const passwordField = () => screen.getByLabelText("Senha");
const confirmationField = () => screen.getByLabelText("Confirmar senha");
const newPasswordField = () => screen.getByLabelText("Nova senha");
const newPasswordConfirmationField = () => screen.getByLabelText("Confirmar nova senha");

const continueButton = () => screen.getByRole("button", { name: "Continuar" });
const backButton = () => screen.getByRole("button", { name: "Voltar" });
const submitButton = () => screen.getByRole("button", { name: "Enviar cadastro" });
const summaryStrip = () =>
  screen.getByText(
    (_content, element) => element?.tagName === "P" && element.textContent?.includes(NAME) === true,
  );

// Espera o primeiro campo, e não o título: o título já existe (sr-only) na tela de carregamento.
async function openAccessInvite(route = `/invite?token=${TOKEN}`) {
  const view = await renderInvitePage(route);
  await screen.findByLabelText("RA");
  return view;
}

async function fillAcademicStep(user: UserEvent, values: { ra?: string; email?: string } = {}) {
  await user.type(raField(), values.ra ?? RA);
  await user.type(emailField(), values.email ?? EMAIL);
}

async function fillPersonalStep(user: UserEvent, values: { name?: string } = {}) {
  await user.type(nameField(), values.name ?? NAME);
}

async function goToPersonalStep(user: UserEvent) {
  await fillAcademicStep(user);
  await user.click(continueButton());
  await screen.findByRole("heading", { level: 2, name: "Dados pessoais" });
}

async function goToPasswordStep(user: UserEvent) {
  await goToPersonalStep(user);
  await fillPersonalStep(user);
  await user.click(continueButton());
  await screen.findByRole("heading", { level: 2, name: "Crie sua senha" });
}

async function fillPasswords(user: UserEvent, password = PASSWORD, confirmation = password) {
  await user.type(passwordField(), password);
  await user.type(confirmationField(), confirmation);
}

// Os campos do link de redefinição têm outros rótulos ("Nova senha"); não há checkbox de consentimento.
async function fillNewPasswords(user: UserEvent, password = PASSWORD, confirmation = password) {
  await user.type(newPasswordField(), password);
  await user.type(newPasswordConfirmationField(), confirmation);
}

async function completeRegistration(user: UserEvent) {
  await goToPasswordStep(user);
  await fillPasswords(user);
  await user.click(submitButton());
}

afterEach(() => {
  vi.useRealTimers();
});

describe("InvitePage with an access invite", () => {
  it("shows the granted role and the academic step fields for an access invite", async () => {
    const tokens: string[] = [];
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ onCall: (token) => tokens.push(token) }),
    );
    await openAccessInvite();

    expect(screen.getByText("Você foi convidado como Membro")).toBeVisible();
    expect(
      screen.getByText(
        "Etapa 1 de 3 · Comece pelos seus dados acadêmicos. O RA informado será o seu usuário de acesso ao sistema.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Dados acadêmicos" })).toBeVisible();
    for (const field of [raField(), emailField()]) {
      expect(field).toBeVisible();
      expect(field).toBeRequired();
    }
    expect(raField()).toHaveAccessibleDescription("Você vai entrar no sistema com este RA.");
    expect(screen.queryByLabelText("Nome completo")).not.toBeInTheDocument();
    expect(screen.getByText("* Campos obrigatórios")).toBeVisible();
    expect(continueButton()).toBeVisible();
    expect(screen.getByRole("list", { name: "Etapa 1 de 3" })).toBeVisible();
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voltar" })).not.toBeInTheDocument();
    expect(tokens).toEqual([TOKEN]);
    expect(document.title).toBe("Cadastro de membro");
  });

  it.each([
    [Role.director, "Você foi convidado como Diretor"],
    [Role.coordinator, "Você foi convidado como Coordenadora"],
    [null, "Você foi convidado para o TEDI"],
    [Role.superadmin, "Você foi convidado para o TEDI"],
  ])("names the granted role %s in the invite label", async (role, label) => {
    server.use(meHandler({ user: null }), getInviteHandler({ invite: buildInvite({ role }) }));
    await openAccessInvite();

    expect(screen.getByText(label)).toBeVisible();
  });

  it("submits the full DTO and reaches /login through the success screen", async () => {
    const user = userEvent.setup();
    const accepted: AcceptInviteDto[] = [];
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ onCall: (body) => accepted.push(body) }),
    );
    const { router } = await openAccessInvite();

    await completeRegistration(user);

    const title = await screen.findByRole("heading", { level: 1, name: "Cadastro concluído!" });
    expect(
      screen.getByText(
        `Agora você já pode entrar com o seu RA (${RA}) e a senha que acabou de criar.`,
      ),
    ).toBeVisible();
    await waitFor(() => expect(title).toHaveFocus());
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    expect(accepted).toStrictEqual([
      { token: TOKEN, name: NAME, ra: RA, email: EMAIL, password: PASSWORD },
    ]);
    expect(router.state.location.pathname).toBe("/invite");

    await user.click(screen.getByRole("button", { name: "Ir para o login" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(screen.getByText("Destino do redirecionamento")).toBeInTheDocument();
    expect(router.state.historyAction).toBe("REPLACE");
  });

  it("sends the name, the RA and the email without the spaces around them", async () => {
    const user = userEvent.setup();
    const accepted: AcceptInviteDto[] = [];
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ onCall: (body) => accepted.push(body) }),
    );
    await openAccessInvite();

    await fillAcademicStep(user, { ra: ` ${RA} `, email: ` ${EMAIL} ` });
    await user.click(continueButton());
    await screen.findByRole("heading", { level: 2, name: "Dados pessoais" });
    await fillPersonalStep(user, { name: `  ${NAME} ` });
    await user.click(continueButton());
    await screen.findByRole("heading", { level: 2, name: "Crie sua senha" });
    await fillPasswords(user);
    await user.click(submitButton());

    await screen.findByRole("heading", { name: "Cadastro concluído!" });
    expect(accepted).toStrictEqual([
      { token: TOKEN, name: NAME, ra: RA, email: EMAIL, password: PASSWORD },
    ]);
    expect(
      screen.getByText(
        `Agora você já pode entrar com o seu RA (${RA}) e a senha que acabou de criar.`,
      ),
    ).toBeVisible();
  });

  it("shows no account banner on an access invite", async () => {
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    expect(screen.queryByText(/a senha antiga deixa de funcionar/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Beatriz Nunes Carvalho/)).not.toBeInTheDocument();
  });

  it("serves the same page on /reset-password", async () => {
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite(`/reset-password?token=${TOKEN}`);

    expect(screen.getByText("Você foi convidado como Membro")).toBeVisible();
    expect(raField()).toBeVisible();
  });

  it("does not redirect a user who is already signed in", async () => {
    let meCalls = 0;
    server.use(
      meHandler({ user: buildMeUser(), onCall: () => (meCalls += 1) }),
      getInviteHandler(),
    );
    const { router } = await openAccessInvite();

    await waitFor(() => expect(meCalls).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getByText("Você foi convidado como Membro")).toBeVisible());
    expect(router.state.location.pathname).toBe("/invite");
    expect(raField()).toBeVisible();
  });

  it("keeps the token out of the page title, the page text and the browser storage", async () => {
    const secret = "tok-9f3k2x7";
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler(), acceptInviteHandler());
    await openAccessInvite(`/invite?token=${secret}`);
    await completeRegistration(user);
    await screen.findByRole("heading", { name: "Cadastro concluído!" });

    expect(document.title).not.toContain(secret);
    expect(document.body.innerHTML).not.toContain(secret);
    expect(JSON.stringify({ ...localStorage })).not.toContain(secret);
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(secret);
  });
});

describe("InvitePage with a password_reset invite", () => {
  it("shows only the password fields for a password_reset invite", async () => {
    server.use(meHandler({ user: null }), getInviteHandler({ invite: PASSWORD_RESET_INVITE }));
    const { container } = await renderInvitePage(`/invite?token=${TOKEN}`);

    expect(await screen.findByRole("heading", { level: 1, name: "Redefinir senha" })).toBeVisible();
    expect(newPasswordField()).toBeVisible();
    expect(newPasswordConfirmationField()).toBeVisible();
    expect(screen.getByRole("button", { name: "Salvar nova senha" })).toBeVisible();
    expect(screen.queryByLabelText("Nome completo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("RA")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("E-mail institucional")).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByText(/Você foi convidado/)).not.toBeInTheDocument();
    expect(container.querySelectorAll("input")).toHaveLength(2);
    expect(document.title).toBe("Redefinir senha");
  });

  it("sends only token and password on a password_reset invite", async () => {
    const user = userEvent.setup();
    const accepted: AcceptInviteDto[] = [];
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ invite: PASSWORD_RESET_INVITE }),
      acceptInviteHandler({ onCall: (body) => accepted.push(body) }),
    );
    const { router } = await renderInvitePage(`/reset-password?token=${TOKEN}`);
    await screen.findByRole("heading", { name: "Redefinir senha" });

    await fillNewPasswords(user);
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    const title = await screen.findByRole("heading", { level: 1, name: "Senha redefinida!" });
    await waitFor(() => expect(title).toHaveFocus());
    expect(accepted).toStrictEqual([{ token: TOKEN, password: PASSWORD }]);

    await user.click(screen.getByRole("button", { name: "Ir para o login" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  });

  it("does not call the API when the new password is too short or does not match", async () => {
    const user = userEvent.setup();
    let posts = 0;
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ invite: PASSWORD_RESET_INVITE }),
      acceptInviteHandler({ onCall: () => (posts += 1) }),
    );
    await renderInvitePage(`/invite?token=${TOKEN}`);
    await screen.findByRole("heading", { name: "Redefinir senha" });

    await fillNewPasswords(user, "1234567", "12345678");
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(await screen.findByText("A senha deve ter no mínimo 8 caracteres")).toBeInTheDocument();
    expect(screen.getByText("As senhas não são iguais")).toBeInTheDocument();
    expect(newPasswordField()).toHaveAttribute("aria-invalid", "true");
    expect(newPasswordConfirmationField()).toHaveAttribute("aria-invalid", "true");
    expect(posts).toBe(0);
  });

  it("shows the network message and keeps the form open when the server cannot be reached", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ invite: PASSWORD_RESET_INVITE }),
      acceptInviteHandler({ networkError: true }),
    );
    await renderInvitePage(`/invite?token=${TOKEN}`);
    await screen.findByRole("heading", { name: "Redefinir senha" });

    await fillNewPasswords(user);
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conectar");
    await waitFor(() => expect(newPasswordField()).toHaveFocus());
    expect(newPasswordField()).toBeEnabled();
    expect(newPasswordField()).toHaveValue(PASSWORD);
  });

  it("shows the generic message when the API answers an unexpected error", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ invite: PASSWORD_RESET_INVITE }),
      acceptInviteHandler({ error: { statusCode: 409, error: "RA_ALREADY_IN_USE" } }),
    );
    await renderInvitePage(`/invite?token=${TOKEN}`);
    await screen.findByRole("heading", { name: "Redefinir senha" });

    await fillNewPasswords(user);
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível salvar a nova senha. Tente novamente.",
    );
  });

  it("switches to the invalid-link screen when the accept returns INVALID_INVITE", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ invite: PASSWORD_RESET_INVITE }),
      acceptInviteHandler({ error: { statusCode: 400, error: "INVALID_INVITE" } }),
    );
    await renderInvitePage(`/invite?token=${TOKEN}`);
    await screen.findByRole("heading", { name: "Redefinir senha" });

    await fillNewPasswords(user);
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(INVALID_INVITE_TITLE);
    expect(screen.queryByLabelText("Nova senha")).not.toBeInTheDocument();
  });

  it("hides the account banner but keeps the new password fields when person is null", async () => {
    server.use(
      meHandler({ user: null }),
      getInviteHandler({
        invite: buildInvite({ type: InviteType.password_reset, role: null, person: null }),
      }),
    );
    await renderInvitePage(`/reset-password?token=${TOKEN}`);
    await screen.findByRole("heading", { level: 1, name: "Redefinir senha" });

    expect(screen.queryByText(/a senha antiga deixa de funcionar/)).not.toBeInTheDocument();
    expect(newPasswordField()).toBeVisible();
    expect(newPasswordConfirmationField()).toBeVisible();
  });

  it("shows the name and RA of the account above the new password fields", async () => {
    server.use(meHandler({ user: null }), getInviteHandler({ invite: PASSWORD_RESET_INVITE }));
    await renderInvitePage(`/reset-password?token=${TOKEN}`);
    await screen.findByRole("heading", { level: 1, name: "Redefinir senha" });

    const banner = screen.getByText(RESET_NAME).closest("p");
    expect(banner).toHaveTextContent(
      `${RESET_NAME} · RA ${RESET_RA} — a senha antiga deixa de funcionar quando você salvar.`,
    );
    expect(banner?.textContent).toContain(`RA${NO_BREAK_SPACE}${RESET_RA}`);
    expect(screen.getByText(RESET_NAME)).toHaveClass("font-semibold");
    // A faixa vem antes dos campos na ordem do documento.
    expect(banner!.compareDocumentPosition(newPasswordField())).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("shows the reset password title, subtitle, field labels and hints", async () => {
    server.use(meHandler({ user: null }), getInviteHandler({ invite: PASSWORD_RESET_INVITE }));
    await renderInvitePage(`/reset-password?token=${TOKEN}`);

    expect(await screen.findByRole("heading", { level: 1, name: "Redefinir senha" })).toBeVisible();
    expect(screen.getByText("Crie uma nova senha para entrar no TEDI.")).toBeVisible();
    expect(newPasswordField()).toHaveAccessibleDescription("Mínimo de 8 caracteres.");
    expect(newPasswordConfirmationField()).toHaveAccessibleDescription(
      "Digite a mesma senha de novo.",
    );
    expect(screen.getByRole("button", { name: "Mostrar senha" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Mostrar confirmação da senha" })).toBeVisible();
  });

  it("shows the reset success screen and leads to /login", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ invite: PASSWORD_RESET_INVITE }),
      acceptInviteHandler(),
    );
    const { router } = await renderInvitePage(`/reset-password?token=${TOKEN}`);
    await screen.findByRole("heading", { name: "Redefinir senha" });

    await fillNewPasswords(user);
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    const title = await screen.findByRole("heading", { level: 1, name: "Senha redefinida!" });
    await waitFor(() => expect(title).toHaveFocus());
    expect(screen.getByText("Pronto. Entre com o seu RA e a senha nova.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Ir para o login" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  });

  it("keeps the account name and RA out of the page title", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ invite: PASSWORD_RESET_INVITE }),
      acceptInviteHandler(),
    );
    await renderInvitePage(`/reset-password?token=${TOKEN}`);
    await screen.findByRole("heading", { name: "Redefinir senha" });

    expect(document.title).toBe("Redefinir senha");
    expect(document.title).not.toContain("Beatriz");
    expect(document.title).not.toContain(RESET_RA);

    await fillNewPasswords(user);
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));
    await screen.findByRole("heading", { name: "Senha redefinida!" });

    expect(document.title).not.toContain("Beatriz");
    expect(document.title).not.toContain(RESET_RA);
  });
});

describe("InvitePage with a link that does not work", () => {
  it("shows the invalid-link message and no fields when the invite is invalid", async () => {
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ error: { statusCode: 400, error: "INVALID_INVITE" } }),
    );
    const { container } = await renderInvitePage(`/invite?token=${TOKEN}`);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(INVALID_INVITE_TITLE);
    expect(alert).toHaveTextContent("O link vale por 48 horas e só pode ser usado uma vez.");
    expect(alert).toHaveTextContent("Peça um novo à coordenação.");
    expect(screen.getByRole("heading", { level: 1, name: INVALID_INVITE_TITLE })).toBeVisible();
    expect(screen.getByRole("button", { name: "Ir para o login" })).toBeVisible();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(container.querySelectorAll("input, form")).toHaveLength(0);
  });

  it("sends a token with special characters as one path segment", async () => {
    const strange = "abc/def?x=1#y";
    const tokens: string[] = [];
    server.use(
      meHandler({ user: null }),
      getInviteHandler({
        error: { statusCode: 400, error: "INVALID_INVITE" },
        onCall: (token) => tokens.push(token),
      }),
    );
    await renderInvitePage(`/invite?token=${encodeURIComponent(strange)}`);

    expect(await screen.findByRole("alert")).toHaveTextContent(INVALID_INVITE_TITLE);
    expect(tokens).toEqual([strange]);
  });

  it("leads to /login from the invalid-link screen", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ error: { statusCode: 400, error: "INVALID_INVITE" } }),
    );
    const { router } = await renderInvitePage(`/invite?token=${TOKEN}`);
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "Ir para o login" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  });

  it.each([["/invite"], ["/invite?token="]])(
    "shows the invalid-link message and never asks the API when the URL is %s",
    async (route) => {
      let inviteCalls = 0;
      let meCalls = 0;
      server.use(
        meHandler({ user: null, onCall: () => (meCalls += 1) }),
        getInviteHandler({ onCall: () => (inviteCalls += 1) }),
      );
      await renderInvitePage(route);

      expect(await screen.findByRole("alert")).toHaveTextContent(INVALID_INVITE_TITLE);
      expect(screen.queryAllByRole("textbox")).toHaveLength(0);
      // Espera a sessão carregar: se o GET fosse disparar, já teria disparado.
      await waitFor(() => expect(meCalls).toBeGreaterThan(0));
      expect(inviteCalls).toBe(0);
    },
  );

  it("switches to the invalid-link screen when the accept returns INVALID_INVITE", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ error: { statusCode: 400, error: "INVALID_INVITE" } }),
    );
    await openAccessInvite();

    await completeRegistration(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(INVALID_INVITE_TITLE);
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nome completo")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it.each([
    ["the network fails", { networkError: true }],
    ["the gateway answers 503", { error: { statusCode: 503, error: "SERVICE_UNAVAILABLE" } }],
    ["the API answers 500", { error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" } }],
  ])("does not call the link invalid when %s while loading it", async (_label, options) => {
    server.use(meHandler({ user: null }), getInviteHandler(options));
    await renderInvitePage(`/invite?token=${TOKEN}`);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível carregar o convite");
    expect(screen.queryByText(INVALID_INVITE_TITLE)).not.toBeInTheDocument();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
  });

  it("loads the invite again when asked to try again", async () => {
    const user = userEvent.setup();
    let calls = 0;
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ networkError: true, onCall: () => (calls += 1) }),
    );
    await renderInvitePage(`/invite?token=${TOKEN}`);
    await screen.findByText("Não foi possível carregar o convite");
    expect(calls).toBe(1);

    server.use(getInviteHandler({ onCall: () => (calls += 1) }));
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("Você foi convidado como Membro")).toBeVisible();
    expect(raField()).toBeVisible();
    expect(calls).toBe(2);
  });

  it("shows the loading screen again while it re-fetches the invite after an error", async () => {
    const user = userEvent.setup();
    const deferred = createDeferred();
    server.use(meHandler({ user: null }), getInviteHandler({ networkError: true }));
    await renderInvitePage(`/invite?token=${TOKEN}`);
    await screen.findByText("Não foi possível carregar o convite");

    server.use(getInviteHandler({ delay: deferred.promise }));
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    // O React Query volta a `pending` durante o refetch de uma query que tinha dado erro: a tela
    // reaproveita o mesmo aviso "Carregando o convite…" do primeiro carregamento.
    expect(await screen.findByText("Carregando o convite…")).toBeVisible();
    expect(screen.queryByText("Não foi possível carregar o convite")).not.toBeInTheDocument();

    deferred.resolve();
    expect(await screen.findByText("Você foi convidado como Membro")).toBeVisible();
  });
});

describe("InvitePage while loading the invite", () => {
  it("shows a polite loading message and no fields until the invite arrives", async () => {
    const deferred = createDeferred();
    server.use(meHandler({ user: null }), getInviteHandler({ delay: deferred.promise }));
    await renderInvitePage(`/invite?token=${TOKEN}`);

    const region = await screen.findByRole("status");
    expect(region).toHaveTextContent("Carregando o convite…");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    deferred.resolve();

    expect(await screen.findByText("Você foi convidado como Membro")).toBeVisible();
    expect(screen.queryByText("Carregando o convite…")).not.toBeInTheDocument();
  });

  it("tells the person the server may be waking up after 3s, in the same region", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const deferred = createDeferred();
    server.use(meHandler({ user: null }), getInviteHandler({ delay: deferred.promise }));
    await renderInvitePage(`/invite?token=${TOKEN}`);

    const region = await screen.findByRole("status");
    expect(region).not.toHaveTextContent(SLOW_NOTICE);

    act(() => {
      vi.advanceTimersByTime(SLOW_NOTICE_DELAY_MS);
    });

    await waitFor(() => expect(region).toHaveTextContent(SLOW_NOTICE));
    expect(screen.getByRole("status")).toBe(region);

    deferred.resolve();
    expect(await screen.findByText("Você foi convidado como Membro")).toBeVisible();
    expect(screen.queryByText(SLOW_NOTICE)).not.toBeInTheDocument();
  });
});

describe("InvitePage academic step", () => {
  it("validates only the fields of the current step", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    await user.click(continueButton());

    expect(await screen.findByText("Informe o seu RA")).toBeInTheDocument();
    expect(screen.getByText("Informe um e-mail válido")).toBeInTheDocument();
    expect(screen.queryByText("Informe o seu nome completo")).not.toBeInTheDocument();
    expect(raField()).toHaveAttribute("aria-invalid", "true");
    expect(raField()).toHaveAccessibleDescription("Informe o seu RA");
    expect(emailField()).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(raField()).toHaveFocus());
    expect(screen.getByRole("list", { name: "Etapa 1 de 3" })).toBeVisible();
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not advance from the academic step while the RA is empty", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    await user.type(emailField(), EMAIL);
    await user.click(continueButton());

    expect(await screen.findByText("Informe o seu RA")).toBeInTheDocument();
    expect(raField()).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(raField()).toHaveFocus());
    expect(emailField()).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("list", { name: "Etapa 1 de 3" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { level: 2, name: "Dados pessoais" }),
    ).not.toBeInTheDocument();
  });

  it.each(["lucas", "lucas@", "lucas@instituicao"])(
    "rejects the email %j and keeps the person on the academic step",
    async (email) => {
      const user = userEvent.setup();
      server.use(meHandler({ user: null }), getInviteHandler());
      await openAccessInvite();

      await fillAcademicStep(user, { email });
      await user.click(continueButton());

      expect(await screen.findByText("Informe um e-mail válido")).toBeInTheDocument();
      expect(emailField()).toHaveAttribute("aria-invalid", "true");
      expect(raField()).not.toHaveAttribute("aria-invalid", "true");
      await waitFor(() => expect(emailField()).toHaveFocus());
      expect(screen.queryByLabelText("Nome completo")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    },
  );

  it("clears an error as soon as the field is fixed, without pressing Continue again", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await user.click(continueButton());
    await screen.findByText("Informe o seu RA");

    await user.type(raField(), RA);

    await waitFor(() => expect(raField()).not.toHaveAttribute("aria-invalid", "true"));
    expect(screen.queryByText("Informe o seu RA")).not.toBeInTheDocument();
    expect(emailField()).toHaveAttribute("aria-invalid", "true");
  });

  it("advances to the personal step with Enter instead of sending the registration", async () => {
    const user = userEvent.setup();
    let posts = 0;
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ onCall: () => (posts += 1) }),
    );
    await openAccessInvite();

    await fillAcademicStep(user);
    await user.type(emailField(), "{Enter}");

    expect(await screen.findByRole("heading", { level: 2, name: "Dados pessoais" })).toBeVisible();
    expect(posts).toBe(0);
  });

  it("does not advance with Enter while the academic step is invalid", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    await user.type(raField(), `${RA}{Enter}`);

    expect(await screen.findByText("Informe um e-mail válido")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 2, name: "Dados pessoais" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
  });
});

describe("InvitePage personal step", () => {
  it("shows only the full name on the personal step", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    await goToPersonalStep(user);

    expect(screen.getByRole("heading", { level: 2, name: "Dados pessoais" })).toBeVisible();
    expect(screen.getByText("Etapa 2 de 3 · Agora, seus dados pessoais.")).toBeVisible();
    expect(screen.getByRole("list", { name: "Etapa 2 de 3" })).toBeVisible();
    expect(nameField()).toBeVisible();
    expect(nameField()).toBeRequired();
    expect(screen.getByText("* Campos obrigatórios")).toBeVisible();
    expect(backButton()).toBeVisible();
    expect(continueButton()).toBeVisible();
    expect(screen.queryByLabelText("RA")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("E-mail institucional")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
  });

  it("arrives at the personal step without an error on the name that was still empty", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    await goToPersonalStep(user);

    expect(nameField()).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("Informe o seu nome completo")).not.toBeInTheDocument();
  });

  it.each(["", "   "])(
    "does not advance from the personal step while the name is empty or only spaces (%j)",
    async (name) => {
      const user = userEvent.setup();
      let posts = 0;
      server.use(
        meHandler({ user: null }),
        getInviteHandler(),
        acceptInviteHandler({ onCall: () => (posts += 1) }),
      );
      await openAccessInvite();
      await goToPersonalStep(user);

      if (name) await user.type(nameField(), name);
      await user.click(continueButton());

      expect(await screen.findByText("Informe o seu nome completo")).toBeInTheDocument();
      expect(nameField()).toHaveAttribute("aria-invalid", "true");
      expect(nameField()).toHaveAccessibleDescription("Informe o seu nome completo");
      await waitFor(() => expect(nameField()).toHaveFocus());
      expect(screen.getByRole("list", { name: "Etapa 2 de 3" })).toBeVisible();
      expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
      expect(posts).toBe(0);
    },
  );

  it("clears the name error as soon as the name is typed", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPersonalStep(user);
    await user.click(continueButton());
    await screen.findByText("Informe o seu nome completo");

    await user.type(nameField(), NAME);

    await waitFor(() => expect(nameField()).not.toHaveAttribute("aria-invalid", "true"));
    expect(screen.queryByText("Informe o seu nome completo")).not.toBeInTheDocument();
  });
});

describe("InvitePage password step", () => {
  it("shows the typed name and RA above the password fields", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    await goToPasswordStep(user);

    const summary = summaryStrip();
    const heading = screen.getByRole("heading", { level: 2, name: "Crie sua senha" });
    expect(summary).toHaveTextContent(
      `${NAME} · RA ${RA} — é com este RA e a senha abaixo que você entra no sistema.`,
    );
    expect(summary.textContent).toContain(`RA${NO_BREAK_SPACE}${RA}`);
    expect(
      summary.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(heading).toHaveAccessibleDescription(expect.stringContaining(`${NAME} · RA`));
    expect(
      screen.getByText(
        "Etapa 3 de 3 · Último passo: crie a senha que você vai usar para entrar no sistema.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("list", { name: "Etapa 3 de 3" })).toBeVisible();
    expect(passwordField()).toHaveAccessibleDescription("Mínimo de 8 caracteres.");
    expect(confirmationField()).toHaveAccessibleDescription("Digite a mesma senha de novo.");
    expect(passwordField()).toBeRequired();
    expect(confirmationField()).toBeRequired();
    expect(passwordField()).not.toHaveAttribute("aria-invalid", "true");
    expect(backButton()).toBeVisible();
    expect(submitButton()).toBeVisible();
    expect(screen.queryByLabelText("Nome completo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("RA")).not.toBeInTheDocument();
  });

  it("does not call the API when the password is too short", async () => {
    const user = userEvent.setup();
    let posts = 0;
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ onCall: () => (posts += 1) }),
    );
    await openAccessInvite();
    await goToPasswordStep(user);

    await fillPasswords(user, "1234567");
    await user.click(submitButton());

    expect(await screen.findByText("A senha deve ter no mínimo 8 caracteres")).toBeInTheDocument();
    expect(passwordField()).toHaveAttribute("aria-invalid", "true");
    expect(passwordField()).toHaveAccessibleDescription("A senha deve ter no mínimo 8 caracteres");
    expect(confirmationField()).not.toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(passwordField()).toHaveFocus());
    expect(posts).toBe(0);
    expect(screen.queryByRole("heading", { name: "Cadastro concluído!" })).not.toBeInTheDocument();
  });

  it("does not call the API when the confirmation does not match the password", async () => {
    const user = userEvent.setup();
    let posts = 0;
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ onCall: () => (posts += 1) }),
    );
    await openAccessInvite();
    await goToPasswordStep(user);

    await fillPasswords(user, "12345678", "12345679");
    await user.click(submitButton());

    expect(await screen.findByText("As senhas não são iguais")).toBeInTheDocument();
    expect(confirmationField()).toHaveAttribute("aria-invalid", "true");
    expect(confirmationField()).toHaveAccessibleDescription("As senhas não são iguais");
    expect(passwordField()).not.toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(confirmationField()).toHaveFocus());
    expect(posts).toBe(0);
  });

  it("does not ask for privacy consent on the password step", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    await goToPasswordStep(user);

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/aviso de privacidade/)).not.toBeInTheDocument();
  });

  it("clears the mismatch error once the password is corrected to match", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPasswordStep(user);
    await fillPasswords(user, "12345678", "12345679");
    await user.click(submitButton());
    await screen.findByText("As senhas não são iguais");

    await user.clear(passwordField());
    await user.type(passwordField(), "12345679");

    await waitFor(() =>
      expect(screen.queryByText("As senhas não são iguais")).not.toBeInTheDocument(),
    );
    expect(confirmationField()).not.toHaveAttribute("aria-invalid", "true");
  });

  it("shows and hides each password on its own eye button", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPasswordStep(user);
    expect(passwordField()).toHaveAttribute("type", "password");
    expect(confirmationField()).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));

    expect(passwordField()).toHaveAttribute("type", "text");
    expect(confirmationField()).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Ocultar senha" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mostrar confirmação da senha" }));

    expect(confirmationField()).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "Ocultar confirmação da senha" }),
    ).toBeInTheDocument();
  });
});

describe("InvitePage going between the steps", () => {
  it("keeps every typed value when going from step 3 back to step 1 and forward again", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPasswordStep(user);
    await fillPasswords(user);

    await user.click(backButton());

    expect(await screen.findByRole("list", { name: "Etapa 2 de 3" })).toBeVisible();
    expect(nameField()).toHaveValue(NAME);
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();

    await user.click(backButton());

    expect(await screen.findByRole("list", { name: "Etapa 1 de 3" })).toBeVisible();
    expect(raField()).toHaveValue(RA);
    expect(emailField()).toHaveValue(EMAIL);

    await user.click(continueButton());
    await screen.findByRole("heading", { level: 2, name: "Dados pessoais" });
    expect(nameField()).toHaveValue(NAME);

    await user.click(continueButton());
    await screen.findByRole("heading", { level: 2, name: "Crie sua senha" });
    expect(passwordField()).toHaveValue(PASSWORD);
    expect(confirmationField()).toHaveValue(PASSWORD);
  });

  it("moves focus to the step heading and announces each step change", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    const announcement = screen.getByRole("status");
    expect(announcement).toBeEmptyDOMElement();
    expect(announcement).toHaveAttribute("aria-live", "polite");
    expect(document.body).toHaveFocus();

    await goToPersonalStep(user);

    const personalHeading = screen.getByRole("heading", { level: 2, name: "Dados pessoais" });
    await waitFor(() => expect(personalHeading).toHaveFocus());
    expect(screen.getByText("Etapa 2 de 3: Dados pessoais")).toBe(announcement);

    await fillPersonalStep(user);
    await user.click(continueButton());

    const passwordHeading = await screen.findByRole("heading", {
      level: 2,
      name: "Crie sua senha",
    });
    await waitFor(() => expect(passwordHeading).toHaveFocus());
    expect(screen.getByText("Etapa 3 de 3: Crie sua senha")).toBe(announcement);

    await user.click(backButton());

    const personalHeadingAgain = await screen.findByRole("heading", {
      level: 2,
      name: "Dados pessoais",
    });
    await waitFor(() => expect(personalHeadingAgain).toHaveFocus());
    expect(screen.getByText("Etapa 2 de 3: Dados pessoais")).toBe(announcement);
  });

  it("marks the finished steps as completed in the three-step stepper", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    const { container } = await openAccessInvite();
    const stepItems = () =>
      within(screen.getByRole("list", { name: /^Etapa \d de 3$/ })).getAllByRole("listitem");
    const circles = () =>
      Array.from(container.querySelectorAll("ol > li > span:first-child")).map(
        (circle) => circle.textContent,
      );

    expect(stepItems()).toHaveLength(3);
    expect(stepItems()[0]).toHaveTextContent("Dados acadêmicos");
    expect(stepItems()[1]).toHaveTextContent("Dados pessoais");
    expect(stepItems()[2]).toHaveTextContent("Crie sua senha");
    expect(circles()).toEqual(["1", "2", "3"]);
    expect(stepItems()[0]).toHaveAttribute("aria-current", "step");
    expect(screen.queryByText("concluída")).not.toBeInTheDocument();

    await goToPersonalStep(user);

    expect(circles()).toEqual(["✓", "2", "3"]);
    expect(stepItems()[0]).toHaveTextContent("concluída");
    expect(stepItems()[0]).not.toHaveAttribute("aria-current");
    expect(stepItems()[1]).toHaveAttribute("aria-current", "step");
    expect(stepItems()[1]).not.toHaveTextContent("concluída");

    await fillPersonalStep(user);
    await user.click(continueButton());
    await screen.findByRole("heading", { level: 2, name: "Crie sua senha" });

    expect(circles()).toEqual(["✓", "✓", "3"]);
    expect(stepItems()[0]).toHaveTextContent("concluída");
    expect(stepItems()[1]).toHaveTextContent("concluída");
    expect(stepItems()[1]).not.toHaveAttribute("aria-current");
    expect(stepItems()[2]).toHaveAttribute("aria-current", "step");
    expect(stepItems()[2]).not.toHaveTextContent("concluída");

    await user.click(backButton());
    await screen.findByRole("heading", { level: 2, name: "Dados pessoais" });

    expect(circles()).toEqual(["✓", "2", "3"]);
  });

  it("does not validate the next step when Continue is double-clicked", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await fillAcademicStep(user);

    await user.dblClick(continueButton());

    await screen.findByRole("heading", { level: 2, name: "Dados pessoais" });
    expect(screen.queryByText("Informe o seu nome completo")).not.toBeInTheDocument();
    expect(nameField()).not.toHaveAttribute("aria-invalid", "true");
  });

  it("does not call the API while moving through steps 1 and 2, with Enter or Continue", async () => {
    const user = userEvent.setup();
    let posts = 0;
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ onCall: () => (posts += 1) }),
    );
    await openAccessInvite();

    await fillAcademicStep(user);
    await user.type(emailField(), "{Enter}");
    await screen.findByRole("heading", { level: 2, name: "Dados pessoais" });
    await user.type(nameField(), `${NAME}{Enter}`);
    await screen.findByRole("heading", { level: 2, name: "Crie sua senha" });

    await user.click(backButton());
    await screen.findByRole("heading", { level: 2, name: "Dados pessoais" });
    await user.click(backButton());
    await screen.findByRole("heading", { level: 2, name: "Dados acadêmicos" });
    await user.click(continueButton());
    await screen.findByRole("heading", { level: 2, name: "Dados pessoais" });
    await user.click(continueButton());
    await screen.findByRole("heading", { level: 2, name: "Crie sua senha" });

    expect(posts).toBe(0);
    expect(screen.queryByRole("heading", { name: "Cadastro concluído!" })).not.toBeInTheDocument();
  });
});

describe("InvitePage errors from the API", () => {
  it("goes back to step 1 with the RA-in-use error and the focus on the RA field", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ error: { statusCode: 409, error: "RA_ALREADY_IN_USE" } }),
    );
    const { router } = await openAccessInvite();

    await completeRegistration(user);

    await waitFor(() => expect(raField()).toHaveAttribute("aria-invalid", "true"));
    expect(raField()).toHaveAccessibleDescription("Este RA já está em uso");
    await waitFor(() => expect(raField()).toHaveFocus());
    expect(raField()).toHaveValue(RA);
    expect(emailField()).toHaveValue(EMAIL);
    expect(emailField()).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("list", { name: "Etapa 1 de 3" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Dados acadêmicos" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Cadastro concluído!" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/invite");
    expect(raField()).toBeEnabled();
  });

  it("goes back to step 1 with the email-in-use error and the focus on the email field", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ error: { statusCode: 409, error: "EMAIL_ALREADY_IN_USE" } }),
    );
    await openAccessInvite();

    await completeRegistration(user);

    await waitFor(() => expect(emailField()).toHaveAttribute("aria-invalid", "true"));
    expect(emailField()).toHaveAccessibleDescription("Este e-mail já está em uso");
    await waitFor(() => expect(emailField()).toHaveFocus());
    expect(raField()).not.toHaveAttribute("aria-invalid", "true");
    expect(raField()).toHaveValue(RA);
    expect(emailField()).toHaveValue(EMAIL);
    expect(screen.getByRole("list", { name: "Etapa 1 de 3" })).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await user.click(continueButton());

    await screen.findByRole("heading", { level: 2, name: "Dados pessoais" });
    expect(nameField()).toHaveValue(NAME);
  });

  it("clears the RA-in-use error when the RA is edited and lets the person try again", async () => {
    const user = userEvent.setup();
    const accepted: AcceptInviteDto[] = [];
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ error: { statusCode: 409, error: "RA_ALREADY_IN_USE" } }),
    );
    await openAccessInvite();
    await completeRegistration(user);
    await waitFor(() => expect(raField()).toHaveAttribute("aria-invalid", "true"));

    await user.type(raField(), "9");

    await waitFor(() => expect(raField()).not.toHaveAttribute("aria-invalid", "true"));
    expect(screen.queryByText("Este RA já está em uso")).not.toBeInTheDocument();

    server.use(acceptInviteHandler({ onCall: (body) => accepted.push(body) }));
    await user.click(continueButton());
    await screen.findByRole("heading", { level: 2, name: "Dados pessoais" });
    expect(nameField()).toHaveValue(NAME);
    await user.click(continueButton());
    await screen.findByRole("heading", { level: 2, name: "Crie sua senha" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(submitButton());

    await screen.findByRole("heading", { name: "Cadastro concluído!" });
    expect(accepted).toHaveLength(1);
    expect(accepted[0]?.ra).toBe(`${RA}9`);
  });

  it.each([
    ["the network fails", { networkError: true }],
    ["the gateway answers 503", { error: { statusCode: 503, error: "SERVICE_UNAVAILABLE" } }],
  ])("shows the network message and keeps the data when %s", async (_label, options) => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler(), acceptInviteHandler(options));
    await openAccessInvite();

    await completeRegistration(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível conectar");
    await waitFor(() => expect(passwordField()).toHaveFocus());
    expect(passwordField()).toBeEnabled();
    expect(passwordField()).toHaveValue(PASSWORD);
    expect(passwordField()).toHaveAccessibleDescription(
      expect.stringContaining("Não foi possível conectar"),
    );
    expect(submitButton()).toBeEnabled();
  });

  it("shows a fallback message on an unexpected server error", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" } }),
    );
    await openAccessInvite();

    await completeRegistration(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível enviar o cadastro. Tente novamente.",
    );
  });

  it("does not bring an error of the failed attempt back after going back and forward again", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" } }),
    );
    await openAccessInvite();
    await completeRegistration(user);
    await screen.findByRole("alert");

    await user.click(backButton());
    await user.click(await screen.findByRole("button", { name: "Continuar" }));
    await screen.findByRole("heading", { level: 2, name: "Crie sua senha" });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("InvitePage while sending", () => {
  it("disables the form and does not send a second POST on a double click", async () => {
    const user = userEvent.setup();
    const deferred = createDeferred();
    let posts = 0;
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ delay: deferred.promise, onCall: () => (posts += 1) }),
    );
    const { container } = await openAccessInvite();
    await goToPasswordStep(user);
    await fillPasswords(user);

    const button = submitButton();
    await user.dblClick(button);
    await user.click(button);

    expect(await screen.findByRole("button", { name: "Enviando…" })).toBe(button);
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button.querySelector("[data-slot='spinner']")).toBeInTheDocument();
    expect(container.querySelector("form")).toHaveAttribute("aria-busy", "true");
    expect(passwordField()).toBeDisabled();
    expect(confirmationField()).toBeDisabled();
    expect(backButton()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mostrar senha" })).toBeDisabled();
    await waitFor(() => expect(posts).toBeGreaterThan(0));
    expect(posts).toBe(1);

    deferred.resolve();
    await screen.findByRole("heading", { name: "Cadastro concluído!" });
    expect(posts).toBe(1);
  });

  it("does not send a second POST on a double click of the password reset form", async () => {
    const user = userEvent.setup();
    const deferred = createDeferred();
    let posts = 0;
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ invite: PASSWORD_RESET_INVITE }),
      acceptInviteHandler({ delay: deferred.promise, onCall: () => (posts += 1) }),
    );
    await renderInvitePage(`/invite?token=${TOKEN}`);
    await screen.findByRole("heading", { name: "Redefinir senha" });
    await fillNewPasswords(user);

    const button = screen.getByRole("button", { name: "Salvar nova senha" });
    await user.dblClick(button);
    await user.click(button);

    await screen.findByRole("button", { name: "Enviando…" });
    expect(newPasswordField()).toBeDisabled();
    await waitFor(() => expect(posts).toBeGreaterThan(0));
    expect(posts).toBe(1);

    deferred.resolve();
    await screen.findByRole("heading", { name: "Senha redefinida!" });
    expect(posts).toBe(1);
  });

  it("shows the slow-connection notice after 3s and hides it on response", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const deferred = createDeferred();
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({
        delay: deferred.promise,
        error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" },
      }),
    );
    const { container } = await openAccessInvite();
    await goToPasswordStep(user);
    const region = container.querySelector<HTMLElement>("div[role='status']");
    expect(region).toBeEmptyDOMElement();

    await fillPasswords(user);
    await user.click(submitButton());
    await screen.findByRole("button", { name: "Enviando…" });
    act(() => {
      vi.advanceTimersByTime(SLOW_NOTICE_DELAY_MS);
    });

    await waitFor(() => expect(region).toHaveTextContent(SLOW_NOTICE));
    expect(container.querySelector("div[role='status']")).toBe(region);

    deferred.resolve();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível enviar o cadastro. Tente novamente.",
    );
    await waitFor(() => expect(region).toBeEmptyDOMElement());
  });
});

describe("InvitePage accessibility", () => {
  // Exceção consciente à regra "asserção por papel, não por classe": o jsdom não carrega CSS, então
  // alvo de 44px e fonte de 16px só são verificáveis pelas classes do Tailwind.
  it("renders 44px targets and 16px text on the three steps", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    for (const field of [raField(), emailField()]) {
      expect(field).toHaveClass("min-h-11", "text-base");
    }
    expect(continueButton()).toHaveClass("min-h-11", "text-base");
    expect(screen.getByRole("heading", { level: 2, name: "Dados acadêmicos" })).toHaveClass(
      "text-base",
    );
    expect(screen.getByText(/^Etapa 1 de 3 · /)).toHaveClass("text-base");
    expect(screen.getByText("Você foi convidado como Membro")).toHaveClass("text-base");

    await goToPersonalStep(user);

    expect(nameField()).toHaveClass("min-h-11", "text-base");
    expect(backButton()).toHaveClass("min-h-11", "text-base");
    expect(continueButton()).toHaveClass("min-h-11", "text-base");
    expect(screen.getByRole("heading", { level: 2, name: "Dados pessoais" })).toHaveClass(
      "text-base",
    );
    expect(screen.getByText(/^Etapa 2 de 3 · /)).toHaveClass("text-base");

    await fillPersonalStep(user);
    await user.click(continueButton());
    await screen.findByRole("heading", { level: 2, name: "Crie sua senha" });

    for (const field of [passwordField(), confirmationField()]) {
      expect(field).toHaveClass("min-h-11", "text-base");
    }
    for (const eye of [
      screen.getByRole("button", { name: "Mostrar senha" }),
      screen.getByRole("button", { name: "Mostrar confirmação da senha" }),
    ]) {
      expect(eye).toHaveClass("min-h-11", "min-w-11");
    }
    expect(backButton()).toHaveClass("min-h-11", "text-base");
    expect(submitButton()).toHaveClass("min-h-11", "text-base");
    expect(screen.getByRole("heading", { level: 2, name: "Crie sua senha" })).toHaveClass(
      "text-base",
    );
    expect(summaryStrip()).toHaveClass("text-base");
    expect(screen.getByText(/^Etapa 3 de 3 · /)).toHaveClass("text-base");
  });

  it("renders the invalid-link screen with a 44px button and 16px text", async () => {
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ error: { statusCode: 400, error: "INVALID_INVITE" } }),
    );
    await renderInvitePage(`/invite?token=${TOKEN}`);
    await screen.findByRole("alert");

    expect(screen.getByRole("button", { name: "Ir para o login" })).toHaveClass(
      "min-h-11",
      "text-base",
    );
    expect(screen.getByText(/O link vale por 48 horas/)).toHaveClass("text-base");
  });

  it("renders the success screen with a 44px button and 16px text", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler(), acceptInviteHandler());
    await openAccessInvite();

    await completeRegistration(user);
    await screen.findByRole("heading", { name: "Cadastro concluído!" });

    expect(screen.getByRole("button", { name: "Ir para o login" })).toHaveClass(
      "min-h-11",
      "text-base",
    );
    expect(screen.getByText(/Agora você já pode entrar com o seu RA/)).toHaveClass("text-base");
  });

  it("is operable by keyboard only, from step 1 to the success screen", async () => {
    const user = userEvent.setup();
    const accepted: AcceptInviteDto[] = [];
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ onCall: (body) => accepted.push(body) }),
    );
    await openAccessInvite();

    await user.tab();
    expect(raField()).toHaveFocus();
    await user.keyboard(RA);
    await user.tab();
    expect(emailField()).toHaveFocus();
    await user.keyboard(EMAIL);
    await user.tab();
    expect(continueButton()).toHaveFocus();
    await user.keyboard("{Enter}");

    const personalHeading = await screen.findByRole("heading", {
      level: 2,
      name: "Dados pessoais",
    });
    await waitFor(() => expect(personalHeading).toHaveFocus());
    await user.tab();
    expect(nameField()).toHaveFocus();
    await user.keyboard(NAME);
    await user.tab();
    expect(backButton()).toHaveFocus();
    await user.tab();
    expect(continueButton()).toHaveFocus();
    await user.keyboard("{Enter}");

    const passwordHeading = await screen.findByRole("heading", {
      level: 2,
      name: "Crie sua senha",
    });
    await waitFor(() => expect(passwordHeading).toHaveFocus());
    await user.tab();
    expect(passwordField()).toHaveFocus();
    await user.keyboard(PASSWORD);
    await user.tab();
    expect(screen.getByRole("button", { name: "Mostrar senha" })).toHaveFocus();
    await user.tab();
    expect(confirmationField()).toHaveFocus();
    await user.keyboard(PASSWORD);
    await user.tab();
    expect(screen.getByRole("button", { name: "Mostrar confirmação da senha" })).toHaveFocus();
    await user.tab();
    expect(backButton()).toHaveFocus();
    await user.tab();
    expect(submitButton()).toHaveFocus();
    await user.keyboard("{Enter}");

    await screen.findByRole("heading", { name: "Cadastro concluído!" });
    expect(accepted).toHaveLength(1);
  });
});
