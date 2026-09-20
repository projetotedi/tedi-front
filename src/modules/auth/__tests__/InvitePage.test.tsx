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

const PASSWORD_RESET_INVITE = buildInvite({ type: InviteType.password_reset, role: null });

// O InvitePage só existe em /invite e /reset-password, como no router real. O harness padrão monta
// o elemento numa rota "*"; o "*" daqui é o destino do botão "Ir para o login".
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

const continueButton = () => screen.getByRole("button", { name: "Continuar" });
const submitButton = () => screen.getByRole("button", { name: "Enviar cadastro" });

/**
 * Abre o link de cadastro e espera o formulário aparecer (passo 1). Espera o primeiro campo, e não o
 * título: a tela de carregamento também tem um título "Cadastro de membro", só para leitores de tela.
 */
async function openAccessInvite(route = `/invite?token=${TOKEN}`) {
  const view = await renderInvitePage(route);
  await screen.findByLabelText("Nome completo");
  return view;
}

async function fillStepOne(
  user: UserEvent,
  values: { name?: string; ra?: string; email?: string } = {},
) {
  await user.type(nameField(), values.name ?? NAME);
  await user.type(raField(), values.ra ?? RA);
  await user.type(emailField(), values.email ?? EMAIL);
}

async function goToStepTwo(user: UserEvent) {
  await fillStepOne(user);
  await user.click(continueButton());
  await screen.findByRole("heading", { level: 2, name: "Crie sua senha" });
}

async function fillPasswords(user: UserEvent, password = PASSWORD, confirmation = password) {
  await user.type(passwordField(), password);
  await user.type(confirmationField(), confirmation);
}

/** Preenche os dois passos e envia. */
async function completeRegistration(user: UserEvent) {
  await goToStepTwo(user);
  await fillPasswords(user);
  await user.click(submitButton());
}

afterEach(() => {
  vi.useRealTimers();
});

