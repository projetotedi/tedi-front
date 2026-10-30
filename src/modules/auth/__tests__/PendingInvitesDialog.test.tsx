import { useState } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { getListInvitesQueryKey } from "@api/generated";
import { InviteType, type InviteListItemDto } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { PendingInvitesButton } from "../components/PendingInvitesButton";
import { PendingInvitesDialog } from "../components/PendingInvitesDialog";
import { buildInviteListItem, listInvitesHandler, revokeInviteHandler } from "./handlers";
import { renderWithProviders, server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

const MEMBER_INVITE = buildInviteListItem({
  id: "invite-member",
  role: Role.member,
  createdAt: "2026-09-22T12:00:00.000Z",
  expiresAt: "2026-09-24T12:00:00.000Z",
});
const DIRECTOR_INVITE = buildInviteListItem({
  id: "invite-director",
  role: Role.director,
  createdAt: "2026-09-21T12:00:00.000Z",
  expiresAt: "2026-09-23T12:00:00.000Z",
});
const RESET_INVITE = buildInviteListItem({
  id: "invite-reset",
  type: InviteType.password_reset,
  role: Role.member,
  personId: "person-ana" as unknown as InviteListItemDto["personId"],
  createdAt: "2026-09-22T15:00:00.000Z",
  expiresAt: "2026-09-24T15:00:00.000Z",
});

/** O componente formata no fuso do navegador; o esperado vem do mesmo relógio local, sem fixar fuso. */
function localDateTime(iso: string): string {
  const date = new Date(iso);
  const two = (value: number) => String(value).padStart(2, "0");
  return `${two(date.getDate())}/${two(date.getMonth() + 1)} · ${two(date.getHours())}:${two(date.getMinutes())}`;
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** GET /invites com estado: o DELETE tira o convite da lista, como o back. */
function useStatefulInvites(initial: InviteListItemDto[]) {
  let invites = initial;
  const revoked: string[] = [];
  server.use(
    http.get("*/invites", () => HttpResponse.json(invites)),
    revokeInviteHandler({
      onCall: (id) => {
        revoked.push(id);
        invites = invites.filter((invite) => invite.id !== id);
      },
    }),
  );
  return { revoked, setInvites: (next: InviteListItemDto[]) => (invites = next) };
}

async function openDialog(user: ReturnType<typeof userEvent.setup>, count: number) {
  await user.click(await screen.findByRole("button", { name: `Convites pendentes (${count})` }));
  return screen.findByRole("dialog", { name: `Convites pendentes (${count})` });
}

describe("PendingInvitesDialog", () => {
  describe("the list", () => {
    it("lists role, created and expiry dates", async () => {
      server.use(listInvitesHandler({ data: [MEMBER_INVITE, DIRECTOR_INVITE] }));
      const user = userEvent.setup();
      await renderWithProviders(<PendingInvitesButton />);

      const dialog = await openDialog(user, 2);

      expect(
        within(dialog)
          .getAllByRole("columnheader")
          .map((header) => header.textContent),
      ).toEqual(["Perfil", "Gerado em", "Vence em", "Ações"]);
      const member = within(dialog).getByRole("row", { name: /Membro/ });
      expect(within(member).getAllByRole("cell")[1]).toHaveTextContent(
        localDateTime(MEMBER_INVITE.createdAt),
      );
      expect(within(member).getAllByRole("cell")[2]).toHaveTextContent(
        localDateTime(MEMBER_INVITE.expiresAt),
      );
      const director = within(dialog).getByRole("row", { name: /Diretor/ });
      expect(within(director).getAllByRole("cell")[1]).toHaveTextContent(
        localDateTime(DIRECTOR_INVITE.createdAt),
      );
      expect(within(dialog).getAllByRole("button", { name: /^Revogar/ })).toHaveLength(2);
    });

    it("shows the title with the count, the description and the notice", async () => {
      server.use(listInvitesHandler({ data: [MEMBER_INVITE, DIRECTOR_INVITE] }));
      const user = userEvent.setup();
      await renderWithProviders(<PendingInvitesButton />);

      const dialog = await openDialog(user, 2);

      expect(dialog).toHaveClass("max-w-200");
      expect(dialog).toHaveAccessibleDescription(
        "Links de cadastro gerados que ainda não foram usados nem venceram.",
      );
      expect(
        within(dialog).getByText(
          "Revogar invalida o link na hora; quem abrir verá “Este link não é mais válido”. Convites usados ou vencidos saem desta lista.",
        ),
      ).toBeInTheDocument();
      expect(within(dialog).queryByRole("columnheader", { name: "Gerado por" })).toBeNull();
    });

    it("shows a password reset link as Redefinição de senha", async () => {
      server.use(listInvitesHandler({ data: [MEMBER_INVITE, RESET_INVITE] }));
      const user = userEvent.setup();
      await renderWithProviders(<PendingInvitesButton />);

      const dialog = await openDialog(user, 2);

      const reset = within(dialog).getByRole("row", { name: /Redefinição de senha/ });
      expect(within(reset).getAllByRole("cell")[0]).toHaveTextContent("Redefinição de senha");
      expect(
        within(reset).getByRole("button", {
          name: `Revogar link de redefinição de senha gerado em ${localDateTime(RESET_INVITE.createdAt)}`,
        }),
      ).toBeInTheDocument();
    });

    it("names each Revogar button after the invite, starting with the visible text", async () => {
      server.use(listInvitesHandler({ data: [MEMBER_INVITE] }));
      const user = userEvent.setup();
      await renderWithProviders(<PendingInvitesButton />);

      const dialog = await openDialog(user, 1);

      const revoke = within(dialog).getByRole("button", {
        name: `Revogar convite de Membro gerado em ${localDateTime(MEMBER_INVITE.createdAt)}`,
      });
      expect(revoke).toHaveTextContent("Revogar");
      expect(revoke).toHaveClass("button--danger-soft", "min-h-11");
    });

    it("shows the empty message with no pending invites", async () => {
      server.use(listInvitesHandler({ data: [] }));
      const user = userEvent.setup();
      await renderWithProviders(<PendingInvitesButton />);

      const dialog = await openDialog(user, 0);

      expect(within(dialog).getByText("Nenhum convite pendente.")).toBeInTheDocument();
      expect(within(dialog).queryByRole("button", { name: /^Revogar/ })).not.toBeInTheDocument();
    });

    it("Fechar closes the dialog", async () => {
      server.use(listInvitesHandler({ data: [MEMBER_INVITE] }));
      const user = userEvent.setup();
      await renderWithProviders(<PendingInvitesButton />);

      const dialog = await openDialog(user, 1);
      // Dois botões se chamam Fechar: o X do canto (primeiro no DOM) e o do rodapé (último).
      const closeButtons = within(dialog).getAllByRole("button", { name: "Fechar" });
      expect(closeButtons).toHaveLength(2);
      await user.click(closeButtons.at(-1)!);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("the X button and Escape also close it", async () => {
      server.use(listInvitesHandler({ data: [MEMBER_INVITE] }));
      const user = userEvent.setup();
      await renderWithProviders(<PendingInvitesButton />);

      await openDialog(user, 1);
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      await openDialog(user, 1);
      await user.click(screen.getAllByRole("button", { name: "Fechar" })[0]!);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("shows a loading status while the list has no data yet", async () => {
      server.use(
        http.get("*/invites", async () => {
          await delay("infinite");
          return HttpResponse.json([]);
        }),
      );
      await renderWithProviders(<PendingInvitesDialog isOpen onOpenChange={() => {}} />);

      const dialog = await screen.findByRole("dialog", { name: "Convites pendentes" });
      expect(within(dialog).getByRole("status")).toHaveTextContent("Carregando convites…");
    });

    it("shows an error when the list cannot be loaded", async () => {
      server.use(listInvitesHandler({ error: { statusCode: 500, error: "INTERNAL" } }));
      await renderWithProviders(<PendingInvitesDialog isOpen onOpenChange={() => {}} />);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar os convites. Feche e abra de novo.",
      );
    });
  });

  describe("revoking", () => {
    it("Revogar asks for confirmation, sends DELETE with the id and removes the row", async () => {
      const { revoked } = useStatefulInvites([MEMBER_INVITE, DIRECTOR_INVITE]);
      const user = userEvent.setup();
      await renderWithProviders(<PendingInvitesButton />);
      const dialog = await openDialog(user, 2);

      await user.click(
        within(dialog).getByRole("button", {
          name: `Revogar convite de Diretor gerado em ${localDateTime(DIRECTOR_INVITE.createdAt)}`,
        }),
      );

      const confirmation = await screen.findByRole("dialog", { name: "Revogar convite" });
      expect(
        within(confirmation).getByText(
          `Convite de Diretor gerado em ${localDateTime(DIRECTOR_INVITE.createdAt)}. O link deixa de valer na hora e não pode ser reativado.`,
        ),
      ).toBeInTheDocument();
      expect(revoked).toEqual([]);

      await user.click(within(confirmation).getByRole("button", { name: "Revogar" }));

      await waitFor(() => expect(revoked).toEqual(["invite-director"]));
      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "Revogar convite" })).toBeNull(),
      );
      const list = screen.getByRole("dialog", { name: "Convites pendentes (1)" });
      expect(within(list).queryByRole("row", { name: /Diretor/ })).not.toBeInTheDocument();
      expect(within(list).getByRole("row", { name: /Membro/ })).toBeInTheDocument();
      expect(await screen.findByText("Convite revogado.")).toBeInTheDocument();
    });

    it("revoking removes the invite and updates the title count", async () => {
      useStatefulInvites([MEMBER_INVITE, DIRECTOR_INVITE]);
      const user = userEvent.setup();
      await renderWithProviders(<PendingInvitesButton />);
      const dialog = await openDialog(user, 2);
      expect(dialog).toHaveAccessibleName("Convites pendentes (2)");

      await user.click(within(dialog).getAllByRole("button", { name: /^Revogar convite/ })[0]!);
      const confirmation = await screen.findByRole("dialog", { name: "Revogar convite" });
      await user.click(within(confirmation).getByRole("button", { name: "Revogar" }));

      expect(
        await screen.findByRole("dialog", { name: "Convites pendentes (1)" }),
      ).toBeInTheDocument();
    });

    it("revoking a password reset link asks with its own wording", async () => {
      const { revoked } = useStatefulInvites([RESET_INVITE]);
      const user = userEvent.setup();
      await renderWithProviders(<PendingInvitesButton />);
      const dialog = await openDialog(user, 1);

      await user.click(
        within(dialog).getByRole("button", { name: /^Revogar link de redefinição/ }),
      );

      const confirmation = await screen.findByRole("dialog", { name: "Revogar convite" });
      expect(
        within(confirmation).getByText(
          `Link de redefinição de senha gerado em ${localDateTime(RESET_INVITE.createdAt)}. O link deixa de valer na hora e não pode ser reativado.`,
        ),
      ).toBeInTheDocument();
      await user.click(within(confirmation).getByRole("button", { name: "Revogar" }));

      await waitFor(() => expect(revoked).toEqual(["invite-reset"]));
    });

    it("Voltar closes the confirmation without calling the API and keeps the list", async () => {
      const { revoked } = useStatefulInvites([MEMBER_INVITE]);
      const user = userEvent.setup();
      await renderWithProviders(<PendingInvitesButton />);
      const dialog = await openDialog(user, 1);

      const revokeButton = within(dialog).getByRole("button", { name: /^Revogar convite/ });
      await user.click(revokeButton);
      const confirmation = await screen.findByRole("dialog", { name: "Revogar convite" });
      await user.click(within(confirmation).getByRole("button", { name: "Voltar" }));

      expect(screen.queryByRole("dialog", { name: "Revogar convite" })).not.toBeInTheDocument();
      // O foco volta ao botão que abriu a confirmação.
      await waitFor(() => expect(revokeButton).toHaveFocus());
      expect(revoked).toEqual([]);
      expect(screen.getByRole("dialog", { name: "Convites pendentes (1)" })).toBeInTheDocument();
    });

    it("Escape closes only the confirmation on top, not the list under it", async () => {
      useStatefulInvites([MEMBER_INVITE]);
      const user = userEvent.setup();
      await renderWithProviders(<PendingInvitesButton />);
      const dialog = await openDialog(user, 1);

      await user.click(within(dialog).getByRole("button", { name: /^Revogar convite/ }));
      await screen.findByRole("dialog", { name: "Revogar convite" });
      await user.keyboard("{Escape}");

      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "Revogar convite" })).not.toBeInTheDocument(),
      );
      expect(screen.getByRole("dialog", { name: "Convites pendentes (1)" })).toBeInTheDocument();
    });

    it("INVITE_ALREADY_USED shows inviteGone and refreshes the list", async () => {
      let invites = [MEMBER_INVITE, DIRECTOR_INVITE];
      server.use(
        http.get("*/invites", () => HttpResponse.json(invites)),
        revokeInviteHandler({
          error: { statusCode: 409, error: "INVITE_ALREADY_USED" },
          // Enquanto a pessoa decidia, o convite foi usado: sai da lista de pendentes.
          onCall: (id) => {
            invites = invites.filter((invite) => invite.id !== id);
          },
        }),
      );
      const user = userEvent.setup();
      await renderWithProviders(<PendingInvitesButton />);
      const dialog = await openDialog(user, 2);

      await user.click(within(dialog).getByRole("button", { name: /^Revogar convite de Membro/ }));
      const confirmation = await screen.findByRole("dialog", { name: "Revogar convite" });
      await user.click(within(confirmation).getByRole("button", { name: "Revogar" }));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Este convite já foi usado, revogado ou não existe mais.");
      await waitFor(() => expect(alert.parentElement).toHaveFocus());
      expect(
        await screen.findByRole("button", { name: "Convites pendentes (1)", hidden: true }),
      ).toBeInTheDocument();
      await user.click(within(confirmation).getByRole("button", { name: "Voltar" }));
      const list = screen.getByRole("dialog", { name: "Convites pendentes (1)" });
      expect(within(list).queryByRole("row", { name: /Membro/ })).not.toBeInTheDocument();
    });

    it("a 404 is also reported as an invite that no longer exists", async () => {
      server.use(
        listInvitesHandler({ data: [MEMBER_INVITE] }),
        revokeInviteHandler({ error: { statusCode: 404, error: "NOT_FOUND" } }),
      );
      const user = userEvent.setup();
      await renderWithProviders(<PendingInvitesButton />);
      const dialog = await openDialog(user, 1);

      await user.click(within(dialog).getByRole("button", { name: /^Revogar convite/ }));
      const confirmation = await screen.findByRole("dialog", { name: "Revogar convite" });
      await user.click(within(confirmation).getByRole("button", { name: "Revogar" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Este convite já foi usado, revogado ou não existe mais.",
      );
    });

    it("shows a network error, keeps the confirmation open and lets the person try again", async () => {
      let invites = [MEMBER_INVITE];
      server.use(
        http.get("*/invites", () => HttpResponse.json(invites)),
        revokeInviteHandler({ networkError: true }),
      );
      const user = userEvent.setup();
      await renderWithProviders(<PendingInvitesButton />);
      const dialog = await openDialog(user, 1);

      await user.click(within(dialog).getByRole("button", { name: /^Revogar convite/ }));
      const confirmation = await screen.findByRole("dialog", { name: "Revogar convite" });
      await user.click(within(confirmation).getByRole("button", { name: "Revogar" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível conectar. Tente de novo.",
      );
      expect(within(confirmation).getByRole("button", { name: "Revogar" })).toBeEnabled();

      server.use(
        revokeInviteHandler({
          onCall: () => {
            invites = [];
          },
        }),
      );
      await user.click(within(confirmation).getByRole("button", { name: "Revogar" }));

      expect(
        await screen.findByRole("dialog", { name: "Convites pendentes (0)" }),
      ).toBeInTheDocument();
    });

    it("blocks closing the confirmation while the DELETE is in flight and sends it once", async () => {
      const deferred = createDeferred();
      const onCall = vi.fn();
      server.use(
        listInvitesHandler({ data: [MEMBER_INVITE] }),
        revokeInviteHandler({ delay: deferred.promise, onCall }),
      );
      const user = userEvent.setup();
      await renderWithProviders(<PendingInvitesButton />);
      const dialog = await openDialog(user, 1);

      await user.click(within(dialog).getByRole("button", { name: /^Revogar convite/ }));
      const confirmation = await screen.findByRole("dialog", { name: "Revogar convite" });
      await user.dblClick(within(confirmation).getByRole("button", { name: "Revogar" }));
      await screen.findByRole("button", { name: "Revogando…" });

      await user.keyboard("{Escape}");
      expect(screen.getByRole("dialog", { name: "Revogar convite" })).toBeInTheDocument();
      expect(within(confirmation).getByRole("button", { name: "Voltar" })).toBeDisabled();

      deferred.resolve();
      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "Revogar convite" })).toBeNull(),
      );
      expect(onCall).toHaveBeenCalledTimes(1);
    });

    it("invalidates the pending invites after revoking", async () => {
      useStatefulInvites([MEMBER_INVITE]);
      const user = userEvent.setup();
      const { queryClient } = await renderWithProviders(<PendingInvitesButton />);
      const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
      const dialog = await openDialog(user, 1);

      await user.click(within(dialog).getByRole("button", { name: /^Revogar convite/ }));
      const confirmation = await screen.findByRole("dialog", { name: "Revogar convite" });
      await user.click(within(confirmation).getByRole("button", { name: "Revogar" }));

      await waitFor(() =>
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: getListInvitesQueryKey() }),
      );
    });
  });

  it("opens again with the list, not with a leftover confirmation", async () => {
    useStatefulInvites([MEMBER_INVITE, DIRECTOR_INVITE]);
    const user = userEvent.setup();

    function Harness() {
      const [isOpen, setIsOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setIsOpen(true)}>
            Abrir convites
          </button>
          <PendingInvitesDialog isOpen={isOpen} onOpenChange={setIsOpen} />
        </>
      );
    }
    await renderWithProviders(<Harness />);
    const dialog = await screen.findByRole("dialog", { name: "Convites pendentes (2)" });

    await user.click(within(dialog).getAllByRole("button", { name: /^Revogar convite/ })[0]!);
    await screen.findByRole("dialog", { name: "Revogar convite" });
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    await user.click(screen.getAllByRole("button", { name: "Fechar" }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Abrir convites" }));

    expect(
      await screen.findByRole("dialog", { name: "Convites pendentes (2)" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Revogar convite" })).not.toBeInTheDocument();
  });
});
