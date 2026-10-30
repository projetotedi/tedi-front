import { useState } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getListInvitesQueryKey } from "@api/generated";
import type { AccessResponseDto } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { PasswordResetDialog } from "../components/PasswordResetDialog";
import { buildAccess, buildPasswordResetResponse, createPasswordResetHandler } from "./handlers";
import { renderWithProviders, server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

const LINK = "https://tedi.example/reset-password?token=plain-text-reset-token";
const ANA = buildAccess({
  id: "person-ana",
  name: "Ana Torres",
  ra: "2024RA0001",
  role: Role.member,
});

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

function Harness({ access = ANA }: { access?: AccessResponseDto }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Abrir redefinição
      </button>
      {isOpen ? <PasswordResetDialog access={access} onClose={() => setIsOpen(false)} /> : null}
    </>
  );
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Abrir redefinição" }));
  return screen.findByRole("dialog", { name: "Link de redefinição de senha" });
}

async function openAndGenerate(user: ReturnType<typeof userEvent.setup>) {
  await openDialog(user);
  await user.click(screen.getByRole("button", { name: "Gerar link" }));
  await screen.findByLabelText("Link gerado");
}

describe("PasswordResetDialog", () => {
  it("asks for confirmation first, with the person's summary, and sends nothing yet", async () => {
    const onCall = vi.fn();
    server.use(createPasswordResetHandler({ onCall }));
    const user = userEvent.setup();
    await renderWithProviders(<Harness />);

    const dialog = await openDialog(user);

    expect(within(dialog).getByText("Ana Torres · RA 2024RA0001")).toBeInTheDocument();
    expect(within(dialog).getByText("Perfil atual: Membro")).toBeInTheDocument();
    expect(dialog).toHaveAccessibleDescription(
      "Gera um link de uso único para a pessoa criar uma nova senha.",
    );
    expect(within(dialog).getByRole("button", { name: "Voltar" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Gerar link" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Fechar" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Link gerado")).not.toBeInTheDocument();
    expect(onCall).not.toHaveBeenCalled();
  });

  it("confirming posts the reset for that person and shows the link", async () => {
    const onCall = vi.fn();
    server.use(
      createPasswordResetHandler({ response: buildPasswordResetResponse({ url: LINK }), onCall }),
    );
    const user = userEvent.setup();
    await renderWithProviders(<Harness />);

    await openAndGenerate(user);

    expect(onCall).toHaveBeenCalledTimes(1);
    expect(onCall).toHaveBeenCalledWith("person-ana");
    expect(screen.getByLabelText("Link gerado")).toHaveValue(LINK);
    expect(screen.getByRole("button", { name: "Copiar link" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Concluir" })).toBeInTheDocument();
    expect(screen.getByText("Ana Torres · RA 2024RA0001")).toBeInTheDocument();
  });

  it("states the 48 hours validity as the description of Copiar link", async () => {
    server.use(createPasswordResetHandler({ response: buildPasswordResetResponse({ url: LINK }) }));
    const user = userEvent.setup();
    await renderWithProviders(<Harness />);

    await openAndGenerate(user);

    const copyButton = screen.getByRole("button", { name: "Copiar link" });
    expect(copyButton).toHaveFocus();
    expect(copyButton).toHaveAccessibleDescription(/Vale por 48 horas e só pode ser usado uma vez/);
    expect(copyButton).toHaveAccessibleDescription(/O link não aparece de novo depois de fechar/);
  });

  it("Copiar link writes the url to the clipboard", async () => {
    server.use(createPasswordResetHandler({ response: buildPasswordResetResponse({ url: LINK }) }));
    // userEvent.setup() instala o próprio stub de clipboard; o mock só vale depois dele.
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    await renderWithProviders(<Harness />);

    await openAndGenerate(user);
    await user.click(screen.getByRole("button", { name: "Copiar link" }));

    expect(writeText).toHaveBeenCalledWith(LINK);
    expect(await screen.findByText("Link copiado.")).toBeInTheDocument();
  });

  describe("closing and reopening does not show the link again", () => {
    it("via Concluir", async () => {
      server.use(
        createPasswordResetHandler({ response: buildPasswordResetResponse({ url: LINK }) }),
      );
      const user = userEvent.setup();
      await renderWithProviders(<Harness />);

      await openAndGenerate(user);
      await user.click(screen.getByRole("button", { name: "Concluir" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      await openDialog(user);
      expect(screen.queryByLabelText("Link gerado")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Gerar link" })).toBeInTheDocument();
    });

    it("via the close (X) button", async () => {
      server.use(
        createPasswordResetHandler({ response: buildPasswordResetResponse({ url: LINK }) }),
      );
      const user = userEvent.setup();
      await renderWithProviders(<Harness />);

      await openAndGenerate(user);
      await user.click(screen.getByRole("button", { name: "Fechar" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      await openDialog(user);
      expect(screen.queryByLabelText("Link gerado")).not.toBeInTheDocument();
    });

    it("via Escape", async () => {
      server.use(
        createPasswordResetHandler({ response: buildPasswordResetResponse({ url: LINK }) }),
      );
      const user = userEvent.setup();
      await renderWithProviders(<Harness />);

      await openAndGenerate(user);
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      await openDialog(user);
      expect(screen.queryByLabelText("Link gerado")).not.toBeInTheDocument();
    });
  });

  it("invalidates the pending invites after generating", async () => {
    server.use(createPasswordResetHandler());
    const user = userEvent.setup();
    const { queryClient } = await renderWithProviders(<Harness />);
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    await openAndGenerate(user);

    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: getListInvitesQueryKey() }),
    );
  });

  it("Voltar closes without calling the API", async () => {
    const onCall = vi.fn();
    server.use(createPasswordResetHandler({ onCall }));
    const user = userEvent.setup();
    await renderWithProviders(<Harness />);

    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Voltar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onCall).not.toHaveBeenCalled();
  });

  describe("errors", () => {
    it("shows the network error and keeps the confirm step so the person can try again", async () => {
      server.use(createPasswordResetHandler({ networkError: true }));
      const user = userEvent.setup();
      await renderWithProviders(<Harness />);

      await openDialog(user);
      await user.click(screen.getByRole("button", { name: "Gerar link" }));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Não foi possível conectar. Tente de novo.");
      await waitFor(() => expect(alert.parentElement).toHaveFocus());
      expect(screen.getByRole("button", { name: "Gerar link" })).toBeEnabled();
      expect(screen.queryByLabelText("Link gerado")).not.toBeInTheDocument();

      server.use(
        createPasswordResetHandler({ response: buildPasswordResetResponse({ url: LINK }) }),
      );
      await user.click(screen.getByRole("button", { name: "Gerar link" }));

      expect(await screen.findByLabelText("Link gerado")).toHaveValue(LINK);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("explains that the access no longer exists on 404", async () => {
      server.use(createPasswordResetHandler({ error: { statusCode: 404, error: "NOT_FOUND" } }));
      const user = userEvent.setup();
      await renderWithProviders(<Harness />);

      await openDialog(user);
      await user.click(screen.getByRole("button", { name: "Gerar link" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Este acesso não existe mais. Atualize a lista.",
      );
    });

    it("shows a generic error for an unexpected failure", async () => {
      server.use(
        createPasswordResetHandler({ error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" } }),
      );
      const user = userEvent.setup();
      await renderWithProviders(<Harness />);

      await openDialog(user);
      await user.click(screen.getByRole("button", { name: "Gerar link" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível concluir. Tente de novo.",
      );
    });
  });

  describe("while generating", () => {
    async function startGenerating() {
      const deferred = createDeferred();
      const onCall = vi.fn();
      server.use(
        createPasswordResetHandler({
          delay: deferred.promise,
          response: buildPasswordResetResponse({ url: LINK }),
          onCall,
        }),
      );
      const user = userEvent.setup();
      await renderWithProviders(<Harness />);
      await openDialog(user);
      await user.click(screen.getByRole("button", { name: "Gerar link" }));
      await screen.findByRole("button", { name: "Gerando…" });
      return { user, deferred, onCall };
    }

    it("blocks Escape, the close button and Voltar until the answer arrives", async () => {
      const { user, deferred } = await startGenerating();

      await user.keyboard("{Escape}");
      await user.click(screen.getByRole("button", { name: "Fechar" }));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();

      deferred.resolve();
      expect(await screen.findByLabelText("Link gerado")).toHaveValue(LINK);

      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("does not post a second reset on a double click", async () => {
      const deferred = createDeferred();
      const onCall = vi.fn();
      server.use(createPasswordResetHandler({ delay: deferred.promise, onCall }));
      const user = userEvent.setup();
      await renderWithProviders(<Harness />);
      await openDialog(user);

      await user.dblClick(screen.getByRole("button", { name: "Gerar link" }));
      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      deferred.resolve();

      await screen.findByLabelText("Link gerado");
      expect(onCall).toHaveBeenCalledTimes(1);
    });
  });
});