describe("InvitePage with an access invite", () => {
  it("shows the granted role and the step 1 fields for an access invite", async () => {
    const tokens: string[] = [];
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ onCall: (token) => tokens.push(token) }),
    );
    await openAccessInvite();

    expect(screen.getByText("Você foi convidado como Membro")).toBeVisible();
    expect(screen.getByText("Preencha seus dados para criar o seu acesso ao TEDI.")).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Dados pessoais" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Dados acadêmicos" })).toBeVisible();
    for (const field of [nameField(), raField(), emailField()]) {
      expect(field).toBeVisible();
      expect(field).toBeRequired();
    }
    expect(raField()).toHaveAccessibleDescription("Você vai entrar no sistema com este RA.");
    expect(screen.getByText("* Campos obrigatórios")).toBeVisible();
    expect(continueButton()).toBeVisible();
    expect(screen.getByRole("list", { name: "Etapa 1 de 2" })).toBeVisible();
    // Só o passo 1: a senha ainda não foi pedida e nada foi enviado.
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voltar" })).not.toBeInTheDocument();
    expect(tokens).toEqual([TOKEN]);
    expect(document.title).toBe("Cadastro de membro");
  });

  it.each([
    [Role.director, "Você foi convidado como Diretor"],
    [Role.coordinator, "Você foi convidado como Coordenadora"],
    [null, "Você foi convidado para o TEDI"],
    // O back recusa superadmin em convite, mas o tipo gerado o permite: nunca vira um nome na tela.
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
    // A tela nova substitui o formulário: o foco vai para o título, e não se perde com o botão que saiu.
    await waitFor(() => expect(title).toHaveFocus());
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    // O corpo é exatamente o DTO: token da URL e os quatro campos, sem a confirmação da senha.
    expect(accepted).toStrictEqual([
      { token: TOKEN, name: NAME, ra: RA, email: EMAIL, password: PASSWORD },
    ]);
    expect(router.state.location.pathname).toBe("/invite");

    await user.click(screen.getByRole("button", { name: "Ir para o login" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(screen.getByText("Destino do redirecionamento")).toBeInTheDocument();
    // O endereço do convite (de uso único) não fica no histórico, ao alcance do "voltar".
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

    await fillStepOne(user, { name: `  ${NAME} `, ra: ` ${RA} `, email: ` ${EMAIL} ` });
    await user.click(continueButton());
    await screen.findByRole("heading", { level: 2, name: "Crie sua senha" });
    await fillPasswords(user);
    await user.click(submitButton());

    await screen.findByRole("heading", { name: "Cadastro concluído!" });
    expect(accepted).toStrictEqual([
      { token: TOKEN, name: NAME, ra: RA, email: EMAIL, password: PASSWORD },
    ]);
    // A tela de sucesso mostra o RA aparado, o mesmo que foi enviado.
    expect(
      screen.getByText(
        `Agora você já pode entrar com o seu RA (${RA}) e a senha que acabou de criar.`,
      ),
    ).toBeVisible();
  });

  it("serves the same page on /reset-password", async () => {
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite(`/reset-password?token=${TOKEN}`);

    expect(screen.getByText("Você foi convidado como Membro")).toBeVisible();
    expect(nameField()).toBeVisible();
  });

  it("does not redirect a user who is already signed in", async () => {
    let meCalls = 0;
    server.use(
      meHandler({ user: buildMeUser(), onCall: () => (meCalls += 1) }),
      getInviteHandler(),
    );
    const { router } = await openAccessInvite();

    // Quem está logado pode estar abrindo o link de outra pessoa num computador compartilhado.
    await waitFor(() => expect(meCalls).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getByText("Você foi convidado como Membro")).toBeVisible());
    expect(router.state.location.pathname).toBe("/invite");
    expect(nameField()).toBeVisible();
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

    expect(
      await screen.findByRole("heading", { level: 1, name: "Criar nova senha" }),
    ).toBeVisible();
    expect(passwordField()).toBeVisible();
    expect(confirmationField()).toBeVisible();
    expect(screen.getByRole("button", { name: "Salvar nova senha" })).toBeVisible();
    // Nada do cadastro: nem nome, RA ou e-mail, nem etapas, nem a etiqueta do perfil.
    expect(screen.queryByLabelText("Nome completo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("RA")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("E-mail institucional")).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByText(/Você foi convidado/)).not.toBeInTheDocument();
    expect(container.querySelectorAll("input")).toHaveLength(2);
    expect(document.title).toBe("Criar nova senha");
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
    await screen.findByRole("heading", { name: "Criar nova senha" });

    await fillPasswords(user);
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    const title = await screen.findByRole("heading", { level: 1, name: "Senha alterada!" });
    await waitFor(() => expect(title).toHaveFocus());
    // Só as duas chaves: nome, RA ou e-mail vazios virariam 400 no back, e a confirmação não vai.
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
    await screen.findByRole("heading", { name: "Criar nova senha" });

    await fillPasswords(user, "1234567", "12345678");
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(await screen.findByText("A senha deve ter no mínimo 8 caracteres")).toBeInTheDocument();
    expect(screen.getByText("As senhas não são iguais")).toBeInTheDocument();
    expect(passwordField()).toHaveAttribute("aria-invalid", "true");
    expect(confirmationField()).toHaveAttribute("aria-invalid", "true");
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
    await screen.findByRole("heading", { name: "Criar nova senha" });

    await fillPasswords(user);
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conectar");
    await waitFor(() => expect(passwordField()).toHaveFocus());
    expect(passwordField()).toBeEnabled();
    expect(passwordField()).toHaveValue(PASSWORD);
  });

  it("shows the generic message when the API answers an unexpected error", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ invite: PASSWORD_RESET_INVITE }),
      // Um 409 de RA ou de e-mail não existe neste ramo: se vier, não tem campo para apontar.
      acceptInviteHandler({ error: { statusCode: 409, error: "RA_ALREADY_IN_USE" } }),
    );
    await renderInvitePage(`/invite?token=${TOKEN}`);
    await screen.findByRole("heading", { name: "Criar nova senha" });

    await fillPasswords(user);
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
    await screen.findByRole("heading", { name: "Criar nova senha" });

    await fillPasswords(user);
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(INVALID_INVITE_TITLE);
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
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
    expect(alert).toHaveTextContent(
      "O link de cadastro vale por 48 horas e só pode ser usado uma vez.",
    );
    expect(alert).toHaveTextContent("Peça um novo à coordenação.");
    expect(screen.getByRole("heading", { level: 1, name: INVALID_INVITE_TITLE })).toBeVisible();
    expect(screen.getByRole("button", { name: "Ir para o login" })).toBeVisible();
    // Nenhum campo, nem formulário.
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(container.querySelectorAll("input, form")).toHaveLength(0);
  });

  // O hook gerado monta o caminho por interpolação, sem codificar: um link adulterado ou truncado
  // não pode mudar o caminho do GET (ex.: virar /auth/invites/abc/def, ou levar uma query junto).
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

    // O link foi usado ou expirou enquanto a pessoa preenchia: a tela inteira dá lugar ao aviso.
    expect(await screen.findByRole("alert")).toHaveTextContent(INVALID_INVITE_TITLE);
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nome completo")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  // Sem resposta do back (o Render acordando, ou sem internet) o link pode estar bom: dizer que ele
  // não vale faria a pessoa pedir outro convite à toa, e o de uso único já seria desperdiçado.
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

    // O servidor voltou: o mesmo link, sem recarregar a página.
    server.use(getInviteHandler({ onCall: () => (calls += 1) }));
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("Você foi convidado como Membro")).toBeVisible();
    expect(nameField()).toBeVisible();
    expect(calls).toBe(2);
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

