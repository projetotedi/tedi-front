import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { ChangePasswordPage } from "../pages/ChangePasswordPage";
import { buildMeUser, meHandler } from "./handlers";
import { renderRoutes, server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

const ROUTES = [
  { path: "/change-password", element: <ChangePasswordPage /> },
  { path: "/profile", element: <p>Meu perfil</p> },
  { path: "/login", element: <p>Tela de login</p> },
];

function useChangeHandler(answer: () => Response = () => new HttpResponse(null, { status: 200 })) {
  const bodies: unknown[] = [];
  server.use(
    http.post("*/auth/password", async ({ request }) => {
      bodies.push(await request.json());
      return answer();
    }),
  );
  return bodies;
}

async function renderPage(mustChangePassword = true) {
  server.use(meHandler({ user: buildMeUser({ name: "Ana Paula Torres", mustChangePassword }) }));
  return renderRoutes(ROUTES, { route: "/change-password" });
}

async function fillAndSave(password: string, confirmation = password) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Nova senha"), password);
  await user.type(screen.getByLabelText("Confirmar nova senha"), confirmation);
  await user.click(screen.getByRole("button", { name: "Salvar e continuar" }));
}

describe("ChangePasswordPage", () => {
  it("shows the account and asks for the new password twice", async () => {
    useChangeHandler();
    await renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Troque sua senha" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ana Paula Torres")).toBeInTheDocument();
  });

  it("sends only the new password and goes to Meu perfil with a notice", async () => {
    const bodies = useChangeHandler();
    const { router } = await renderPage();

    await fillAndSave("NovaSenha@123");

    await waitFor(() => expect(router.state.location.pathname).toBe("/profile"));
    expect(await screen.findByText("Senha trocada. Bem-vindo ao TEDI!")).toBeInTheDocument();
    expect(bodies).toEqual([{ newPassword: "NovaSenha@123" }]);
  });

  it("does not send when the confirmation differs", async () => {
    const bodies = useChangeHandler();
    await renderPage();

    await fillAndSave("NovaSenha@123", "OutraSenha@123");

    expect(await screen.findByText("As senhas não são iguais")).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  it("puts a 400 PASSWORD_UNCHANGED on the password field", async () => {
    useChangeHandler(() =>
      HttpResponse.json(
        { statusCode: 400, error: "PASSWORD_UNCHANGED", message: "Same." },
        { status: 400 },
      ),
    );
    await renderPage();

    await fillAndSave("SenhaInicial@1");

    expect(
      await screen.findByText("A nova senha precisa ser diferente da senha provisória."),
    ).toBeInTheDocument();
  });

  it("sends who does not need to change the password to Meu perfil", async () => {
    const { router } = await renderPage(false);

    await waitFor(() => expect(router.state.location.pathname).toBe("/profile"));
  });

  it("sends an anonymous visitor to the login, coming back here", async () => {
    server.use(meHandler({ user: null }));
    const { router } = await renderRoutes(ROUTES, { route: "/change-password" });

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(router.state.location.search).toBe("?returnTo=%2Fchange-password");
  });
});
