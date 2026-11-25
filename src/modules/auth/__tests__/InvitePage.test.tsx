import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InviteType, type AcceptInviteDto } from "@api/generated/model";
import { AcceptInviteBody } from "@api/generated/zod/auth/auth";
import { Role } from "@shared/lib/role";

import { SLOW_NOTICE_DELAY_MS } from "../hooks/useSlowRequestNotice";
import {
  acceptInviteHandler,
  buildInvite,
  buildMeUser,
  DEPARTMENTS,
  getInviteHandler,
  meHandler,
} from "./handlers";
import {
  chooseOption,
  completeRegistration,
  continueButton,
  createDeferred,
  departmentTrigger,
  fillAcademicStep,
  fillNewPasswords,
  fillPasswords,
  fillPersonalStep,
  goToPersonalStep,
  newPasswordConfirmationField,
  newPasswordField,
  NO_BREAK_SPACE,
  openAccessInvite,
  passwordHeading,
  personalHeading,
  PASSWORD,
  PERSONAL_EMAIL,
  RA,
  REGISTRATION,
  raField,
  renderInvitePage,
  submitButton,
  TOKEN,
  volunteerTermUrlField,
} from "./invite-page-utils";
import { server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

const SLOW_NOTICE = "Conectando ao servidor, isso pode levar até um minuto";
const INVALID_INVITE_TITLE = "Este link não é mais válido";

const RESET_NAME = "Beatriz Nunes Carvalho";
const RESET_RA = "202400003";
const PASSWORD_RESET_INVITE = buildInvite({
  type: InviteType.password_reset,
  role: null,
  person: { name: RESET_NAME, ra: RESET_RA },
});

const SENT_TITLE = "Cadastro enviado!";
const SENT_DESCRIPTION = `A coordenação vai conferir os seus dados. Assim que o cadastro for aprovado, você entra com o seu RA (${RA}) e a senha que acabou de criar.`;

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
    for (const label of [
      "RA",
      "E-mail institucional",
      "Curso da faculdade",
      "Período",
      "Turma da faculdade",
    ]) {
      expect(screen.getByLabelText(label)).toBeVisible();
      expect(screen.getByLabelText(label)).toBeRequired();
    }
    expect(volunteerTermUrlField()).toBeVisible();
    expect(volunteerTermUrlField()).not.toBeRequired();
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

  it("submits the registration in the new format and shows the registration-sent screen", async () => {
    const user = userEvent.setup();
    const accepted: AcceptInviteDto[] = [];
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ onCall: (body) => accepted.push(body) }),
    );
    const { router } = await openAccessInvite();

    await completeRegistration(user);

    const title = await screen.findByRole("heading", { level: 1, name: SENT_TITLE });
    expect(screen.getByText(SENT_DESCRIPTION)).toBeVisible();
    await waitFor(() => expect(title).toHaveFocus());
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    expect(accepted).toStrictEqual([
      { token: TOKEN, password: PASSWORD, registration: REGISTRATION },
    ]);
    expect(AcceptInviteBody.safeParse(accepted[0]).success).toBe(true);
    expect(router.state.location.pathname).toBe("/invite");
  });

  it("does not offer the login on the registration-sent screen", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler(), acceptInviteHandler());
    const { router } = await openAccessInvite();

    await completeRegistration(user);
    await screen.findByRole("heading", { level: 1, name: SENT_TITLE });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("Ir para o login")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/invite");
    expect(router.state.historyAction).toBe("POP");
  });

  it("sends every text without the spaces around it", async () => {
    const user = userEvent.setup();
    const accepted: AcceptInviteDto[] = [];
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ onCall: (body) => accepted.push(body) }),
    );
    await openAccessInvite();

    await fillAcademicStep(user, {
      ra: ` ${RA} `,
      institutionalEmail: ` ${REGISTRATION.institutionalEmail} `,
    });
    await user.click(continueButton());
    await personalHeading();
    await fillPersonalStep(user, {
      name: `  ${REGISTRATION.name} `,
      personalEmail: ` ${PERSONAL_EMAIL} `,
    });
    await user.click(continueButton());
    await passwordHeading();
    await fillPasswords(user);
    await user.click(submitButton());

    await screen.findByRole("heading", { name: SENT_TITLE });
    expect(accepted).toStrictEqual([
      { token: TOKEN, password: PASSWORD, registration: REGISTRATION },
    ]);
    expect(screen.getByText(SENT_DESCRIPTION)).toBeVisible();
  });

  it("sends the optional fields that were filled, including the department of the invite", async () => {
    const user = userEvent.setup();
    const accepted: AcceptInviteDto[] = [];
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ invite: buildInvite({ departments: DEPARTMENTS }) }),
      acceptInviteHandler({ onCall: (body) => accepted.push(body) }),
    );
    await openAccessInvite();

    await fillAcademicStep(user, {
      volunteerTermUrl: "https://drive.google.com/file/d/termo/view",
    });
    await chooseOption(user, departmentTrigger(), "Tecnologia");
    await user.click(continueButton());
    await personalHeading();
    await fillPersonalStep(user, { address: "Rua das Acácias, 120", city: "São Paulo" });
    await chooseOption(user, screen.getByRole("button", { name: /Estado \(UF\)/ }), "SP");
    await user.click(continueButton());
    await passwordHeading();
    await fillPasswords(user);
    await user.click(submitButton());

    await screen.findByRole("heading", { name: SENT_TITLE });
    expect(accepted).toStrictEqual([
      {
        token: TOKEN,
        password: PASSWORD,
        registration: {
          ...REGISTRATION,
          departmentId: DEPARTMENTS[1].id,
          volunteerTermUrl: "https://drive.google.com/file/d/termo/view",
          address: "Rua das Acácias, 120",
          city: "São Paulo",
          state: "SP",
        },
      },
    ]);
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
    await screen.findByRole("heading", { name: SENT_TITLE });

    expect(document.title).not.toContain(secret);
    expect(document.body.innerHTML).not.toContain(secret);
    expect(JSON.stringify({ ...localStorage })).not.toContain(secret);
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(secret);
  });
});

