import { act, screen, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
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

  it("shows the password hint and the forgot-password text without a link", async () => {
    server.use(meHandler({ user: null }));
    await renderLoginPage("/login");

    expect(passwordField()).toHaveAccessibleDescription("Mínimo de 8 caracteres");
    expect(screen.getByText("Esqueceu a senha? Fale com a coordenação")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
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
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(SLOW_NOTICE_DELAY_MS);
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Conectando ao servidor, isso pode levar até um minuto",
    );

    deferred.resolve();
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
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
    await screen.findByRole("status");

    deferred.resolve();

    expect(await screen.findByRole("alert")).toHaveTextContent("Matrícula ou senha incorretos");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not show the slow-connection notice when the response is fast", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    server.use(meHandler({ user: null }), loginHandler());
    await renderLoginPage("/login");

    await fillAndSubmit(user);
    await waitFor(() => expect(screen.getByText("Destino do redirecionamento")).toBeVisible());
    act(() => {
      vi.advanceTimersByTime(SLOW_NOTICE_DELAY_MS * 2);
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
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
