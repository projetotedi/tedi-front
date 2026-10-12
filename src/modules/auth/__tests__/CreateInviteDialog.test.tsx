import { useState } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getListInvitesQueryKey } from "@api/generated";
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
  await user.click(screen.getByRole("button", { name: "Gerar link de cadastro" }));
  await user.click(screen.getByRole("button", { name: "Gerar link" }));
  await screen.findByLabelText("Link de cadastro");
}

function ControlledDialog() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Abrir de fora
      </button>
      <CreateInviteDialog isOpen={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}

describe("CreateInviteDialog", () => {
  it("focuses the role select when the dialog opens", async () => {
    server.use(createInviteHandler());
    const user = userEvent.setup();
    await renderWithProviders(<CreateInviteDialog />);

    await user.click(screen.getByRole("button", { name: "Gerar link de cadastro" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Perfil/ })).toHaveFocus();
  });

  it("opens from outside when controlled", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<ControlledDialog />);

    await user.click(screen.getByRole("button", { name: "Abrir de fora" }));

    expect(
      await screen.findByRole("dialog", { name: "Gerar link de cadastro" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks the parent to open instead of opening by itself when controlled", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    await renderWithProviders(<CreateInviteDialog isOpen={false} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: "Gerar link de cadastro" }));

    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("every control has an accessible name", async () => {
    server.use(createInviteHandler());
    const user = userEvent.setup();
    await renderWithProviders(<CreateInviteDialog />);

    await user.click(screen.getByRole("button", { name: "Gerar link de cadastro" }));
    const dialog = await screen.findByRole("dialog", { name: "Gerar link de cadastro" });

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

    await user.click(screen.getByRole("button", { name: "Gerar link de cadastro" }));
    await user.click(screen.getByRole("button", { name: /Perfil/ }));
    await user.click(screen.getByRole("option", { name: "Diretor" }));
    await user.click(screen.getByRole("button", { name: "Gerar link" }));

    await waitFor(() => expect(onCall).toHaveBeenCalledWith({ role: "director" }));
    expect(await screen.findByLabelText("Link de cadastro")).toHaveValue(LINK);
  });

  it("exposes the 48h validity warning as the accessible description of the Copiar link button", async () => {
    server.use(createInviteHandler({ response: buildCreateInviteResponse({ url: LINK }) }));
    const user = userEvent.setup();
    await renderWithProviders(<CreateInviteDialog />);

    await openAndGenerate(user);

    const copyButton = screen.getByRole("button", { name: "Copiar link" });
    expect(copyButton).toHaveAccessibleDescription(/Copie o link agora/);
    expect(copyButton).toHaveAccessibleDescription(/48 horas/);
    expect(copyButton).toHaveAccessibleDescription(/Ele não será mostrado de novo\./);
  });

  it("invalidates the invites query after generating", async () => {
    server.use(createInviteHandler({ response: buildCreateInviteResponse({ url: LINK }) }));
    const user = userEvent.setup();
    const { queryClient } = await renderWithProviders(<CreateInviteDialog />);
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    await openAndGenerate(user);

    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: getListInvitesQueryKey() }),
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
    expect(screen.getByLabelText("Link de cadastro")).toHaveFocus();
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

      await user.click(screen.getByRole("button", { name: "Gerar link de cadastro" }));
      expect(await screen.findByRole("dialog")).toBeInTheDocument();
      expect(screen.queryByLabelText("Link de cadastro")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Perfil/ })).toBeInTheDocument();
    });

    it("via the close (X) button", async () => {
      server.use(createInviteHandler({ response: buildCreateInviteResponse({ url: LINK }) }));
      const user = userEvent.setup();
      await renderWithProviders(<CreateInviteDialog />);

      await openAndGenerate(user);
      await user.click(screen.getByRole("button", { name: "Fechar" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Gerar link de cadastro" }));
      expect(await screen.findByRole("dialog")).toBeInTheDocument();
      expect(screen.queryByLabelText("Link de cadastro")).not.toBeInTheDocument();
    });

    it("via Escape", async () => {
      server.use(createInviteHandler({ response: buildCreateInviteResponse({ url: LINK }) }));
      const user = userEvent.setup();
      await renderWithProviders(<CreateInviteDialog />);

      await openAndGenerate(user);
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Gerar link de cadastro" }));
      expect(await screen.findByRole("dialog")).toBeInTheDocument();
      expect(screen.queryByLabelText("Link de cadastro")).not.toBeInTheDocument();
    });
  });

  it("shows a generic error message", async () => {
    server.use(createInviteHandler({ error: { statusCode: 500, error: "INTERNAL" } }));
    const user = userEvent.setup();
    await renderWithProviders(<CreateInviteDialog />);

    await user.click(screen.getByRole("button", { name: "Gerar link de cadastro" }));
    await user.click(screen.getByRole("button", { name: "Gerar link" }));

    expect(
      await screen.findByText("Não foi possível gerar o convite. Tente novamente."),
    ).toBeInTheDocument();
  });

  it("shows a network error message", async () => {
    server.use(createInviteHandler({ networkError: true }));
    const user = userEvent.setup();
    await renderWithProviders(<CreateInviteDialog />);

    await user.click(screen.getByRole("button", { name: "Gerar link de cadastro" }));
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

    await user.click(screen.getByRole("button", { name: "Gerar link de cadastro" }));
    const submit = screen.getByRole("button", { name: "Gerar link" });
    await user.dblClick(submit);
    await user.click(submit);

    await waitFor(() => expect(calls).toBeGreaterThan(0));
    expect(calls).toBe(1);

    deferred.resolve();
    await screen.findByLabelText("Link de cadastro");
    expect(calls).toBe(1);
  });

  describe("cannot be closed while POST /invites is in flight", () => {
    async function startSubmitAndWaitForPending(user: UserEvent) {
      await user.click(screen.getByRole("button", { name: "Gerar link de cadastro" }));
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
      await screen.findByLabelText("Link de cadastro");

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
      await screen.findByLabelText("Link de cadastro");

      await user.click(screen.getByRole("button", { name: "Fechar" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