describe("InvitePage registration-sent screen", () => {
  async function sendRegistration(ra = RA) {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler(), acceptInviteHandler());
    await openAccessInvite();
    await goToPersonalStep(user, { ra });
    await fillPersonalStep(user);
    await user.click(continueButton());
    await passwordHeading();
    await fillPasswords(user);
    await user.click(submitButton());
    return screen.findByRole("heading", { level: 1, name: SENT_TITLE });
  }

  it("tells the person that the coordination reviews the registration before the access", async () => {
    await sendRegistration();

    expect(screen.getByText(/A coordenação vai conferir os seus dados./)).toBeVisible();
    expect(screen.getByText(/Assim que o cadastro for aprovado/)).toBeVisible();
    expect(screen.queryByText(/Cadastro concluído/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Agora você já pode entrar/)).not.toBeInTheDocument();
  });

  it("shows the RA without the spaces that were typed around it", async () => {
    await sendRegistration(`  ${RA}  `);

    expect(screen.getByText(SENT_DESCRIPTION)).toBeVisible();
    expect(document.body.textContent).toContain(`RA (${RA})`);
  });

  it("renders the title as the only heading, with 16px text and no control", async () => {
    const title = await sendRegistration();

    expect(title).toHaveClass("text-[22px]");
    expect(screen.getByText(SENT_DESCRIPTION)).toHaveClass("text-base");
    expect(screen.getAllByRole("heading")).toHaveLength(1);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("does not show the form again or let the person send twice", async () => {
    await sendRegistration();

    expect(screen.queryByLabelText("RA")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar cadastro" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
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
    expect(accepted[0]).not.toHaveProperty("registration");

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

  it("shows the generic message when the API rejects the data with a 400", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ invite: PASSWORD_RESET_INVITE }),
      acceptInviteHandler({
        error: {
          statusCode: 400,
          error: "VALIDATION_FAILED",
          details: [{ field: "password", message: "password must be longer" }],
        },
      }),
    );
    await renderInvitePage(`/invite?token=${TOKEN}`);
    await screen.findByRole("heading", { name: "Redefinir senha" });

    await fillNewPasswords(user);
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível salvar a nova senha. Tente novamente.",
    );
    expect(newPasswordField()).toBeEnabled();
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
    expect(router.state.historyAction).toBe("REPLACE");
    expect(screen.getByText("Destino do redirecionamento")).toBeInTheDocument();
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

  it("does not send the password twice on a double click of the form", async () => {
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