describe("InvitePage step 1", () => {
  it("does not advance to step 2 while step 1 is invalid", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    await user.click(continueButton());

    expect(await screen.findByText("Informe o seu nome completo")).toBeInTheDocument();
    expect(screen.getByText("Informe o seu RA")).toBeInTheDocument();
    expect(screen.getByText("Informe um e-mail válido")).toBeInTheDocument();
    expect(nameField()).toHaveAttribute("aria-invalid", "true");
    expect(nameField()).toHaveAccessibleDescription("Informe o seu nome completo");
    expect(raField()).toHaveAttribute("aria-invalid", "true");
    expect(emailField()).toHaveAttribute("aria-invalid", "true");
    // O foco vai para o primeiro campo com erro, e o passo 2 não abre.
    await waitFor(() => expect(nameField()).toHaveFocus());
    expect(screen.getByRole("list", { name: "Etapa 1 de 2" })).toBeVisible();
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(["lucas", "lucas@", "lucas@instituicao"])(
    "rejects the email %j and keeps the person on step 1",
    async (email) => {
      const user = userEvent.setup();
      server.use(meHandler({ user: null }), getInviteHandler());
      await openAccessInvite();

      await fillStepOne(user, { email });
      await user.click(continueButton());

      expect(await screen.findByText("Informe um e-mail válido")).toBeInTheDocument();
      expect(emailField()).toHaveAttribute("aria-invalid", "true");
      expect(nameField()).not.toHaveAttribute("aria-invalid", "true");
      expect(raField()).not.toHaveAttribute("aria-invalid", "true");
      await waitFor(() => expect(emailField()).toHaveFocus());
      expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    },
  );

  it("does not accept a name of only spaces", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    await fillStepOne(user, { name: "   " });
    await user.click(continueButton());

    expect(await screen.findByText("Informe o seu nome completo")).toBeInTheDocument();
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
  });

  it("clears an error as soon as the field is fixed, without pressing Continue again", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await user.click(continueButton());
    await screen.findByText("Informe o seu nome completo");

    await user.type(nameField(), NAME);

    await waitFor(() => expect(nameField()).not.toHaveAttribute("aria-invalid", "true"));
    expect(screen.queryByText("Informe o seu nome completo")).not.toBeInTheDocument();
    // Os campos que ainda estão errados continuam apontados.
    expect(raField()).toHaveAttribute("aria-invalid", "true");
    expect(emailField()).toHaveAttribute("aria-invalid", "true");
  });

  it("advances to step 2 with Enter instead of sending the registration", async () => {
    const user = userEvent.setup();
    let posts = 0;
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ onCall: () => (posts += 1) }),
    );
    await openAccessInvite();

    await fillStepOne(user);
    await user.type(emailField(), "{Enter}");

    expect(await screen.findByRole("heading", { level: 2, name: "Crie sua senha" })).toBeVisible();
    expect(posts).toBe(0);
  });

  it("does not advance with Enter while step 1 is invalid", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    await user.type(nameField(), `${NAME}{Enter}`);

    expect(await screen.findByText("Informe o seu RA")).toBeInTheDocument();
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
  });
});

