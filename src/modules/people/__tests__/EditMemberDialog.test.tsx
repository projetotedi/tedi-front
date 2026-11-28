import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getListAccessQueryKey } from "@api/generated";
import {
  MemberRegistrationStatus,
  MemberStatus,
  type MeResponseDto,
  type MemberDetailResponseDto,
  type UpdateAccessRoleDto,
} from "@api/generated/model";
import { getGetMemberQueryKey, getListMembersQueryKey } from "@api/generated/people/people";
import {
  buildMeUser,
  updateAccessEnabledHandler,
  updateAccessRoleHandler,
} from "@modules/auth/__tests__/handlers";
import { listDepartmentsHandler } from "@modules/auth/__tests__/member-registration-handlers";
import { renderSignedIn, server, setupAuthTestServer } from "@modules/auth/__tests__/test-utils";
import { Role } from "@shared/lib/role";

import { EditMemberDialog } from "../components/EditMemberDialog";
// Registers the "people" namespace.
import "../index";
import {
  buildMemberDetail,
  buildSeedMemberDetail,
  FORBIDDEN_SCOPE_ERROR,
  getMemberHandler,
  MEMBER_ID,
  MEMBER_NAME,
  MEMBER_NOT_FOUND_ERROR,
  updateMemberHandler,
} from "./handlers";

setupAuthTestServer();

const TECHNOLOGY = { id: "01952ef7-0000-7000-8000-0000000000d1", name: "Tecnologia" };
const PEDAGOGY = { id: "01952ef7-0000-7000-8000-0000000000d2", name: "Pedagogia" };
const COORDINATOR = buildMeUser({ role: Role.coordinator });
const DIRECTOR = buildMeUser({ role: Role.director });

const LAST_COORDINATOR_MESSAGE =
  "Esta é a última coordenação ativa. Promova outra pessoa a Coordenação antes de alterar o perfil ou desativar este acesso.";

interface RenderOptions {
  member?: MemberDetailResponseDto;
  me?: MeResponseDto;
}

/** The dialog over the member of the handlers, signed in as the coordination by default. */
async function renderDialog({
  member = buildMemberDetail(),
  me = COORDINATOR,
}: RenderOptions = {}) {
  const onDepartments = vi.fn();
  server.use(
    getMemberHandler({ member }),
    listDepartmentsHandler({ data: [TECHNOLOGY, PEDAGOGY], onCall: onDepartments }),
  );
  const onClose = vi.fn();
  const view = await renderSignedIn(
    <EditMemberDialog memberId={member.id} onClose={onClose} />,
    me,
  );
  await screen.findByRole("dialog", { name: "Editar membro" });
  return { ...view, onClose, onDepartments };
}

/** The dialog once the member is loaded and the form is on the screen. */
async function renderForm(options: RenderOptions = {}) {
  const view = await renderDialog(options);
  await screen.findByRole("form", { name: "Dados do membro" });
  return view;
}

const field = (name: string) => screen.getByRole("textbox", { name: new RegExp(`^${name}`) });
const saveButton = () => screen.getByRole("button", { name: "Salvar alterações" });
const roleSelect = () => screen.getByRole("button", { name: /Perfil de acesso/ });

async function choose(user: UserEvent, select: RegExp, option: string) {
  await user.click(screen.getByRole("button", { name: select }));
  await user.click(await screen.findByRole("option", { name: option }));
}

