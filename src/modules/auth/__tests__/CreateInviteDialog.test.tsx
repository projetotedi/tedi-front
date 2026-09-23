import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Role } from "@shared/lib/role";

import { CreateInviteDialog } from "../components/CreateInviteDialog";
import { buildCreateInviteResponse, createInviteHandler } from "./handlers";
import { renderWithProviders, server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

const LINK = "https://tedi.example/invite?token=plain-text-token";

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function mockClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

function clearClipboard() {
  Object.defineProperty(navigator, "clipboard", {
    value: undefined,
    configurable: true,
  });
}

async function openAndGenerate(user: UserEvent) {
  await user.click(screen.getByRole("button", { name: "Gerar convite" }));
  await user.click(screen.getByRole("button", { name: "Gerar link" }));
  await screen.findByLabelText("Link do convite");
}

describe("CreateInviteDialog", () => {
  it("focuses the role select when the dialog opens", async () => {
    server.use(createInviteHandler());
    const user = userEvent.setup();
    await renderWithProviders(<CreateInviteDialog />);

    await user.click(screen.getByRole("button", { name: "Gerar convite" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Perfil/ })).toHaveFocus();
  });

  it("every control has an accessible name", async () => {
    server.use(createInviteHandler());
    const user = userEvent.setup();
    await renderWithProviders(<CreateInviteDialog />);

    await user.click(screen.getByRole("button", { name: "Gerar convite" }));
    const dialog = await screen.findByRole("dialog", { name: "Gerar convite" });

    expect(within(dialog).getByRole("button", { name: /Perfil/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Fechar" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Gerar link" })).toBeInTheDocument();
  });

  it("sends the chosen role and shows the link", async () => {
    const onCall = vi.fn();
    server.use(
      createInviteHandler({
        response: buildCreateInviteResponse({ role: Role.director, url: LINK }),
        onCall,
      }),
    );
    const user = userEvent.setup();
    await renderWithProviders(<CreateInviteDialog />);

    await user.click(screen.getByRole("button", { name: "Gerar convite" }));
    await user.click(screen.getByRole("button", { name: /Perfil/ }));
    await user.click(screen.getByRole("option", { name: "Diretor(a)" }));
    await user.click(screen.getByRole("button", { name: "Gerar link" }));

    await waitFor(() => expect(onCall).toHaveBeenCalledWith({ role: "director" }));
    expect(await screen.findByLabelText("Link do convite")).toHaveValue(LINK);
  });

  it("exposes the 48h validity warning as the accessible description of the Copiar link button", async () => {
    // O botão recebe autoFocus assim que o link aparece: um leitor de tela precisa anunciar o
    // aviso de validade junto do foco, não só mostrá-lo visualmente ao lado.
    server.use(createInviteHandler({ response: buildCreateInviteResponse({ url: LINK }) }));
    const user = userEvent.setup();
    await renderWithProviders(<CreateInviteDialog />);

    await openAndGenerate(user);

    expect(screen.getByRole("button", { name: "Copiar link" })).toHaveAccessibleDescription(
      /48 horas/,
    );
  });

  it("copies the link and shows the confirmation", async () => {
    server.use(createInviteHandler({ response: buildCreateInviteResponse({ url: LINK }) }));
    // userEvent.setup() instala o próprio stub de clipboard (para user.copy()/paste()); o mock
    // desta suíte só pode ser aplicado depois, senão o setup o sobrescreve.
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    await renderWithProviders(<CreateInviteDialog />);

    await openAndGenerate(user);
    await user.click(screen.getByRole("button", { name: "Copiar link" }));

    expect(writeText).toHaveBeenCalledWith(LINK);
    expect(await screen.findByText("Link copiado.")).toBeInTheDocument();
  });

  it("falls back to selecting the link when clipboard is unavailable", async () => {
    server.use(createInviteHandler({ response: buildCreateInviteResponse({ url: LINK }) }));
    const user = userEvent.setup();
    clearClipboard();
    await renderWithProviders(<CreateInviteDialog />);

    await openAndGenerate(user);
    await user.click(screen.getByRole("button", { name: "Copiar link" }));

    expect(await screen.findByText(/Não foi possível copiar automaticamente/)).toBeInTheDocument();
    expect(screen.getByLabelText("Link do convite")).toHaveFocus();
  });

  it("falls back to selecting the link when the clipboard write rejects", async () => {
    server.use(createInviteHandler({ response: buildCreateInviteResponse({ url: LINK }) }));
    const user = userEvent.setup();
    mockClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    await renderWithProviders(<CreateInviteDialog />);

    await openAndGenerate(user);
    await user.click(screen.getByRole("button", { name: "Copiar link" }));

    expect(await screen.findByText(/Não foi possível copiar automaticamente/)).toBeInTheDocument();
  });

  describe("closing and reopening does not show the link again", () => {
    it("via Concluir", async () => {
      server.use(createInviteHandler({ response: buildCreateInviteResponse({ url: LINK }) }));
      const user = userEvent.setup();
      await renderWithProviders(<CreateInviteDialog />);

      await openAndGenerate(user);
      await user.click(screen.getByRole("button", { name: "Concluir" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Gerar convite" }));
      expect(await screen.findByRole("dialog")).toBeInTheDocument();
      expect(screen.queryByLabelText("Link do convite")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Perfil/ })).toBeInTheDocument();
    });

    it("via the close (X) button", async () => {
      server.use(createInviteHandler({ response: buildCreateInviteResponse({ url: LINK }) }));
      const user = userEvent.setup();
      await renderWithProviders(<CreateInviteDialog />);

      await openAndGenerate(user);
      await user.click(screen.getByRole("button", { name: "Fechar" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Gerar convite" }));
      expect(await screen.findByRole("dialog")).toBeInTheDocument();
      expect(screen.queryByLabelText("Link do convite")).not.toBeInTheDocument();
    });

    it("via Escape", async () => {
      server.use(createInviteHandler({ response: buildCreateInviteResponse({ url: LINK }) }));
      const user = userEvent.setup();
      await renderWithProviders(<CreateInviteDialog />);

      await openAndGenerate(user);
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Gerar convite" }));
      expect(await screen.findByRole("dialog")).toBeInTheDocument();
      expect(screen.queryByLabelText("Link do convite")).not.toBeInTheDocument();
    });
  });

  it("shows a generic error message", async () => {
    server.use(createInviteHandler({ error: { statusCode: 500, error: "INTERNAL" } }));
    const user = userEvent.setup();
    await renderWithProviders(<CreateInviteDialog />);

    await user.click(screen.getByRole("button", { name: "Gerar convite" }));
    await user.click(screen.getByRole("button", { name: "Gerar link" }));

    expect(
      await screen.findByText("Não foi possível gerar o convite. Tente novamente."),
    ).toBeInTheDocument();
  });

  it("shows a network error message", async () => {
    server.use(createInviteHandler({ networkError: true }));
    const user = userEvent.setup();
    await renderWithProviders(<CreateInviteDialog />);

    await user.click(screen.getByRole("button", { name: "Gerar convite" }));
    await user.click(screen.getByRole("button", { name: "Gerar link" }));

    expect(await screen.findByText("Não foi possível conectar")).toBeInTheDocument();
  });

  it("does not send a second POST /invites on a double click", async () => {
    const deferred = createDeferred();
    let calls = 0;
    server.use(
      createInviteHandler({
        delay: deferred.promise,
        onCall: () => {
          calls += 1;
        },
      }),
    );
    const user = userEvent.setup();
    await renderWithProviders(<CreateInviteDialog />);

    await user.click(screen.getByRole("button", { name: "Gerar convite" }));
    const submit = screen.getByRole("button", { name: "Gerar link" });
    await user.dblClick(submit);
    await user.click(submit);

    await waitFor(() => expect(calls).toBeGreaterThan(0));
    expect(calls).toBe(1);

    deferred.resolve();
    await screen.findByLabelText("Link do convite");
    expect(calls).toBe(1);
  });

  describe("cannot be closed while POST /invites is in flight", () => {
    // Fechar durante o envio não cancela a mutação (o back já cria o convite) — só esconderia
    // o link gerado, deixando um convite pendente "órfão" sem forma de revogar (fora do escopo
    // desta card). Enquanto isPending, Esc e o botão X devem ser ignorados.
    async function startSubmitAndWaitForPending(user: UserEvent) {
      await user.click(screen.getByRole("button", { name: "Gerar convite" }));
      await user.click(screen.getByRole("button", { name: "Gerar link" }));
      await screen.findByRole("button", { name: "Gerando…" });
    }

    it("ignores Escape until the response arrives, then closes normally", async () => {
      const deferred = createDeferred();
      server.use(
        createInviteHandler({
          delay: deferred.promise,
          response: buildCreateInviteResponse({ url: LINK }),
        }),
      );
      const user = userEvent.setup();
      await renderWithProviders(<CreateInviteDialog />);

      await startSubmitAndWaitForPending(user);

      await user.keyboard("{Escape}");
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Gerando…" })).toBeInTheDocument();

      deferred.resolve();
      await screen.findByLabelText("Link do convite");

      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("ignores the close (X) button until the response arrives, then closes normally", async () => {
      const deferred = createDeferred();
      server.use(
        createInviteHandler({
          delay: deferred.promise,
          response: buildCreateInviteResponse({ url: LINK }),
        }),
      );
      const user = userEvent.setup();
      await renderWithProviders(<CreateInviteDialog />);

      await startSubmitAndWaitForPending(user);

      await user.click(screen.getByRole("button", { name: "Fechar" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Gerando…" })).toBeInTheDocument();

      deferred.resolve();
      await screen.findByLabelText("Link do convite");

      await user.click(screen.getByRole("button", { name: "Fechar" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