describe("InvitePage step 2", () => {
  it("shows the summary of the typed name and RA above the password fields", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    await goToStepTwo(user);

    const summary = screen.getByText(
      (_content, element) =>
        element?.tagName === "P" && element.textContent?.includes(NAME) === true,
    );
    expect(summary).toHaveTextContent(
      `${NAME} · RA ${RA} — é com este RA e a senha abaixo que você entra no sistema.`,
    );
    // O "RA" e o número não se separam numa quebra de linha no celular: o espaço entre eles é um
    // espaço sem quebra, que já vem assim do texto traduzido.
    expect(summary.textContent).toContain(`RA${NO_BREAK_SPACE}${RA}`);
    expect(
      screen.getByText("Último passo: crie a senha que você vai usar para entrar no TEDI."),
    ).toBeVisible();
    expect(passwordField()).toHaveAccessibleDescription("Mínimo de 8 caracteres.");
    expect(confirmationField()).toHaveAccessibleDescription("Digite a mesma senha de novo.");
    expect(passwordField()).toBeRequired();
    expect(confirmationField()).toBeRequired();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeVisible();
    expect(submitButton()).toBeVisible();
    // O passo 1 saiu da tela: só o resumo o representa.
    expect(screen.queryByLabelText("Nome completo")).not.toBeInTheDocument();
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
    await goToStepTwo(user);

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
    await goToStepTwo(user);

    await fillPasswords(user, "12345678", "12345679");
    await user.click(submitButton());

    expect(await screen.findByText("As senhas não são iguais")).toBeInTheDocument();
    // O erro fica na confirmação, o campo que a pessoa precisa redigitar.
    expect(confirmationField()).toHaveAttribute("aria-invalid", "true");
    expect(confirmationField()).toHaveAccessibleDescription("As senhas não são iguais");
    expect(passwordField()).not.toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(confirmationField()).toHaveFocus());
    expect(posts).toBe(0);
  });

  it("clears the mismatch error once the password is corrected to match", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToStepTwo(user);
    await fillPasswords(user, "12345678", "12345679");
    await user.click(submitButton());
    await screen.findByText("As senhas não são iguais");

    // Corrige a senha (e não a confirmação): o erro da confirmação não pode ficar para trás.
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
    await goToStepTwo(user);
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
  it("keeps the typed data when going back to step 1", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToStepTwo(user);
    await fillPasswords(user);

    await user.click(screen.getByRole("button", { name: "Voltar" }));

    expect(await screen.findByRole("list", { name: "Etapa 1 de 2" })).toBeVisible();
    expect(nameField()).toHaveValue(NAME);
    expect(raField()).toHaveValue(RA);
    expect(emailField()).toHaveValue(EMAIL);
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();

    await user.click(continueButton());

    // Ida e volta não perde nem a senha já digitada.
    await screen.findByRole("heading", { level: 2, name: "Crie sua senha" });
    expect(passwordField()).toHaveValue(PASSWORD);
    expect(confirmationField()).toHaveValue(PASSWORD);
  });

  it("moves focus to the step heading and announces the step change", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    // No passo 1 a região já está no DOM, vazia e educada: só assim o anúncio seguinte é lido.
    const announcement = screen.getByRole("status");
    expect(announcement).toBeEmptyDOMElement();
    expect(announcement).toHaveAttribute("aria-live", "polite");
    expect(document.body).toHaveFocus();

    await goToStepTwo(user);

    const stepTwoHeading = screen.getByRole("heading", { level: 2, name: "Crie sua senha" });
    await waitFor(() => expect(stepTwoHeading).toHaveFocus());
    expect(screen.getByText("Etapa 2 de 2: Crie sua senha")).toBe(announcement);
    const list = screen.getByRole("list", { name: "Etapa 2 de 2" });
    const [first, second] = within(list).getAllByRole("listitem");
    expect(first).toHaveTextContent("Seus dados");
    expect(first).toHaveTextContent("concluída");
    expect(first).not.toHaveAttribute("aria-current");
    expect(second).toHaveAttribute("aria-current", "step");

    await user.click(screen.getByRole("button", { name: "Voltar" }));

    const stepOneHeading = await screen.findByRole("heading", { level: 2, name: "Dados pessoais" });
    await waitFor(() => expect(stepOneHeading).toHaveFocus());
    expect(screen.getByText("Etapa 1 de 2: Seus dados")).toBe(announcement);
  });
});

