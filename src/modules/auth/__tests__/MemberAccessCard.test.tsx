import { useState, type ReactNode } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getListAccessQueryKey } from "@api/generated";
import type { AccessResponseDto, MeResponseDto } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { AuthProvider } from "../AuthProvider";
import { MemberAccessCard } from "../components/MemberAccessCard";
import { useAuth } from "../hooks/useAuth";
import { toAssignableRole } from "../lib/role-label";
import {
  buildAccess,
  buildMeUser,
  createPasswordResetHandler,
  meHandler,
  updateAccessEnabledHandler,
} from "./handlers";
import { renderWithProviders, server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

const ME_ID = "01952ef7-0000-7000-8000-000000000001";
const OWN_ACCOUNT_HINT = "Você não pode alterar a própria conta";
const LAST_COORDINATOR_MESSAGE =
  "Esta é a última coordenação ativa. Promova outra pessoa a Coordenação antes de alterar o perfil ou desativar este acesso.";

const BETO = buildAccess({
  id: "person-beto",
  name: "Beto Nunes",
  ra: "2024RA0002",
  role: Role.director,
  accessEnabled: true,
});

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

interface HarnessProps {
  initial: AccessResponseDto;
  isSaving?: boolean;
  onAccessChange?: (updated: AccessResponseDto) => void;
}

/**
 * O card só existe com a sessão carregada (a rota exige permissão antes de renderizar a página).
 * Montá-lo antes disso trocaria a dica da própria conta de lugar depois do primeiro render.
 */
function WhenSignedIn({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  return status === "authenticated" ? <>{children}</> : null;
}

/** O pai real (`EditMemberDialog`) guarda a pessoa e o perfil escolhido; aqui o mesmo, mínimo. */
function Harness({ initial, isSaving = false, onAccessChange }: HarnessProps) {
  const [access, setAccess] = useState(initial);
  const [selectedRole, setSelectedRole] = useState(toAssignableRole(initial.role));

  return (
    <MemberAccessCard
      access={access}
      selectedRole={selectedRole}
      onRoleChange={setSelectedRole}
      onAccessChange={(updated) => {
        setAccess(updated);
        onAccessChange?.(updated);
      }}
      isSaving={isSaving}
    />
  );
}

async function renderCard(
  options: { access?: AccessResponseDto; me?: MeResponseDto } & Omit<HarnessProps, "initial"> = {},
) {
  const {
    access = BETO,
    me = buildMeUser({ id: ME_ID, role: Role.coordinator }),
    ...rest
  } = options;
  server.use(meHandler({ user: me }));
  const view = await renderWithProviders(
    <AuthProvider>
      <WhenSignedIn>
        <Harness initial={access} {...rest} />
      </WhenSignedIn>
    </AuthProvider>,
  );
  await screen.findByRole("region", { name: "Acesso ao sistema" });
  return view;
}

const roleSelect = () => screen.getByRole("button", { name: /Perfil de acesso/ });
const resetButton = () =>
  screen.getByRole("button", { name: "Gerar link de redefinição de senha" });

describe("MemberAccessCard", () => {
  describe("layout", () => {
    it("is a region named Acesso ao sistema with the role, the reset link and the disable action", async () => {
      await renderCard();

      const card = screen.getByRole("region", { name: "Acesso ao sistema" });
      expect(within(card).getByRole("heading", { name: "Acesso ao sistema" })).toBeInTheDocument();
      expect(within(card).getByRole("button", { name: /Perfil de acesso/ })).toHaveTextContent(
        "Diretor",
      );
      expect(
        within(card).getByRole("button", { name: "Gerar link de redefinição de senha" }),
      ).toBeInTheDocument();
      expect(within(card).getByRole("button", { name: "Desativar acesso" })).toBeInTheDocument();
    });

    it("keeps every control at 44px and full width, with the danger-soft look for Desativar acesso", async () => {
      await renderCard();

      expect(resetButton()).toHaveClass("min-h-11", "button--full-width");
      const disable = screen.getByRole("button", { name: "Desativar acesso" });
      expect(disable).toHaveClass("button--danger-soft", "min-h-11", "button--full-width");
    });

    it("offers Membro, Diretor and Coordenadora, never a superadmin option", async () => {
      const user = userEvent.setup();
      await renderCard();

      await user.click(roleSelect());

      const options = await screen.findAllByRole("option");
      expect(options.map((option) => option.textContent)).toEqual([
        "Membro",
        "Diretor",
        "Coordenadora",
      ]);
    });

    it("choosing another role updates the select", async () => {
      const user = userEvent.setup();
      await renderCard();

      await user.click(roleSelect());
      await user.click(await screen.findByRole("option", { name: "Coordenadora" }));

      expect(roleSelect()).toHaveTextContent("Coordenadora");
    });

    it("a superadmin shows the Coordenadora label with no option marked", async () => {
      await renderCard({ access: buildAccess({ id: "person-dora", role: Role.superadmin }) });

      expect(roleSelect()).toHaveTextContent("Coordenadora");
    });

    it("disables the role select and Desativar acesso while the edit is saving", async () => {
      await renderCard({ isSaving: true });

      expect(roleSelect()).toBeDisabled();
      expect(screen.getByRole("button", { name: "Desativar acesso" })).toBeDisabled();
      expect(resetButton()).toBeEnabled();
    });
  });

  describe("own account", () => {
    async function renderOwnAccount() {
      const own = buildAccess({ id: ME_ID, name: "Ana Coordenadora", role: Role.coordinator });
      await renderCard({ access: own });
    }

    it("own account: role select and disable are disabled with the explanation", async () => {
      await renderOwnAccount();

      expect(roleSelect()).toBeDisabled();
      expect(roleSelect()).toHaveAccessibleDescription(OWN_ACCOUNT_HINT);

      const disable = screen.getByRole("button", { name: "Desativar acesso" });
      expect(disable).toBeDisabled();
      expect(disable).toHaveAccessibleDescription(OWN_ACCOUNT_HINT);
      expect(screen.getAllByText(OWN_ACCOUNT_HINT)).toHaveLength(2);
    });

    it("own account still allows generating a reset link", async () => {
      const user = userEvent.setup();
      await renderOwnAccount();

      expect(resetButton()).toBeEnabled();
      await user.click(resetButton());

      expect(
        await screen.findByRole("dialog", { name: "Link de redefinição de senha" }),
      ).toBeInTheDocument();
    });

    it("someone else's account shows no explanation and nothing disabled", async () => {
      await renderCard();

      expect(roleSelect()).toBeEnabled();
      expect(screen.queryByText(OWN_ACCOUNT_HINT)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Desativar acesso" })).toBeEnabled();
    });
  });

  describe("reset link", () => {
    it("opens the confirmation for that person and sends nothing until Gerar link", async () => {
      const onCall = vi.fn();
      server.use(createPasswordResetHandler({ onCall }));
      const user = userEvent.setup();
      await renderCard();

      await user.click(resetButton());

      const dialog = await screen.findByRole("dialog", { name: "Link de redefinição de senha" });
      expect(within(dialog).getByText("Beto Nunes · RA 2024RA0002")).toBeInTheDocument();
      expect(onCall).not.toHaveBeenCalled();

      await user.click(within(dialog).getByRole("button", { name: "Gerar link" }));
      await waitFor(() => expect(onCall).toHaveBeenCalledWith("person-beto"));
    });
  });

  describe("disabling the access", () => {
    it("disable asks for confirmation before PATCH", async () => {
      const onCall = vi.fn();
      server.use(updateAccessEnabledHandler({ onCall }));
      const user = userEvent.setup();
      await renderCard();

      await user.click(screen.getByRole("button", { name: "Desativar acesso" }));

      const dialog = await screen.findByRole("dialog", { name: "Desativar acesso" });
      expect(within(dialog).getByText("Beto Nunes · RA 2024RA0002")).toBeInTheDocument();
      expect(within(dialog).getByText("Perfil atual: Diretor")).toBeInTheDocument();
      expect(
        within(dialog).getByText(
          /A pessoa deixa de entrar no sistema\. Se estiver com o TEDI aberto/,
        ),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByText(/Você não pode desativar a própria conta/),
      ).toBeInTheDocument();
      expect(onCall).not.toHaveBeenCalled();

      await user.click(within(dialog).getByRole("button", { name: "Desativar acesso" }));

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
    });

    it("the warning is static text, not a live region", async () => {
      const user = userEvent.setup();
      await renderCard();

      await user.click(screen.getByRole("button", { name: "Desativar acesso" }));
      await screen.findByRole("dialog", { name: "Desativar acesso" });

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("after disabling the button becomes Reativar acesso", async () => {
      const onCall = vi.fn();
      server.use(updateAccessEnabledHandler({ onCall }));
      const user = userEvent.setup();
      const onAccessChange = vi.fn();
      await renderCard({ onAccessChange });

      await user.click(screen.getByRole("button", { name: "Desativar acesso" }));
      const dialog = await screen.findByRole("dialog", { name: "Desativar acesso" });
      await user.click(within(dialog).getByRole("button", { name: "Desativar acesso" }));

      expect(await screen.findByRole("button", { name: "Reativar acesso" })).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Desativar acesso" })).not.toBeInTheDocument();
      expect(onCall).toHaveBeenCalledWith("person-beto", { enabled: false });
      expect(onAccessChange).toHaveBeenCalledWith(
        expect.objectContaining({ id: "person-beto", accessEnabled: false }),
      );
      expect(await screen.findByText("Acesso de Beto Nunes desativado.")).toBeInTheDocument();
    });

    it("refreshes the members list after disabling", async () => {
      server.use(updateAccessEnabledHandler());
      const user = userEvent.setup();
      const { queryClient } = await renderCard();
      const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

      await user.click(screen.getByRole("button", { name: "Desativar acesso" }));
      const dialog = await screen.findByRole("dialog", { name: "Desativar acesso" });
      await user.click(within(dialog).getByRole("button", { name: "Desativar acesso" }));

      await screen.findByRole("button", { name: "Reativar acesso" });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: getListAccessQueryKey() });
    });

    it("the focus returns to the same button, now named Reativar acesso", async () => {
      server.use(updateAccessEnabledHandler());
      const user = userEvent.setup();
      await renderCard();

      const toggle = screen.getByRole("button", { name: "Desativar acesso" });
      await user.click(toggle);
      const dialog = await screen.findByRole("dialog", { name: "Desativar acesso" });
      await user.click(within(dialog).getByRole("button", { name: "Desativar acesso" }));

      const reactivate = await screen.findByRole("button", { name: "Reativar acesso" });
      expect(reactivate).toBe(toggle);
      await waitFor(() => expect(reactivate).toHaveFocus());
    });

    it("Voltar closes the confirmation without calling the API", async () => {
      const onCall = vi.fn();
      server.use(updateAccessEnabledHandler({ onCall }));
      const user = userEvent.setup();
      await renderCard();

      await user.click(screen.getByRole("button", { name: "Desativar acesso" }));
      const dialog = await screen.findByRole("dialog", { name: "Desativar acesso" });
      await user.click(within(dialog).getByRole("button", { name: "Voltar" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(onCall).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Desativar acesso" })).toBeInTheDocument();
    });

    it("LAST_COORDINATOR on disable shows the warning and keeps Desativar acesso", async () => {
      server.use(
        updateAccessEnabledHandler({ error: { statusCode: 409, error: "LAST_COORDINATOR" } }),
      );
      const user = userEvent.setup();
      const onAccessChange = vi.fn();
      await renderCard({
        access: buildAccess({ id: "person-last", name: "Dora Admin", role: Role.coordinator }),
        onAccessChange,
      });

      await user.click(screen.getByRole("button", { name: "Desativar acesso" }));
      const dialog = await screen.findByRole("dialog", { name: "Desativar acesso" });
      await user.click(within(dialog).getByRole("button", { name: "Desativar acesso" }));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(LAST_COORDINATOR_MESSAGE);
      expect(screen.getByRole("dialog", { name: "Desativar acesso" })).toBeInTheDocument();
      expect(onAccessChange).not.toHaveBeenCalled();

      await user.click(within(dialog).getByRole("button", { name: "Voltar" }));
      expect(screen.getByRole("button", { name: "Desativar acesso" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Reativar acesso" })).not.toBeInTheDocument();
    });

    it("shows a network error in the confirmation and lets the person try again", async () => {
      server.use(updateAccessEnabledHandler({ networkError: true }));
      const user = userEvent.setup();
      await renderCard();

      await user.click(screen.getByRole("button", { name: "Desativar acesso" }));
      const dialog = await screen.findByRole("dialog", { name: "Desativar acesso" });
      await user.click(within(dialog).getByRole("button", { name: "Desativar acesso" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível conectar. Tente de novo.",
      );
      expect(within(dialog).getByRole("button", { name: "Desativar acesso" })).toBeEnabled();

      server.use(updateAccessEnabledHandler());
      await user.click(within(dialog).getByRole("button", { name: "Desativar acesso" }));

      expect(await screen.findByRole("button", { name: "Reativar acesso" })).toBeInTheDocument();
    });

    it("cannot be dismissed while the PATCH is in flight and sends it only once", async () => {
      const deferred = createDeferred();
      const onCall = vi.fn();
      server.use(updateAccessEnabledHandler({ delay: deferred.promise, onCall }));
      const user = userEvent.setup();
      await renderCard();

      await user.click(screen.getByRole("button", { name: "Desativar acesso" }));
      const dialog = await screen.findByRole("dialog", { name: "Desativar acesso" });
      await user.dblClick(within(dialog).getByRole("button", { name: "Desativar acesso" }));
      await screen.findByRole("button", { name: "Desativando…" });

      await user.keyboard("{Escape}");
      await user.click(within(dialog).getByRole("button", { name: "Fechar" }));
      expect(screen.getByRole("dialog", { name: "Desativar acesso" })).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Voltar" })).toBeDisabled();

      deferred.resolve();
      expect(await screen.findByRole("button", { name: "Reativar acesso" })).toBeInTheDocument();
      expect(onCall).toHaveBeenCalledTimes(1);
    });
  });

  describe("reactivating the access", () => {
    const INACTIVE = buildAccess({
      id: "person-caio",
      name: "Caio Lopes",
      ra: "2024RA0003",
      role: Role.member,
      accessEnabled: false,
    });

    it("an inactive person shows Reativar acesso instead of Desativar acesso", async () => {
      await renderCard({ access: INACTIVE });

      const toggle = screen.getByRole("button", { name: "Reativar acesso" });
      expect(toggle).toHaveClass("button--secondary", "button--full-width", "min-h-11");
      expect(screen.queryByRole("button", { name: "Desativar acesso" })).not.toBeInTheDocument();
    });

    it("reactivating sends enabled true without confirmation", async () => {
      const onCall = vi.fn();
      server.use(updateAccessEnabledHandler({ onCall }));
      const user = userEvent.setup();
      await renderCard({ access: INACTIVE });

      await user.click(screen.getByRole("button", { name: "Reativar acesso" }));

      expect(await screen.findByRole("button", { name: "Desativar acesso" })).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(onCall).toHaveBeenCalledTimes(1);
      expect(onCall).toHaveBeenCalledWith("person-caio", { enabled: true });
      expect(await screen.findByText("Acesso de Caio Lopes reativado.")).toBeInTheDocument();
    });

    it("shows Reativando… while the PATCH is in flight", async () => {
      const deferred = createDeferred();
      server.use(updateAccessEnabledHandler({ delay: deferred.promise }));
      const user = userEvent.setup();
      await renderCard({ access: INACTIVE });

      await user.click(screen.getByRole("button", { name: "Reativar acesso" }));

      expect(await screen.findByRole("button", { name: "Reativando…" })).toBeInTheDocument();
      deferred.resolve();
      expect(await screen.findByRole("button", { name: "Desativar acesso" })).toBeInTheDocument();
    });

    it("shows the error under the button and keeps Reativar acesso when the PATCH fails", async () => {
      server.use(updateAccessEnabledHandler({ error: { statusCode: 404, error: "NOT_FOUND" } }));
      const user = userEvent.setup();
      await renderCard({ access: INACTIVE });

      await user.click(screen.getByRole("button", { name: "Reativar acesso" }));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Este acesso não existe mais. Atualize a lista.");
      await waitFor(() => expect(alert.parentElement).toHaveFocus());
      expect(screen.getByRole("button", { name: "Reativar acesso" })).toBeEnabled();
    });
  });
});
