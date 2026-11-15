import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getListAccessQueryKey } from "@api/generated";
import type { AccessResponseDto, MeResponseDto } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { EditMemberDialog } from "../components/EditMemberDialog";
import {
  buildAccess,
  buildMeUser,
  createPasswordResetHandler,
  updateAccessEnabledHandler,
  updateAccessRoleHandler,
} from "./handlers";
import { renderSignedIn, server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

const LAST_COORDINATOR_MESSAGE =
  "Esta é a última coordenação ativa. Promova outra pessoa a Coordenação antes de alterar o perfil ou desativar este acesso.";

const CAIO = buildAccess({
  id: "person-caio",
  name: "Caio Lopes",
  ra: "2024RA0003",
  email: "caio@example.com",
  role: Role.member,
  accessEnabled: true,
});
const DORA = buildAccess({
  id: "person-dora",
  name: "Dora Admin",
  ra: "2024RA0009",
  role: Role.coordinator,
  accessEnabled: true,
});

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function renderDialog(options: { member?: AccessResponseDto; me?: MeResponseDto } = {}) {
  const { member = CAIO, me = buildMeUser({ role: Role.coordinator }) } = options;
  const onClose = vi.fn();
  const view = await renderSignedIn(<EditMemberDialog member={member} onClose={onClose} />, me);
  await screen.findByRole("dialog", { name: "Editar membro" });
  return { ...view, onClose };
}

const roleSelect = () => screen.getByRole("button", { name: /Perfil de acesso/ });
const saveButton = () => screen.getByRole("button", { name: "Salvar alterações" });
const cancelButton = () => screen.getByRole("button", { name: "Cancelar" });

async function chooseRole(user: UserEvent, label: string) {
  await user.click(roleSelect());
  await user.click(await screen.findByRole("option", { name: label }));
}

describe("EditMemberDialog", () => {
  describe("layout", () => {
    it("is the 1040px Editar membro dialog with Cancelar and Salvar alterações", async () => {
      await renderDialog();

      const dialog = screen.getByRole("dialog", { name: "Editar membro" });
      expect(dialog).toHaveClass("max-w-260");
      expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Salvar alterações" })).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Fechar" })).toBeInTheDocument();
    });

    it("shows the member data read-only on the left", async () => {
      await renderDialog();

      const section = screen.getByRole("region", { name: "Dados do membro" });
      expect(within(section).getByText("Nome")).toBeInTheDocument();
      expect(within(section).getByText("Caio Lopes")).toBeInTheDocument();
      expect(within(section).getByText("RA")).toBeInTheDocument();
      expect(within(section).getByText("2024RA0003")).toBeInTheDocument();
      expect(within(section).getByText("E-mail")).toBeInTheDocument();
      expect(within(section).getByText("caio@example.com")).toBeInTheDocument();
    });

    it("leaves out the RA and the email the contract did not bring", async () => {
      const withoutContact = {
        ...CAIO,
        ra: null,
        email: null,
      } as unknown as AccessResponseDto;
      await renderDialog({ member: withoutContact });

      const section = screen.getByRole("region", { name: "Dados do membro" });
      expect(within(section).getByText("Caio Lopes")).toBeInTheDocument();
      expect(within(section).queryByText("RA")).not.toBeInTheDocument();
      expect(within(section).queryByText("E-mail")).not.toBeInTheDocument();
    });
  });

  describe("who sees the access card", () => {
    it("director opens the dialog without the access card", async () => {
      const { onClose } = await renderDialog({ me: buildMeUser({ role: Role.director }) });
      const user = userEvent.setup();

      expect(screen.getByRole("dialog", { name: "Editar membro" })).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Dados do membro" })).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Acesso ao sistema" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Perfil de acesso/ })).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Gerar link de redefinição de senha" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Desativar acesso" })).not.toBeInTheDocument();

      await user.click(saveButton());
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("coordinator sees the Acesso ao sistema card", async () => {
      await renderDialog();

      const card = screen.getByRole("region", { name: "Acesso ao sistema" });
      expect(within(card).getByRole("button", { name: /Perfil de acesso/ })).toHaveTextContent(
        "Membro",
      );
      expect(
        within(card).getByRole("button", { name: "Gerar link de redefinição de senha" }),
      ).toBeInTheDocument();
      expect(within(card).getByRole("button", { name: "Desativar acesso" })).toBeInTheDocument();
    });

    it("does not render the access card with the permission removed from the session", async () => {
      await renderDialog({
        me: buildMeUser({
          role: Role.coordinator,
          permissions: {
            ...buildMeUser({ role: Role.coordinator }).permissions,
            "access.manage": "none",
          },
        }),
      });

      expect(screen.queryByRole("region", { name: "Acesso ao sistema" })).not.toBeInTheDocument();
    });
  });

  describe("saving the role", () => {
    it("saving a changed role sends PATCH and closes", async () => {
      const onCall = vi.fn();
      server.use(updateAccessRoleHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose, queryClient } = await renderDialog();
      const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

      await chooseRole(user, "Diretor");
      expect(roleSelect()).toHaveTextContent("Diretor");
      expect(onCall).not.toHaveBeenCalled();

      await user.click(saveButton());

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledTimes(1);
      expect(onCall).toHaveBeenCalledWith("person-caio", { role: "director" });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: getListAccessQueryKey() });
      expect(
        await screen.findByText("Perfil de Caio Lopes alterado para Diretor."),
      ).toBeInTheDocument();
    });

    it("saving without changing the role closes without a request", async () => {
      const onCall = vi.fn();
      server.use(updateAccessRoleHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await user.click(saveButton());

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onCall).not.toHaveBeenCalled();
    });

    it("choosing the role the person already has and saving sends nothing", async () => {
      const onCall = vi.fn();
      server.use(updateAccessRoleHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await chooseRole(user, "Diretor");
      await chooseRole(user, "Membro");
      await user.click(saveButton());

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onCall).not.toHaveBeenCalled();
    });

    it("LAST_COORDINATOR on save shows the warning, keeps the dialog open and resets the select", async () => {
      server.use(
        updateAccessRoleHandler({ error: { statusCode: 409, error: "LAST_COORDINATOR" } }),
      );
      const user = userEvent.setup();
      const { onClose, queryClient } = await renderDialog({ member: DORA });
      const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

      await chooseRole(user, "Membro");
      expect(roleSelect()).toHaveTextContent("Membro");
      await user.click(saveButton());

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(LAST_COORDINATOR_MESSAGE);
      await waitFor(() => expect(alert.parentElement).toHaveFocus());
      expect(screen.getByRole("dialog", { name: "Editar membro" })).toBeInTheDocument();
      expect(roleSelect()).toHaveTextContent("Coordenadora");
      expect(onClose).not.toHaveBeenCalled();
      expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: getListAccessQueryKey() });
      expect(saveButton()).toBeEnabled();
    });

    it("clears the warning when the person tries again", async () => {
      server.use(
        updateAccessRoleHandler({ error: { statusCode: 409, error: "LAST_COORDINATOR" } }),
      );
      const user = userEvent.setup();
      const { onClose } = await renderDialog({ member: DORA });

      await chooseRole(user, "Membro");
      await user.click(saveButton());
      await screen.findByRole("alert");

      server.use(updateAccessRoleHandler());
      await chooseRole(user, "Diretor");
      await user.click(saveButton());

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(screen.queryByText(LAST_COORDINATOR_MESSAGE)).not.toBeInTheDocument();
    });

    it("shows a network error and keeps what the person chose", async () => {
      server.use(updateAccessRoleHandler({ networkError: true }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await chooseRole(user, "Diretor");
      await user.click(saveButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível conectar. Tente de novo.",
      );
      expect(roleSelect()).toHaveTextContent("Diretor");
      expect(onClose).not.toHaveBeenCalled();
    });

    it("explains that the access no longer exists on 404", async () => {
      server.use(updateAccessRoleHandler({ error: { statusCode: 404, error: "NOT_FOUND" } }));
      const user = userEvent.setup();
      await renderDialog();

      await chooseRole(user, "Diretor");
      await user.click(saveButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Este acesso não existe mais. Atualize a lista.",
      );
    });

    it("blocks closing, Cancelar and the role select while the PATCH is in flight, and sends it once", async () => {
      const deferred = createDeferred();
      const onCall = vi.fn();
      server.use(updateAccessRoleHandler({ delay: deferred.promise, onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await chooseRole(user, "Diretor");
      await user.dblClick(saveButton());
      await screen.findByRole("button", { name: "Salvando…" });

      await user.keyboard("{Escape}");
      await user.click(screen.getByRole("button", { name: "Fechar" }));
      expect(onClose).not.toHaveBeenCalled();
      expect(cancelButton()).toBeDisabled();
      expect(roleSelect()).toBeDisabled();

      deferred.resolve();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledTimes(1);
    });

    it("blocks the reset link and Desativar acesso while the PATCH is in flight, so no link is generated just before the save closes the edition", async () => {
      const deferred = createDeferred();
      const resetCall = vi.fn();
      server.use(
        updateAccessRoleHandler({ delay: deferred.promise }),
        createPasswordResetHandler({ onCall: resetCall }),
      );
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await chooseRole(user, "Diretor");
      await user.click(saveButton());
      await screen.findByRole("button", { name: "Salvando…" });

      const resetButton = screen.getByRole("button", {
        name: "Gerar link de redefinição de senha",
      });
      expect(resetButton).toBeDisabled();
      expect(screen.getByRole("button", { name: "Desativar acesso" })).toBeDisabled();
      await user.click(resetButton);
      expect(
        screen.queryByRole("dialog", { name: "Link de redefinição de senha" }),
      ).not.toBeInTheDocument();

      deferred.resolve();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(resetCall).not.toHaveBeenCalled();
    });

    it("releases the reset link and Desativar acesso again when the save fails", async () => {
      server.use(updateAccessRoleHandler({ networkError: true }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await chooseRole(user, "Diretor");
      await user.click(saveButton());
      await screen.findByRole("alert");

      expect(onClose).not.toHaveBeenCalled();
      expect(
        screen.getByRole("button", { name: "Gerar link de redefinição de senha" }),
      ).toBeEnabled();
      expect(screen.getByRole("button", { name: "Desativar acesso" })).toBeEnabled();
    });
  });

  describe("leaving without saving", () => {
    it("Cancelar discards the selected role", async () => {
      const onCall = vi.fn();
      server.use(updateAccessRoleHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await chooseRole(user, "Diretor");
      await user.click(cancelButton());

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onCall).not.toHaveBeenCalled();
    });

    it("the close button and Escape also close without saving", async () => {
      const onCall = vi.fn();
      server.use(updateAccessRoleHandler({ onCall }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await chooseRole(user, "Diretor");
      await user.click(screen.getByRole("button", { name: "Fechar" }));
      expect(onClose).toHaveBeenCalledTimes(1);

      await user.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledTimes(2);
      expect(onCall).not.toHaveBeenCalled();
    });
  });

  describe("own account", () => {
    it("disables the role and Desativar acesso, and Salvar alterações closes without a request", async () => {
      const onCall = vi.fn();
      server.use(updateAccessRoleHandler({ onCall }));
      const me = buildMeUser({ role: Role.coordinator });
      const own = buildAccess({ id: me.id, name: me.name, role: Role.coordinator });
      const user = userEvent.setup();
      const { onClose } = await renderDialog({ member: own, me });

      expect(roleSelect()).toBeDisabled();
      expect(screen.getByRole("button", { name: "Desativar acesso" })).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Gerar link de redefinição de senha" }),
      ).toBeEnabled();

      await user.click(saveButton());
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onCall).not.toHaveBeenCalled();
    });
  });

  describe("disabling the access from inside the edition", () => {
    it("keeps the dialog open, turns the button into Reativar acesso and still closes without a role request", async () => {
      const onRoleCall = vi.fn();
      server.use(
        updateAccessEnabledHandler({ person: CAIO }),
        updateAccessRoleHandler({ onCall: onRoleCall }),
      );
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await user.click(screen.getByRole("button", { name: "Desativar acesso" }));
      const confirmation = await screen.findByRole("dialog", { name: "Desativar acesso" });
      await user.click(within(confirmation).getByRole("button", { name: "Desativar acesso" }));

      expect(await screen.findByRole("button", { name: "Reativar acesso" })).toBeInTheDocument();
      expect(screen.getByRole("dialog", { name: "Editar membro" })).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();

      await user.click(saveButton());
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onRoleCall).not.toHaveBeenCalled();
    });

    it("Escape closes only the confirmation on top, not the edition under it", async () => {
      const user = userEvent.setup();
      const { onClose } = await renderDialog();

      await user.click(screen.getByRole("button", { name: "Desativar acesso" }));
      await screen.findByRole("dialog", { name: "Desativar acesso" });
      await user.keyboard("{Escape}");

      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "Desativar acesso" })).not.toBeInTheDocument(),
      );
      expect(screen.getByRole("dialog", { name: "Editar membro" })).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