describe("InvitePage errors from the API", () => {
  it("shows the RA-in-use error on the RA field and keeps the form open", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ error: { statusCode: 409, error: "RA_ALREADY_IN_USE" } }),
    );
    const { router } = await openAccessInvite();

    await completeRegistration(user);

    // Volta ao passo 1 com o erro no campo e o foco nele, sem perder nada do que foi digitado.
    await waitFor(() => expect(raField()).toHaveAttribute("aria-invalid", "true"));
    expect(raField()).toHaveAccessibleDescription("Este RA já está em uso");
    await waitFor(() => expect(raField()).toHaveFocus());
    expect(nameField()).toHaveValue(NAME);
    expect(raField()).toHaveValue(RA);
    expect(emailField()).toHaveValue(EMAIL);
    expect(nameField()).not.toHaveAttribute("aria-invalid", "true");
    expect(emailField()).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("list", { name: "Etapa 1 de 2" })).toBeVisible();
    // O formulário continua aberto: nem sucesso, nem tela de link inválido, nem alerta geral.
    expect(screen.queryByRole("heading", { name: "Cadastro concluído!" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/invite");
    // Os campos voltaram a aceitar digitação.
    expect(raField()).toBeEnabled();
  });

  it("shows the email-in-use error on the email field", async () => {
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
    expect(nameField()).toHaveValue(NAME);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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
    await screen.findByRole("heading", { level: 2, name: "Crie sua senha" });
    // Nenhum erro do envio anterior volta ao passo 2.
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
    // Continua no passo 2, com os campos livres, o foco na senha e o aviso ligado a ela.
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

  it("does not bring an error of the failed attempt back after going through step 1 again", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" } }),
    );
    await openAccessInvite();
    await completeRegistration(user);
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "Voltar" }));
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
    await goToStepTwo(user);
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
    expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();
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
    await screen.findByRole("heading", { name: "Criar nova senha" });
    await fillPasswords(user);

    const button = screen.getByRole("button", { name: "Salvar nova senha" });
    await user.dblClick(button);
    await user.click(button);

    await screen.findByRole("button", { name: "Enviando…" });
    expect(passwordField()).toBeDisabled();
    await waitFor(() => expect(posts).toBeGreaterThan(0));
    expect(posts).toBe(1);

    deferred.resolve();
    await screen.findByRole("heading", { name: "Senha alterada!" });
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
    await goToStepTwo(user);
    // A região do aviso (a `div`; a `p` é o anúncio de troca de passo) já está no DOM, vazia.
    const region = container.querySelector<HTMLElement>("div[role='status']");
    expect(region).toBeEmptyDOMElement();

    await fillPasswords(user);
    await user.click(submitButton());
    await screen.findByRole("button", { name: "Enviando…" });
    act(() => {
      vi.advanceTimersByTime(SLOW_NOTICE_DELAY_MS);
    });

    await waitFor(() => expect(region).toHaveTextContent(SLOW_NOTICE));
    // O texto entrou na região que já estava no DOM, e não numa região nova.
    expect(container.querySelector("div[role='status']")).toBe(region);

    deferred.resolve();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível enviar o cadastro. Tente novamente.",
    );
    await waitFor(() => expect(region).toBeEmptyDOMElement());
  });
});

