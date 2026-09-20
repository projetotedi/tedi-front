import { act, screen, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LoginDto } from "@api/generated/model";

import { AuthProvider } from "../AuthProvider";
import { SLOW_NOTICE_DELAY_MS } from "../hooks/useSlowRequestNotice";
import { LoginPage } from "../pages/LoginPage";
import { buildMeUser, loginHandler, meHandler } from "./handlers";
import { renderWithProviders, server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

const RA = "202400001";
const PASSWORD = "senha-segura-1";
const SLOW_NOTICE = "Conectando ao servidor, isso pode levar até um minuto";

// O LoginPage só existe em /login, como no router real. O harness padrão monta o elemento numa
// rota "*", em que ele continuaria montado depois do redirecionamento e redirecionaria de novo.
function renderLoginPage(route: string) {
  return renderWithProviders(
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
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

function raField() {
  return screen.getByLabelText("Matrícula (RA)");
}

function passwordField() {
  return screen.getByLabelText("Senha");
}

async function fillAndSubmit(user: UserEvent, values: Partial<LoginDto> = {}) {
  await user.type(raField(), values.ra ?? RA);
  await user.type(passwordField(), values.password ?? PASSWORD);
  await user.click(screen.getByRole("button", { name: "Entrar" }));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("LoginPage", () => {
  it("shows the expired session message when reason=expired", async () => {
    server.use(meHandler({ user: null }));
    await renderLoginPage("/login?reason=expired");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sua sessão expirou. Entre novamente.",
    );
  });

  it("does not show the expired session message without reason", async () => {
    server.use(meHandler({ user: null }));
    await renderLoginPage("/login");

    await screen.findByRole("heading", { name: "Entrar" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("redirects to returnTo when the session becomes authenticated", async () => {
    server.use(meHandler({ user: buildMeUser() }));
    const { router } = await renderLoginPage("/login?returnTo=%2Fpeople");

    await waitFor(() => expect(router.state.location.pathname).toBe("/people"));
  });

  it("redirects to / when returnTo is an external target", async () => {
    server.use(meHandler({ user: buildMeUser() }));
    const { router } = await renderLoginPage(`/login?returnTo=${encodeURIComponent("//evil.com")}`);

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });
});

describe("LoginPage form", () => {
  it("renders accessible labels, the heading and a 44px submit target", async () => {
    server.use(meHandler({ user: null }));
    await renderLoginPage("/login");

    expect(raField()).toBeInTheDocument();
    expect(passwordField()).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mostrar senha" })).toBeInTheDocument();
    // Exceção consciente à regra "asserção por papel, não por classe": o jsdom não carrega CSS,
    // então a altura de 44px só é verificável pela classe min-h-11 (2.75rem) do Tailwind.
    expect(screen.getByRole("button", { name: "Entrar" })).toHaveClass("min-h-11");
    expect(raField()).toHaveClass("min-h-11", "text-base");
    expect(passwordField()).toHaveClass("min-h-11", "text-base");
  });

  it("shows the password hint", async () => {
    server.use(meHandler({ user: null }));
    await renderLoginPage("/login");

    expect(passwordField()).toHaveAccessibleDescription("Mínimo de 8 caracteres");
  });

  it("shows the forgot-password text as plain text, not as a link or a button", async () => {
    server.use(meHandler({ user: null }));
    await renderLoginPage("/login");

    const text = screen.getByText("Esqueceu a senha?");
    expect(text.tagName).toBe("P");
    expect(text).not.toHaveAttribute("role");
    expect(text).not.toHaveAttribute("tabindex");
    expect(text.closest("a, button")).toBeNull();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /esqueceu/i })).not.toBeInTheDocument();
  });

  // Exceção consciente à regra "asserção por papel, não por classe": o jsdom não carrega CSS. O
  // Figma pede o texto azul (token de acento) e à direita, mas sem link nem ação: nada de
  // sublinhado, cursor de link ou hover, para não parecer clicável. Medido no Chrome.
  it("styles the forgot-password text blue and right-aligned without making it look clickable", async () => {
    server.use(meHandler({ user: null }));
    await renderLoginPage("/login");

    const text = screen.getByText("Esqueceu a senha?");
    expect(text).toHaveClass("text-accent", "text-right", "text-base");
    expect(text.className).not.toMatch(/underline|cursor-|hover:|focus/);
  });

  it("signs in and navigates to /", async () => {
    const user = userEvent.setup();
    const calls: LoginDto[] = [];
    server.use(meHandler({ user: null }), loginHandler({ onCall: (body) => calls.push(body) }));
    const { router } = await renderLoginPage("/login");

    await fillAndSubmit(user);

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(screen.getByText("Destino do redirecionamento")).toBeInTheDocument();
    expect(calls).toEqual([{ ra: RA, password: PASSWORD }]);
  });

  it("signs in and navigates to returnTo", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), loginHandler());
    const { router } = await renderLoginPage("/login?returnTo=%2Fpeople");

    await fillAndSubmit(user);

    await waitFor(() => expect(router.state.location.pathname).toBe("/people"));
    expect(router.state.location.search).toBe("");
  });

  it("does not keep /login in the history after signing in", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), loginHandler());
    const { router } = await renderLoginPage("/login");

    await fillAndSubmit(user);
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));

    // replace: o "voltar" do navegador não leva de volta ao formulário de login.
    expect(router.state.historyAction).toBe("REPLACE");
  });

  it("shows a generic message on invalid credentials without pointing at a field", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      loginHandler({ error: { statusCode: 401, error: "INVALID_CREDENTIALS" } }),
    );
    const { router } = await renderLoginPage("/login");

    await fillAndSubmit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("Matrícula ou senha incorretos");
    expect(raField()).not.toHaveAttribute("aria-invalid", "true");
    expect(passwordField()).not.toHaveAttribute("aria-invalid", "true");
    // O 401 do login também dispara tedi:unauthorized, mas o AuthProvider o ignora sem sessão:
    // a URL não pode ganhar ?reason=expired nem sair de /login.
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search).toBe("");
  });

  it("shows the disabled-access message", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      loginHandler({ error: { statusCode: 401, error: "ACCESS_DISABLED" } }),
    );
    await renderLoginPage("/login");

    await fillAndSubmit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Seu acesso está inativo, fale com a coordenação",
    );
  });

  it("shows the rate-limit message", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      loginHandler({ error: { statusCode: 429, error: "TOO_MANY_ATTEMPTS" } }),
    );
    await renderLoginPage("/login");

    await fillAndSubmit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Muitas tentativas, aguarde alguns minutos",
    );
  });

  it("shows the network message when the server cannot be reached", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), loginHandler({ networkError: true }));
    await renderLoginPage("/login");

    await fillAndSubmit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conectar");
  });

  // O Render hiberna e, ao acordar, o proxy costuma devolver 502, 503 ou 504: para a pessoa é o
  // mesmo que não conseguir conectar, e a tela reage como nos outros erros.
  it("shows the network message when the gateway answers 503", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      loginHandler({ error: { statusCode: 503, error: "SERVICE_UNAVAILABLE" } }),
    );
    const { router } = await renderLoginPage("/login");

    await fillAndSubmit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conectar");
    await waitFor(() => expect(raField()).toHaveFocus());
    expect(raField()).not.toHaveAttribute("aria-invalid", "true");
    expect(passwordField()).not.toHaveAttribute("aria-invalid", "true");
    expect(router.state.location.pathname).toBe("/login");
  });

  it("shows the network message when the proxy answers 502 with an HTML page", async () => {
    const user = userEvent.setup();
    // O proxy não devolve o ApiErrorDto: o corpo é HTML ou texto, sem `error` nem `message`.
    server.use(
      meHandler({ user: null }),
      http.post(
        "*/auth/login",
        () =>
          new HttpResponse("<html><body>502 Bad Gateway</body></html>", {
            status: 502,
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );
    await renderLoginPage("/login");

    await fillAndSubmit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conectar");
    await waitFor(() => expect(raField()).toHaveFocus());
  });

  it("shows a fallback message on an unexpected server error", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      loginHandler({ error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" } }),
    );
    await renderLoginPage("/login");

    await fillAndSubmit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível entrar. Tente novamente.",
    );
  });

  it("moves focus back to the RA field after an error", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      loginHandler({ error: { statusCode: 401, error: "INVALID_CREDENTIALS" } }),
    );
    await renderLoginPage("/login");

    await fillAndSubmit(user);

    await screen.findByRole("alert");
    await waitFor(() => expect(raField()).toHaveFocus());
  });

  it("moves focus back to the RA field when the error arrives after the fields were locked", async () => {
    const user = userEvent.setup();
    const deferred = createDeferred();
    server.use(
      meHandler({ user: null }),
      loginHandler({
        delay: deferred.promise,
        error: { statusCode: 401, error: "INVALID_CREDENTIALS" },
      }),
    );
    await renderLoginPage("/login");

    await fillAndSubmit(user);
    // Com os campos já desabilitados no DOM (API lenta), um foco dado antes de reabilitá-los
    // seria ignorado pelo navegador: o foco só pode voltar depois do erro renderizado.
    await screen.findByRole("button", { name: "Entrando…" });
    expect(raField()).toBeDisabled();
    expect(raField()).not.toHaveFocus();

    deferred.resolve();

    await screen.findByRole("alert");
    await waitFor(() => expect(raField()).toHaveFocus());
  });

  it("links the error message to the RA field so it is read together with the focus", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      loginHandler({ error: { statusCode: 401, error: "INVALID_CREDENTIALS" } }),
    );
    await renderLoginPage("/login");

    await fillAndSubmit(user);

    await screen.findByRole("alert");
    expect(raField()).toHaveAccessibleDescription("Matrícula ou senha incorretos");
  });

  it("disables the form while submitting", async () => {
    const user = userEvent.setup();
    const deferred = createDeferred();
    server.use(meHandler({ user: null }), loginHandler({ delay: deferred.promise }));
    await renderLoginPage("/login");

    await fillAndSubmit(user);

    const button = await screen.findByRole("button", { name: "Entrando…" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button.querySelector("[data-slot='spinner']")).toBeInTheDocument();
    expect(raField()).toBeDisabled();
    expect(passwordField()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mostrar senha" })).toBeDisabled();

    deferred.resolve();
    await waitFor(() => expect(screen.getByText("Destino do redirecionamento")).toBeVisible());
  });

  it("does not send a second POST /auth/login on a double click", async () => {
    const user = userEvent.setup();
    const deferred = createDeferred();
    let calls = 0;
    server.use(
      meHandler({ user: null }),
      loginHandler({
        delay: deferred.promise,
        onCall: () => {
          calls += 1;
        },
      }),
    );
    await renderLoginPage("/login");

    await user.type(raField(), RA);
    await user.type(passwordField(), PASSWORD);
    const button = screen.getByRole("button", { name: "Entrar" });
    await user.dblClick(button);
    await user.click(button);
    await user.click(button);

    await waitFor(() => expect(calls).toBeGreaterThan(0));
    expect(calls).toBe(1);

    deferred.resolve();
    await waitFor(() => expect(screen.getByText("Destino do redirecionamento")).toBeVisible());
    expect(calls).toBe(1);
  });

  it("clears the previous error when the next attempt starts", async () => {
    const user = userEvent.setup();
    const deferred = createDeferred();
    server.use(
      meHandler({ user: null }),
      loginHandler({ error: { statusCode: 401, error: "INVALID_CREDENTIALS" } }),
    );
    await renderLoginPage("/login");
    await fillAndSubmit(user);
    await screen.findByRole("alert");

    server.use(loginHandler({ delay: deferred.promise }));
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await screen.findByRole("button", { name: "Entrando…" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    deferred.resolve();
    await waitFor(() => expect(screen.getByText("Destino do redirecionamento")).toBeVisible());
  });

  it("shows the slow-connection notice after 3s and hides it on response", async () => {
    // shouldAdvanceTime: o relógio falso anda junto com o real, senão os timers do React Query e
    // do waitFor nunca disparariam; o salto de 3 s é dado à mão com advanceTimersByTime.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const deferred = createDeferred();
    server.use(meHandler({ user: null }), loginHandler({ delay: deferred.promise }));
    await renderLoginPage("/login");

    await fillAndSubmit(user);
    await screen.findByRole("button", { name: "Entrando…" });
    // A região `status` é fixa: sem aviso ela existe, só não tem o texto.
    const region = screen.getByRole("status");
    expect(region).not.toHaveTextContent(SLOW_NOTICE);

    act(() => {
      vi.advanceTimersByTime(SLOW_NOTICE_DELAY_MS);
    });
    await waitFor(() => expect(region).toHaveTextContent(SLOW_NOTICE));
    // O texto entrou na região que já estava no DOM, e não numa região nova.
    expect(screen.getByRole("status")).toBe(region);

    // Resposta de sucesso: a página redireciona e o formulário (com a região) sai junto.
    deferred.resolve();
    await waitFor(() => expect(screen.queryByText(SLOW_NOTICE)).not.toBeInTheDocument());
  });

  it("has the polite status region in the DOM, empty, before the 3s notice", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const deferred = createDeferred();
    server.use(meHandler({ user: null }), loginHandler({ delay: deferred.promise }));
    await renderLoginPage("/login");

    // Leitores de tela só anunciam mudanças em regiões vivas que já estavam no DOM: ela precisa
    // existir desde o primeiro render, muito antes de o aviso chegar.
    const region = screen.getByRole("status");
    expect(region).toBeEmptyDOMElement();
    expect(region).toHaveAttribute("aria-live", "polite");

    await fillAndSubmit(user);
    await screen.findByRole("button", { name: "Entrando…" });
    act(() => {
      vi.advanceTimersByTime(SLOW_NOTICE_DELAY_MS / 3);
    });
    // Enviando, ainda dentro dos 3 s: continua o mesmo elemento, vazio.
    expect(screen.getByRole("status")).toBe(region);
    expect(region).toBeEmptyDOMElement();

    deferred.resolve();
    await waitFor(() => expect(screen.getByText("Destino do redirecionamento")).toBeVisible());
  });

  it("hides the slow-connection notice when the response is an error", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const deferred = createDeferred();
    server.use(
      meHandler({ user: null }),
      loginHandler({
        delay: deferred.promise,
        error: { statusCode: 401, error: "INVALID_CREDENTIALS" },
      }),
    );
    await renderLoginPage("/login");

    await fillAndSubmit(user);
    await screen.findByRole("button", { name: "Entrando…" });
    act(() => {
      vi.advanceTimersByTime(SLOW_NOTICE_DELAY_MS);
    });
    const region = screen.getByRole("status");
    await waitFor(() => expect(region).toHaveTextContent(SLOW_NOTICE));

    deferred.resolve();

    expect(await screen.findByRole("alert")).toHaveTextContent("Matrícula ou senha incorretos");
    // Com o formulário ainda montado, a região continua no DOM: só perde o texto.
    expect(screen.getByRole("status")).toBe(region);
    await waitFor(() => expect(region).toBeEmptyDOMElement());
    expect(screen.queryByText(SLOW_NOTICE)).not.toBeInTheDocument();
  });

  it("does not show the slow-connection notice when the response is fast", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    // Resposta rápida com erro: o formulário segue montado e dá para provar que a região existe
    // sem o texto (num sucesso a página redireciona e a região sai do DOM junto com ela).
    server.use(
      meHandler({ user: null }),
      loginHandler({ error: { statusCode: 401, error: "INVALID_CREDENTIALS" } }),
    );
    await renderLoginPage("/login");

    await fillAndSubmit(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Matrícula ou senha incorretos");
    act(() => {
      vi.advanceTimersByTime(SLOW_NOTICE_DELAY_MS * 2);
    });

    expect(screen.getByRole("status")).not.toHaveTextContent(SLOW_NOTICE);
    expect(screen.queryByText(SLOW_NOTICE)).not.toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }));
    await renderLoginPage("/login");
    expect(passwordField()).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));

    expect(passwordField()).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar senha" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ocultar senha" }));

    expect(passwordField()).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Mostrar senha" })).toBeInTheDocument();
  });

  it("submits with Enter from the password field", async () => {
    const user = userEvent.setup();
    const calls: LoginDto[] = [];
    server.use(meHandler({ user: null }), loginHandler({ onCall: (body) => calls.push(body) }));
    const { router } = await renderLoginPage("/login");

    await user.type(raField(), RA);
    await user.type(passwordField(), `${PASSWORD}{Enter}`);

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(calls).toEqual([{ ra: RA, password: PASSWORD }]);
  });

  it("is operable by keyboard only", async () => {
    const user = userEvent.setup();
    const calls: LoginDto[] = [];
    server.use(meHandler({ user: null }), loginHandler({ onCall: (body) => calls.push(body) }));
    await renderLoginPage("/login");

    await user.tab();
    expect(raField()).toHaveFocus();
    await user.keyboard(RA);
    await user.tab();
    expect(passwordField()).toHaveFocus();
    await user.keyboard(PASSWORD);
    await user.tab();
    expect(screen.getByRole("button", { name: "Mostrar senha" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Entrar" })).toHaveFocus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(calls).toEqual([{ ra: RA, password: PASSWORD }]));
  });
});

describe("LoginPage validation", () => {
  it("shows a message under each field and does not call the API when the form is empty", async () => {
    const user = userEvent.setup();
    let calls = 0;
    server.use(
      meHandler({ user: null }),
      loginHandler({
        onCall: () => {
          calls += 1;
        },
      }),
    );
    await renderLoginPage("/login");

    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Informe sua matrícula")).toBeInTheDocument();
    expect(screen.getByText("A senha deve ter no mínimo 8 caracteres")).toBeInTheDocument();
    expect(raField()).toHaveAttribute("aria-invalid", "true");
    expect(raField()).toHaveAccessibleDescription("Informe sua matrícula");
    expect(passwordField()).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => expect(raField()).toHaveFocus());
    expect(calls).toBe(0);
  });

  it("rejects a password shorter than 8 characters and clears the message once fixed", async () => {
    const user = userEvent.setup();
    let calls = 0;
    server.use(
      meHandler({ user: null }),
      loginHandler({
        onCall: () => {
          calls += 1;
        },
      }),
    );
    await renderLoginPage("/login");

    await fillAndSubmit(user, { password: "1234567" });

    expect(await screen.findByText("A senha deve ter no mínimo 8 caracteres")).toBeInTheDocument();
    expect(raField()).not.toHaveAttribute("aria-invalid", "true");
    expect(calls).toBe(0);

    await user.type(passwordField(), "8");

    await waitFor(() =>
      expect(screen.queryByText("A senha deve ter no mínimo 8 caracteres")).not.toBeInTheDocument(),
    );
    expect(passwordField()).not.toHaveAttribute("aria-invalid", "true");
    expect(passwordField()).toHaveAccessibleDescription("Mínimo de 8 caracteres");
  });
});