async function retype(user: UserEvent, name: string, value: string) {
  await user.clear(field(name));
  if (value) await user.type(field(name), value);
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("EditMemberDialog", () => {
  describe("loading the member", () => {
    it("is the 1040px Editar membro dialog, which loads the member before showing the form", async () => {
      await renderDialog();

      const dialog = screen.getByRole("dialog", { name: "Editar membro" });
      expect(dialog).toHaveClass("max-w-260");
      expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Fechar" })).toBeInTheDocument();
      expect(await screen.findByRole("form", { name: "Dados do membro" })).toBeInTheDocument();
      expect(saveButton()).toBeInTheDocument();
    });

    it("fills the form with the member, the phone masked and the CPF only as a hint", async () => {
      await renderForm();

      expect(field("Nome completo")).toHaveValue(MEMBER_NAME);
      expect(field("Telefone")).toHaveValue("(11) 99191-2020");
      expect(field("E-mail pessoal")).toHaveValue("bia.nunes@email.com");
      expect(field("CPF")).toHaveValue("");
      expect(screen.getByText("CPF atual: ***.***.789-00. Preencha só para trocar.")).toBeVisible();
      expect(field("Endereço")).toHaveValue("Rua Domingos de Morais, 45 — apto 32");
      expect(field("RA")).toHaveValue("202400003");
      expect(field("Período")).toHaveValue("5");
      expect(field("Link do termo de voluntariado")).toHaveValue(
        "https://drive.google.com/file/d/termo-beatriz/view",
      );
      expect(screen.getByRole("button", { name: /Estado \(UF\)/ })).toHaveTextContent("SP");
      expect(screen.getByRole("button", { name: /Departamento/ })).toHaveTextContent("Tecnologia");
    });

    it("says it when the member is out of the scope of the person, with nothing to save", async () => {
      server.use(getMemberHandler({ error: FORBIDDEN_SCOPE_ERROR }));
      await renderSignedIn(<EditMemberDialog memberId={MEMBER_ID} onClose={vi.fn()} />);

      expect(
        await screen.findByText("Você não tem acesso aos dados deste membro."),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Salvar alterações" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
    });

    it("says it when the member no longer exists", async () => {
      server.use(getMemberHandler({ error: MEMBER_NOT_FOUND_ERROR }));
      await renderSignedIn(<EditMemberDialog memberId={MEMBER_ID} onClose={vi.fn()} />);

      expect(
        await screen.findByText("Este membro não existe mais. Atualize a lista."),
      ).toBeInTheDocument();
    });

    it("offers Tentar de novo on any other failure, which loads the member", async () => {
      server.use(
        getMemberHandler({ error: { statusCode: 500, error: "INTERNAL", message: "Boom" } }),
      );
      const user = userEvent.setup();
      await renderSignedIn(<EditMemberDialog memberId={MEMBER_ID} onClose={vi.fn()} />);

      expect(
        await screen.findByText("Não foi possível carregar os dados do membro."),
      ).toBeInTheDocument();
      server.use(getMemberHandler(), listDepartmentsHandler());
      await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

      expect(await screen.findByRole("form", { name: "Dados do membro" })).toBeInTheDocument();
    });
  });

  describe("who sees what", () => {
    it("the coordination sees the access card and can move the member to another department", async () => {
      const { onDepartments } = await renderForm();

      const card = screen.getByRole("region", { name: "Acesso ao sistema" });
      expect(within(card).getByRole("button", { name: /Perfil de acesso/ })).toHaveTextContent(
        "Membro",
      );
      await waitFor(() => expect(onDepartments).toHaveBeenCalled());
      expect(screen.getByRole("button", { name: /Departamento/ })).toBeEnabled();
    });

    it("a director edits the data without the access card, and keeps the department", async () => {
      const { onDepartments } = await renderForm({ me: DIRECTOR });

      expect(screen.queryByRole("region", { name: "Acesso ao sistema" })).not.toBeInTheDocument();
      expect(field("Nome completo")).toBeEnabled();
      expect(screen.getByRole("button", { name: /Departamento/ })).toBeDisabled();
      expect(
        screen.getByText("Só a coordenação muda o departamento de um membro."),
      ).toBeInTheDocument();
      expect(onDepartments).not.toHaveBeenCalled();
    });

    it.each([
      ["an inactive member", buildMemberDetail({ status: MemberStatus.inactive })],
      [
        "a registration waiting for validation",
        buildMemberDetail({ registrationStatus: MemberRegistrationStatus.pending, role: null }),
      ],
      ["the seeded coordinator, with no registration", buildSeedMemberDetail()],
    ])("shows %s read only, with the access card still there", async (_case, member) => {
      await renderDialog({ member });

      const data = await screen.findByRole("form", { name: "Dados do membro" });
      expect(within(data).queryByRole("textbox")).not.toBeInTheDocument();
      expect(within(data).getByText(member.name)).toBeInTheDocument();
      expect(
        within(data).getByText(
          "Os dados só podem ser editados de um membro ativo, com o cadastro aprovado.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Acesso ao sistema" })).toBeInTheDocument();
    });
  });

  describe("saving the data", () => {
    it("closes without a request when nothing changed", async () => {
      const onUpdate = vi.fn();
      const onRole = vi.fn();
      server.use(
        updateMemberHandler({ onCall: onUpdate }),
        updateAccessRoleHandler({ onCall: onRole }),
      );
      const user = userEvent.setup();
      const { onClose } = await renderForm();

      await user.click(saveButton());

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onUpdate).not.toHaveBeenCalled();
      expect(onRole).not.toHaveBeenCalled();
    });

    it("sends only what changed, refreshes the member and the lists, and closes", async () => {
      const onUpdate = vi.fn();
      server.use(updateMemberHandler({ onCall: onUpdate }));
      const user = userEvent.setup();
      const { onClose, queryClient } = await renderForm();
      const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

      await retype(user, "Nome completo", "Beatriz Nunes");
      await retype(user, "Telefone", "1133334444");
      await retype(user, "Endereço", "");
      await choose(user, /Estado \(UF\)/, "Não informar");
      await user.click(saveButton());

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onUpdate).toHaveBeenCalledExactlyOnceWith({
        id: MEMBER_ID,
        body: { name: "Beatriz Nunes", phone: "1133334444", address: null, state: null },
      });
      expect(await screen.findByText("Dados de Beatriz Nunes atualizados.")).toBeInTheDocument();
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: getGetMemberQueryKey(MEMBER_ID) });
      // The list of Membros and the one Nova alocação offers share this key.
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: getListMembersQueryKey() });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: getListAccessQueryKey() });
    });

    it("sends a typed CPF in digits, and the department the coordination chose", async () => {
      const onUpdate = vi.fn();
      server.use(updateMemberHandler({ onCall: onUpdate }));
      const user = userEvent.setup();
      const { onClose } = await renderForm();

      await user.type(field("CPF"), "52998224725");
      expect(field("CPF")).toHaveValue("529.982.247-25");
      await choose(user, /Departamento/, "Pedagogia");
      await user.click(saveButton());

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onUpdate).toHaveBeenCalledExactlyOnceWith({
        id: MEMBER_ID,
        body: { cpf: "52998224725", departmentId: PEDAGOGY.id },
      });
    });

    it("checks the form first and puts the focus on the first field with a problem", async () => {
      const onUpdate = vi.fn();
      server.use(updateMemberHandler({ onCall: onUpdate }));
      const user = userEvent.setup();
      const { onClose } = await renderForm();

      await retype(user, "Nome completo", "");
      await user.type(field("CPF"), "11111111111");
      await retype(user, "Link do termo de voluntariado", "http://drive.example.com/termo");
      await user.click(saveButton());

      expect(await screen.findByText("Informe o nome completo.")).toBeInTheDocument();
      expect(screen.getByText("Informe um CPF válido, com 11 números.")).toBeInTheDocument();
      expect(screen.getByText("Informe um link que comece com https://.")).toBeInTheDocument();
      expect(field("Nome completo")).toHaveFocus();
      expect(onUpdate).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it.each([
      ["RA_ALREADY_IN_USE", "RA", "Este RA já é de outra pessoa."],
      ["EMAIL_ALREADY_IN_USE", "E-mail pessoal", "Este e-mail já é de outra pessoa."],
    ])("puts the 409 %s on its field, with the focus", async (code, name, message) => {
      server.use(updateMemberHandler({ error: { statusCode: 409, error: code } }));
      const user = userEvent.setup();
      const { onClose } = await renderForm();

      await retype(user, name, name === "RA" ? "202400009" : "outra@email.com");
      await user.click(saveButton());

      expect(await screen.findByText(message)).toBeInTheDocument();
      await waitFor(() => expect(field(name)).toHaveFocus());
      expect(onClose).not.toHaveBeenCalled();
    });

    it("puts the fields of a 400 VALIDATION_FAILED on the form", async () => {
      server.use(
        updateMemberHandler({
          error: {
            statusCode: 400,
            error: "VALIDATION_FAILED",
            details: [{ field: "phone", message: "phone is invalid" }],
          },
        }),
      );
      const user = userEvent.setup();
      await renderForm();

      await retype(user, "Telefone", "11988887777");
      await user.click(saveButton());

      expect(await screen.findByText("Informe o telefone com DDD.")).toBeInTheDocument();
      await waitFor(() => expect(field("Telefone")).toHaveFocus());
    });

    it.each([
      [
        { statusCode: 409, error: "MEMBER_INACTIVE" },
        "Este membro está inativo e os dados dele não podem mais ser editados.",
      ],
      [
        { statusCode: 403, error: "FORBIDDEN_SCOPE" },
        "Você não pode editar os dados deste membro.",
      ],
      [
        { statusCode: 503, error: "SERVICE_UNAVAILABLE" },
        "Não foi possível conectar. Tente de novo.",
      ],
    ])("says a refusal that is not of a field above the form: %o", async (error, message) => {
      server.use(updateMemberHandler({ error }));
      const user = userEvent.setup();
      const { onClose } = await renderForm();

      await retype(user, "Nome completo", "Beatriz Nunes");
      await user.click(saveButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(onClose).not.toHaveBeenCalled();
      expect(saveButton()).toBeEnabled();
    });

    it("blocks Cancelar and Escape while saving, and sends the save once", async () => {
      const deferred = createDeferred();
      const onUpdate = vi.fn();
      server.use(updateMemberHandler({ delay: deferred.promise, onCall: onUpdate }));
      const user = userEvent.setup();
      const { onClose } = await renderForm();

      await retype(user, "Nome completo", "Beatriz Nunes");
      await user.dblClick(saveButton());
      await screen.findByRole("button", { name: "Salvando…" });

      await user.keyboard("{Escape}");
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
      expect(roleSelect()).toBeDisabled();

      deferred.resolve();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe("saving the access profile", () => {
    it("sends only the role when only the role changed", async () => {
      const onUpdate = vi.fn();
      const onRole = vi.fn<(id: string, body: UpdateAccessRoleDto) => void>();
      server.use(
        updateMemberHandler({ onCall: onUpdate }),
        updateAccessRoleHandler({ onCall: onRole }),
      );
      const user = userEvent.setup();
      const { onClose } = await renderForm();

      await choose(user, /Perfil de acesso/, "Diretor");
      await user.click(saveButton());

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onRole).toHaveBeenCalledExactlyOnceWith(MEMBER_ID, { role: Role.director });
      expect(onUpdate).not.toHaveBeenCalled();
      expect(
        await screen.findByText(`Perfil de ${MEMBER_NAME} alterado para Diretor.`),
      ).toBeInTheDocument();
    });

    it("saves the data first and then the role", async () => {
      const calls: string[] = [];
      server.use(
        updateMemberHandler({ onCall: () => calls.push("member") }),
        updateAccessRoleHandler({ onCall: () => calls.push("role") }),
      );
      const user = userEvent.setup();
      const { onClose } = await renderForm();

      await retype(user, "Nome completo", "Beatriz Nunes");
      await choose(user, /Perfil de acesso/, "Diretor");
      await user.click(saveButton());

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(calls).toEqual(["member", "role"]);
    });

    it("keeps the dialog open on LAST_COORDINATOR, with the saved data and the role back", async () => {
      const onUpdate = vi.fn();
      const coordinator = buildMemberDetail({ role: Role.coordinator });
      server.use(
        updateMemberHandler({
          member: coordinator,
          onCall: (call) => {
            onUpdate(call);
            // The API keeps the change: the member read again has it.
            server.use(getMemberHandler({ member: { ...coordinator, name: "Beatriz Nunes" } }));
          },
        }),
        updateAccessRoleHandler({ error: { statusCode: 409, error: "LAST_COORDINATOR" } }),
      );
      const user = userEvent.setup();
      const { onClose } = await renderForm({ member: coordinator });

      await retype(user, "Nome completo", "Beatriz Nunes");
      await choose(user, /Perfil de acesso/, "Membro");
      await user.click(saveButton());

      expect(await screen.findByText(LAST_COORDINATOR_MESSAGE)).toBeInTheDocument();
      expect(await screen.findByText("Dados de Beatriz Nunes atualizados.")).toBeInTheDocument();
      expect(roleSelect()).toHaveTextContent("Coordenadora");
      expect(onClose).not.toHaveBeenCalled();
      expect(onUpdate).toHaveBeenCalledTimes(1);

      // The data is saved: trying again sends nothing but closes.
      await user.click(saveButton());
      expect(onUpdate).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("saves the role of a member whose data is read only", async () => {
      const onRole = vi.fn();
      server.use(updateAccessRoleHandler({ onCall: onRole }));
      const user = userEvent.setup();
      const { onClose } = await renderDialog({ member: buildSeedMemberDetail() });
      await screen.findByRole("form", { name: "Dados do membro" });

      await choose(user, /Perfil de acesso/, "Diretor");
      await user.click(saveButton());

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onRole).toHaveBeenCalledExactlyOnceWith(MEMBER_ID, { role: Role.director });
    });

    it("disables the role of the own account", async () => {
      const own = buildMemberDetail({ id: COORDINATOR.id, role: Role.coordinator });
      await renderForm({ member: own });

      expect(roleSelect()).toBeDisabled();
      expect(screen.getByRole("button", { name: "Desativar acesso" })).toBeDisabled();
    });

    it("Cancelar discards the chosen role and the typed data", async () => {
      const onUpdate = vi.fn();
      const onRole = vi.fn();
      server.use(
        updateMemberHandler({ onCall: onUpdate }),
        updateAccessRoleHandler({ onCall: onRole }),
      );
      const user = userEvent.setup();
      const { onClose } = await renderForm();

      await retype(user, "Nome completo", "Beatriz Nunes");
      await choose(user, /Perfil de acesso/, "Diretor");
      await user.click(screen.getByRole("button", { name: "Cancelar" }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onUpdate).not.toHaveBeenCalled();
      expect(onRole).not.toHaveBeenCalled();
    });

    it("Escape closes only the confirmation on top, not the edition under it", async () => {
      const user = userEvent.setup();
      const { onClose } = await renderForm();

      await user.click(screen.getByRole("button", { name: "Desativar acesso" }));
      await screen.findByRole("dialog", { name: "Desativar acesso" });
      await user.keyboard("{Escape}");

      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "Desativar acesso" })).not.toBeInTheDocument(),
      );
      expect(screen.getByRole("dialog", { name: "Editar membro" })).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("disabling the access keeps the dialog open and turns the button into Reativar acesso", async () => {
      server.use(updateAccessEnabledHandler());
      const user = userEvent.setup();
      const { onClose } = await renderForm();

      await user.click(screen.getByRole("button", { name: "Desativar acesso" }));
      const confirmation = await screen.findByRole("dialog", { name: "Desativar acesso" });
      await user.click(within(confirmation).getByRole("button", { name: "Desativar acesso" }));

      expect(await screen.findByRole("button", { name: "Reativar acesso" })).toBeInTheDocument();
      expect(screen.getByRole("dialog", { name: "Editar membro" })).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