describe("InvitePage accessibility", () => {
  // Exceção consciente à regra "asserção por papel, não por classe": o jsdom não carrega CSS (o
  // getBoundingClientRect devolve 0), então alvo de 44px e fonte de 16px só são verificáveis pelas
  // classes do Tailwind. A medida real é conferida no navegador.
  it("renders 44px targets and 16px text", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    for (const field of [nameField(), raField(), emailField()]) {
      expect(field).toHaveClass("min-h-11", "text-base");
    }
    expect(continueButton()).toHaveClass("min-h-11", "text-base");
    expect(screen.getByRole("heading", { level: 2, name: "Dados pessoais" })).toHaveClass(
      "text-base",
    );
    expect(screen.getByText("Preencha seus dados para criar o seu acesso ao TEDI.")).toHaveClass(
      "text-base",
    );
    expect(screen.getByText("Você foi convidado como Membro")).toHaveClass("text-base");

    await goToStepTwo(user);

    for (const field of [passwordField(), confirmationField()]) {
      expect(field).toHaveClass("min-h-11", "text-base");
    }
    for (const eye of [
      screen.getByRole("button", { name: "Mostrar senha" }),
      screen.getByRole("button", { name: "Mostrar confirmação da senha" }),
    ]) {
      expect(eye).toHaveClass("min-h-11", "min-w-11");
    }
    expect(screen.getByRole("button", { name: "Voltar" })).toHaveClass("min-h-11", "text-base");
    expect(submitButton()).toHaveClass("min-h-11", "text-base");
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
    expect(screen.getByText(/O link de cadastro vale por 48 horas/)).toHaveClass("text-base");
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
    expect(nameField()).toHaveFocus();
    await user.keyboard(NAME);
    await user.tab();
    expect(raField()).toHaveFocus();
    await user.keyboard(RA);
    await user.tab();
    expect(emailField()).toHaveFocus();
    await user.keyboard(EMAIL);
    await user.tab();
    expect(continueButton()).toHaveFocus();
    await user.keyboard("{Enter}");

    await screen.findByRole("heading", { level: 2, name: "Crie sua senha" });
    await user.tab();
    expect(passwordField()).toHaveFocus();
    await user.keyboard(PASSWORD);
    await user.tab();
    // O botão do olho fica entre a senha e a confirmação.
    expect(screen.getByRole("button", { name: "Mostrar senha" })).toHaveFocus();
    await user.tab();
    expect(confirmationField()).toHaveFocus();
    await user.keyboard(PASSWORD);
    await user.tab();
    expect(screen.getByRole("button", { name: "Mostrar confirmação da senha" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Voltar" })).toHaveFocus();
    await user.tab();
    expect(submitButton()).toHaveFocus();
    await user.keyboard("{Enter}");

    await screen.findByRole("heading", { name: "Cadastro concluído!" });
    expect(accepted).toHaveLength(1);
  });
});
