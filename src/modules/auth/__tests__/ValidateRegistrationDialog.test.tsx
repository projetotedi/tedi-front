import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getListAccessQueryKey, getMeQueryKey } from "@api/generated/auth/auth";
import { MemberRegistrationStatus, type MeResponseDto } from "@api/generated/model";
import {
  getGetMemberRegistrationQueryKey,
  getListMemberRegistrationsQueryKey,
  getListMembersQueryKey,
} from "@api/generated/people/people";
import { Role } from "@shared/lib/role";
import { toast, ToastProvider } from "@shared/ui";

import { AuthProvider } from "../AuthProvider";
import { ValidateRegistrationDialog } from "../components/ValidateRegistrationDialog";
import { buildMeUser, meHandler } from "./handlers";
import {
  approveMemberRegistrationHandler,
  buildApprovedRegistration,
  buildMemberRegistration,
  getMemberRegistrationHandler,
  listDepartmentsHandler,
  REGISTRATION_ID,
  rejectMemberRegistrationHandler,
  REVIEW_DEPARTMENTS,
  reviewError,
} from "./member-registration-handlers";
import { renderWithProviders, server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

afterEach(() => {
  toast.clear();
});

const [PEDAGOGY, TECHNOLOGY] = REVIEW_DEPARTMENTS;

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

interface RenderDialogOptions {
  user?: MeResponseDto;
  registration?: Parameters<typeof getMemberRegistrationHandler>[0];
  departments?: Parameters<typeof listDepartmentsHandler>[0];
}

async function renderDialog({
  user = buildMeUser(),
  registration,
  departments,
}: RenderDialogOptions = {}) {
  const onClose = vi.fn();
  const onReviewed = vi.fn();
  server.use(
    meHandler({ user }),
    getMemberRegistrationHandler(registration),
    listDepartmentsHandler(departments),
  );

  const view = await renderWithProviders(
    <AuthProvider>
      <ValidateRegistrationDialog
        registrationId={REGISTRATION_ID}
        onClose={onClose}
        onReviewed={onReviewed}
      />
      <ToastProvider regionLabel="Notificações" closeLabel="Fechar notificação" />
    </AuthProvider>,
  );
  return { ...view, onClose, onReviewed };
}

const TITLE = "Validar cadastro de membro";
const dialog = () => screen.getByRole("dialog", { name: TITLE });
const approveButton = () => screen.getByRole("button", { name: "Aprovar" });
const rejectButton = () => screen.getByRole("button", { name: "Recusar" });
const backButton = () => screen.getByRole("button", { name: "Voltar" });
const closeButton = () => screen.getByRole("button", { name: "Fechar" });
const roleSelect = () => screen.getByRole("button", { name: /Perfil de acesso/ });
const departmentSelect = () => screen.getByRole("button", { name: /Departamento/ });
const mainFunctionField = () => screen.getByRole("textbox", { name: /Função principal/ });
const joinedAtField = () => screen.getByLabelText(/Entrada no projeto/);
const noteField = () => screen.getByRole("textbox", { name: /Observação da validação/ });

/** Espera o formulário de um cadastro pendente aparecer, com os departamentos já carregados. */
async function renderReadyDialog(options: RenderDialogOptions = {}) {
  const view = await renderDialog(options);
  await screen.findByRole("textbox", { name: /Função principal/ });
  await waitFor(() => expect(departmentSelect()).toBeEnabled());
  return view;
}

async function choose(user: UserEvent, trigger: HTMLElement, option: string) {
  await user.click(trigger);
  await user.click(await screen.findByRole("option", { name: option }));
}

function setDate(value: string) {
  fireEvent.change(joinedAtField(), { target: { value } });
}

/**
 * O select não expõe `ref`, então o erro dele sobe para o alerta, que recebe o foco (e o leitor de
 * tela o lê). A mesma mensagem continua no campo.
 */
async function expectDepartmentRequiredOnTheAlert() {
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Escolha o departamento");
  await waitFor(() => expect(alert.parentElement).toHaveFocus());
  expect(screen.getAllByText("Escolha o departamento")).toHaveLength(2);
  return alert;
}

function valueOf(label: string): string {
  const term = within(dialog()).getByText(label, { selector: "dt" });
  return term.parentElement?.querySelector("dd")?.textContent ?? "";
}

describe("ValidateRegistrationDialog", () => {
  describe("layout", () => {
    it("opens the 800px dialog with the summary of the sending and the badge", async () => {
      await renderReadyDialog();

      expect(dialog()).toHaveClass("max-w-200");
      expect(dialog()).toHaveTextContent(
        "Lucas Andrade Souza enviou o cadastro pelo link em 18/09/2026, 14:32 · convite para Membro",
      );
      expect(within(dialog()).getByText("A validar")).toBeInTheDocument();
    });

    it("has the two sections, each one a named region", async () => {
      await renderReadyDialog();

      expect(
        within(dialog()).getByRole("region", { name: "Dados enviados pelo membro" }),
      ).toBeInTheDocument();
      expect(
        within(dialog()).getByRole("region", { name: "Definido pela coordenação" }),
      ).toBeInTheDocument();
      expect(
        within(dialog()).getByText(
          "Confira com o RA e o termo. Se algo estiver errado, recuse com uma observação para o membro corrigir.",
        ),
      ).toBeInTheDocument();
      expect(
        within(dialog()).getByText(
          "Vem preenchido com o convite e o que o membro indicou; ajuste antes de aprovar.",
        ),
      ).toBeInTheDocument();
    });

    it("labels every control and keeps the 44px targets", async () => {
      await renderReadyDialog();

      expect(roleSelect()).toBeInTheDocument();
      expect(departmentSelect()).toBeInTheDocument();
      expect(mainFunctionField()).toHaveClass("min-h-11", "text-base");
      expect(joinedAtField()).toHaveClass("min-h-11", "text-base");
      expect(noteField()).toHaveClass("text-base");
      for (const button of [approveButton(), rejectButton(), backButton()]) {
        expect(button).toHaveClass("min-h-11");
      }
      expect(approveButton()).toHaveAttribute("type", "button");
      expect(rejectButton()).toHaveAttribute("type", "button");
    });

    it("marks what is required and explains the note", async () => {
      await renderReadyDialog();

      expect(mainFunctionField()).toBeRequired();
      expect(joinedAtField()).toBeRequired();
      expect(roleSelect()).toHaveAccessibleName(/\(obrigatório\)/);
      expect(departmentSelect()).toHaveAccessibleName(/\(obrigatório\)/);
      expect(noteField()).not.toBeRequired();
      expect(noteField()).toHaveAccessibleDescription(
        "Obrigatória ao recusar. Fica registrada no cadastro; não escreva dados pessoais.",
      );
    });
  });

  describe("submitted data", () => {
    it("shows what the member sent, read-only", async () => {
      await renderReadyDialog();

      expect(valueOf("Nome completo")).toBe("Lucas Andrade Souza");
      expect(valueOf("Data de nascimento")).toMatch(/^22\/05\/2004 \(\d+ anos\)$/);
      expect(valueOf("CPF")).toBe("529.982.247-25");
      expect(valueOf("Telefone")).toBe("(11) 98181-3030");
      expect(valueOf("E-mail pessoal")).toBe("lucas.souza@example.com");
      expect(valueOf("E-mail institucional")).toBe("lucas.souza@aluno.example.edu.br");
      expect(valueOf("Endereço")).toBe("Rua das Flores, 120, apto 4");
      expect(valueOf("Cidade")).toBe("Campinas");
      expect(valueOf("Estado (UF)")).toBe("SP");
      expect(valueOf("RA")).toBe("202600117");
      expect(valueOf("Curso da faculdade")).toBe("Sistemas de Informação");
      expect(valueOf("Período")).toBe("3º");
      expect(valueOf("Turma da faculdade")).toBe("SI 3A");
      expect(valueOf("Departamento indicado")).toBe("Tecnologia");
    });

    it("opens the volunteer term in a new tab", async () => {
      await renderReadyDialog();

      const link = within(dialog()).getByRole("link", {
        name: "Abrir termo de voluntariado (abre em nova aba)",
      });
      expect(link).toHaveAttribute("href", "https://drive.google.com/file/d/termo-lucas/view");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it.each(["http://example.com/termo.pdf", "javascript:alert(1)"])(
      "shows the term %s as text, never as a link",
      async (volunteerTermUrl) => {
        await renderReadyDialog({
          registration: { registration: buildMemberRegistration({ volunteerTermUrl }) },
        });

        expect(within(dialog()).queryByRole("link")).not.toBeInTheDocument();
        expect(valueOf("Termo de voluntariado")).toBe(volunteerTermUrl);
      },
    );

    it("says Não informado for what the member left out", async () => {
      await renderReadyDialog({
        registration: {
          registration: buildMemberRegistration({
            phone: null,
            address: null,
            birthDate: null,
            semester: null,
            department: null,
            volunteerTermUrl: null,
          }),
        },
      });

      for (const label of [
        "Telefone",
        "Endereço",
        "Data de nascimento",
        "Período",
        "Departamento indicado",
        "Termo de voluntariado",
      ]) {
        expect(valueOf(label), label).toBe("Não informado");
      }
    });

    it("shows the time of the sending in the São Paulo time zone", async () => {
      await renderReadyDialog({
        registration: {
          registration: buildMemberRegistration({ submittedAt: "2026-09-19T02:00:00.000Z" }),
        },
      });

      expect(dialog()).toHaveTextContent("em 18/09/2026, 23:00");
    });

    it("leaves the invite out of the summary when it did not carry a profile", async () => {
      await renderReadyDialog({
        registration: { registration: buildMemberRegistration({ requestedRole: null }) },
      });

      expect(dialog()).not.toHaveTextContent("convite para");
    });
  });

  describe("pre-filled review", () => {
    it("starts from the profile of the invite, the department the member indicated and the sending day", async () => {
      await renderReadyDialog();

      expect(roleSelect()).toHaveTextContent("Membro");
      expect(departmentSelect()).toHaveTextContent("Tecnologia");
      expect(mainFunctionField()).toHaveValue("");
      expect(joinedAtField()).toHaveValue("2026-09-18");
      expect(noteField()).toHaveValue("");
    });

    it("starts from the day of the sending in São Paulo, not in UTC", async () => {
      await renderReadyDialog({
        registration: {
          registration: buildMemberRegistration({ submittedAt: "2026-09-19T02:00:00.000Z" }),
        },
      });

      expect(joinedAtField()).toHaveValue("2026-09-18");
    });

    it("starts from the profile the invite carried when it is not the member's", async () => {
      await renderReadyDialog({
        registration: { registration: buildMemberRegistration({ requestedRole: Role.director }) },
      });

      expect(roleSelect()).toHaveTextContent("Diretor");
    });

    it("starts from the main function when the member already has one", async () => {
      await renderReadyDialog({
        registration: {
          registration: buildMemberRegistration({ mainFunction: "Monitoria em sala" }),
        },
      });

      expect(mainFunctionField()).toHaveValue("Monitoria em sala");
    });
  });

  describe("approving", () => {
    it("sends the profile, department, main function, joining date and note", async () => {
      const user = userEvent.setup();
      const onCall = vi.fn();
      server.use(approveMemberRegistrationHandler({ onCall }));
      const { onClose, onReviewed } = await renderReadyDialog();

      await choose(user, roleSelect(), "Diretor");
      await choose(user, departmentSelect(), "Pedagogia");
      await user.type(mainFunctionField(), "  Monitoria em sala  ");
      setDate("2026-09-10");
      await user.type(noteField(), "Bem-vindo ao projeto.");
      await user.click(approveButton());

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledWith(REGISTRATION_ID, {
        role: "director",
        departmentId: PEDAGOGY.id,
        mainFunction: "Monitoria em sala",
        joinedAt: "2026-09-10",
        note: "Bem-vindo ao projeto.",
      });
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onReviewed).toHaveBeenCalledWith(
        expect.objectContaining({
          id: REGISTRATION_ID,
          registrationStatus: MemberRegistrationStatus.approved,
          role: "director",
        }),
      );
    });

    it("sends what was pre-filled, with no note", async () => {
      const user = userEvent.setup();
      const onCall = vi.fn();
      server.use(approveMemberRegistrationHandler({ onCall }));
      await renderReadyDialog();

      await user.type(mainFunctionField(), "Monitoria em sala");
      await user.click(approveButton());

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledWith(REGISTRATION_ID, {
        role: "member",
        departmentId: TECHNOLOGY.id,
        mainFunction: "Monitoria em sala",
        joinedAt: "2026-09-18",
        note: null,
      });
    });

    it("shows the success toast with the profile and the RA, and closes", async () => {
      const user = userEvent.setup();
      server.use(approveMemberRegistrationHandler());
      const { onClose } = await renderReadyDialog();

      await choose(user, roleSelect(), "Diretor");
      await user.type(mainFunctionField(), "Monitoria em sala");
      await user.click(approveButton());

      expect(await screen.findByText("Cadastro aprovado")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Lucas Andrade Souza agora tem acesso como Diretor e já pode entrar com o RA 202600117.",
        ),
      ).toBeInTheDocument();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("refreshes the registrations, members and access lists, and keeps the answer in the detail", async () => {
      const user = userEvent.setup();
      server.use(approveMemberRegistrationHandler());
      const { queryClient } = await renderReadyDialog();
      const lists = [
        getListMemberRegistrationsQueryKey({ status: "pending", page: 1 }),
        getListMembersQueryKey({ page: 1 }),
        getListAccessQueryKey({ page: 1 }),
      ];
      for (const key of lists) queryClient.setQueryData(key, { data: [] });
      const detailKey = getGetMemberRegistrationQueryKey(REGISTRATION_ID);

      await choose(user, roleSelect(), "Diretor");
      await user.type(mainFunctionField(), "Monitoria em sala");
      await user.click(approveButton());

      await screen.findByText("Cadastro aprovado");
      for (const key of lists) {
        expect(queryClient.getQueryState(key)?.isInvalidated, String(key)).toBe(true);
      }
      expect(queryClient.getQueryData(detailKey)).toEqual(
        expect.objectContaining({
          registrationStatus: MemberRegistrationStatus.approved,
          role: "director",
        }),
      );
      expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(false);
    });

    it("approves a coordinator without department", async () => {
      const user = userEvent.setup();
      const onCall = vi.fn();
      server.use(approveMemberRegistrationHandler({ onCall }));
      await renderReadyDialog();

      await choose(user, roleSelect(), "Coordenadora");
      await choose(user, departmentSelect(), "Sem departamento");
      await user.type(mainFunctionField(), "Coordenação geral");
      await user.click(approveButton());

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledWith(REGISTRATION_ID, {
        role: "coordinator",
        departmentId: null,
        mainFunction: "Coordenação geral",
        joinedAt: "2026-09-18",
        note: null,
      });
    });

    it("offers Sem departamento only to the coordinator, and marks the department as required only for the others", async () => {
      const user = userEvent.setup();
      await renderReadyDialog();

      expect(departmentSelect()).toHaveAccessibleName(/\(obrigatório\)/);
      await user.click(departmentSelect());
      expect(await screen.findByRole("option", { name: "Pedagogia" })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "Sem departamento" })).not.toBeInTheDocument();
      await user.keyboard("{Escape}");

      await choose(user, roleSelect(), "Coordenadora");

      expect(departmentSelect()).not.toHaveAccessibleName(/obrigatório/);
      await user.click(departmentSelect());
      expect(await screen.findByRole("option", { name: "Sem departamento" })).toBeInTheDocument();
    });

    it("shows Sem departamento for a coordinator whose registration has no indicated department", async () => {
      const user = userEvent.setup();
      const onCall = vi.fn();
      server.use(approveMemberRegistrationHandler({ onCall }));
      await renderReadyDialog({
        registration: {
          registration: buildMemberRegistration({
            department: null,
            requestedRole: Role.coordinator,
          }),
        },
      });

      expect(departmentSelect()).toHaveTextContent("Sem departamento");
      await user.type(mainFunctionField(), "Coordenação geral");
      await user.click(approveButton());

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall.mock.calls[0][1]).toMatchObject({ role: "coordinator", departmentId: null });
    });

    it.each([Role.member, Role.director])(
      "requires a department for %s and does not send without it",
      async (requestedRole) => {
        const user = userEvent.setup();
        const onCall = vi.fn();
        server.use(approveMemberRegistrationHandler({ onCall }));
        await renderReadyDialog({
          registration: {
            registration: buildMemberRegistration({ department: null, requestedRole }),
          },
        });

        await user.type(mainFunctionField(), "Monitoria em sala");
        await user.click(approveButton());

        await expectDepartmentRequiredOnTheAlert();
        expect(onCall).not.toHaveBeenCalled();
        expect(screen.queryByText("Cadastro aprovado")).not.toBeInTheDocument();
      },
    );

    it("asks for the department again when the coordinator without department becomes a member", async () => {
      const user = userEvent.setup();
      const onCall = vi.fn();
      server.use(approveMemberRegistrationHandler({ onCall }));
      await renderReadyDialog();
      await choose(user, roleSelect(), "Coordenadora");
      await choose(user, departmentSelect(), "Sem departamento");
      await choose(user, roleSelect(), "Membro");
      await user.type(mainFunctionField(), "Monitoria em sala");

      await user.click(approveButton());

      await expectDepartmentRequiredOnTheAlert();
      expect(onCall).not.toHaveBeenCalled();
    });

    it("puts the focus on the alert, not on a later field, when the department and the main function are both missing", async () => {
      const user = userEvent.setup();
      const onCall = vi.fn();
      server.use(approveMemberRegistrationHandler({ onCall }));
      await renderReadyDialog({
        registration: { registration: buildMemberRegistration({ department: null }) },
      });

      await user.click(approveButton());

      const alert = await expectDepartmentRequiredOnTheAlert();
      expect(screen.getByText("Informe a função principal")).toBeInTheDocument();
      // O react-hook-form voltaria a focar o campo de texto num setTimeout: espera passar e confere de novo.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(alert.parentElement).toHaveFocus();
      expect(mainFunctionField()).not.toHaveFocus();
      expect(onCall).not.toHaveBeenCalled();
    });

    it("takes the focus to the alert again on every new attempt", async () => {
      const user = userEvent.setup();
      await renderReadyDialog({
        registration: { registration: buildMemberRegistration({ department: null }) },
      });
      await user.type(mainFunctionField(), "Monitoria em sala");
      await user.click(approveButton());
      await expectDepartmentRequiredOnTheAlert();

      await user.click(mainFunctionField());
      expect(mainFunctionField()).toHaveFocus();
      await user.click(approveButton());

      await expectDepartmentRequiredOnTheAlert();
    });

    it("does not send without the main function, and puts the focus on it", async () => {
      const user = userEvent.setup();
      const onCall = vi.fn();
      server.use(approveMemberRegistrationHandler({ onCall }));
      await renderReadyDialog();

      await user.click(approveButton());

      expect(await screen.findByText("Informe a função principal")).toBeInTheDocument();
      expect(mainFunctionField()).toHaveAttribute("aria-invalid", "true");
      await waitFor(() => expect(mainFunctionField()).toHaveFocus());
      // Campo de texto: o foco vai nele, e o alerta fica de fora.
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(onCall).not.toHaveBeenCalled();
    });

    it.each([
      ["a date in the future", "2999-01-01"],
      ["a date before 2000", "1999-12-31"],
    ])("does not send %s", async (_label, date) => {
      const user = userEvent.setup();
      const onCall = vi.fn();
      server.use(approveMemberRegistrationHandler({ onCall }));
      await renderReadyDialog();
      await user.type(mainFunctionField(), "Monitoria em sala");
      setDate(date);

      await user.click(approveButton());

      expect(
        await screen.findByText("Informe uma data entre 01/01/2000 e hoje"),
      ).toBeInTheDocument();
      expect(joinedAtField()).toHaveAttribute("aria-invalid", "true");
      expect(onCall).not.toHaveBeenCalled();
    });

    it("does not send a note over 500 characters", async () => {
      const user = userEvent.setup();
      const onCall = vi.fn();
      server.use(approveMemberRegistrationHandler({ onCall }));
      await renderReadyDialog();
      await user.type(mainFunctionField(), "Monitoria em sala");
      await user.click(noteField());
      await user.paste("a".repeat(501));

      await user.click(approveButton());

      expect(
        await screen.findByText("A observação pode ter no máximo 500 caracteres"),
      ).toBeInTheDocument();
      expect(onCall).not.toHaveBeenCalled();
    });

    it("clears the message of a field once it is fixed", async () => {
      const user = userEvent.setup();
      await renderReadyDialog();
      await user.click(approveButton());
      await screen.findByText("Informe a função principal");

      await user.type(mainFunctionField(), "M");

      await waitFor(() =>
        expect(screen.queryByText("Informe a função principal")).not.toBeInTheDocument(),
      );
      expect(mainFunctionField()).not.toHaveAttribute("aria-invalid", "true");
    });

    it("submits once on a double click", async () => {
      const user = userEvent.setup();
      const deferred = createDeferred();
      const onCall = vi.fn();
      server.use(approveMemberRegistrationHandler({ delay: deferred.promise, onCall }));
      await renderReadyDialog();
      await user.type(mainFunctionField(), "Monitoria em sala");

      await user.dblClick(approveButton());
      await user.click(await screen.findByRole("button", { name: "Aprovando…" }));

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      deferred.resolve();
      await screen.findByText("Cadastro aprovado");
      expect(onCall).toHaveBeenCalledTimes(1);
    });

    it("locks the dialog while the request is in flight", async () => {
      const user = userEvent.setup();
      const deferred = createDeferred();
      const { onClose } = await renderReadyDialog();
      server.use(approveMemberRegistrationHandler({ delay: deferred.promise }));
      await user.type(mainFunctionField(), "Monitoria em sala");

      await user.click(approveButton());

      const busyButton = await screen.findByRole("button", { name: "Aprovando…" });
      expect(busyButton).toHaveAttribute("aria-disabled", "true");
      expect(busyButton.querySelector("[data-slot='spinner']")).toBeInTheDocument();
      expect(rejectButton()).toBeDisabled();
      expect(backButton()).toBeDisabled();
      expect(closeButton()).toBeDisabled();
      expect(mainFunctionField()).toBeDisabled();
      expect(roleSelect()).toBeDisabled();

      await user.keyboard("{Escape}");
      expect(onClose).not.toHaveBeenCalled();

      deferred.resolve();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });
  });

  describe("rejecting", () => {
    it("does not send the rejection without a note", async () => {
      const user = userEvent.setup();
      const onCall = vi.fn();
      server.use(rejectMemberRegistrationHandler({ onCall }));
      const { onClose } = await renderReadyDialog();

      await user.click(rejectButton());

      expect(await screen.findByText("Escreva uma observação para recusar")).toBeInTheDocument();
      expect(noteField()).toHaveAttribute("aria-invalid", "true");
      await waitFor(() => expect(noteField()).toHaveFocus());
      expect(onCall).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("does not accept a note that is only spaces", async () => {
      const user = userEvent.setup();
      const onCall = vi.fn();
      server.use(rejectMemberRegistrationHandler({ onCall }));
      await renderReadyDialog();
      await user.type(noteField(), "     ");

      await user.click(rejectButton());

      expect(await screen.findByText("Escreva uma observação para recusar")).toBeInTheDocument();
      expect(onCall).not.toHaveBeenCalled();
    });

    it("rejects with the note, ignoring what only matters when approving", async () => {
      const user = userEvent.setup();
      const onCall = vi.fn();
      server.use(rejectMemberRegistrationHandler({ onCall }));
      const { onClose, onReviewed } = await renderReadyDialog();
      setDate("2999-01-01");
      await user.type(noteField(), "  O RA não confere com o termo.  ");

      await user.click(rejectButton());

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall).toHaveBeenCalledWith(REGISTRATION_ID, {
        note: "O RA não confere com o termo.",
      });
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onReviewed).toHaveBeenCalledWith(
        expect.objectContaining({
          registrationStatus: MemberRegistrationStatus.rejected,
          role: null,
          reviewNote: "O RA não confere com o termo.",
        }),
      );
    });

    it("shows the toast, refreshes the lists and keeps the rejection in the detail", async () => {
      const user = userEvent.setup();
      server.use(rejectMemberRegistrationHandler());
      const { queryClient } = await renderReadyDialog();
      const lists = [
        getListMemberRegistrationsQueryKey({ status: "pending" }),
        getListMembersQueryKey({ page: 1 }),
        getListAccessQueryKey({ page: 1 }),
      ];
      for (const key of lists) queryClient.setQueryData(key, { data: [] });
      await user.type(noteField(), "O RA não confere com o termo.");

      await user.click(rejectButton());

      expect(await screen.findByText("Cadastro recusado")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Lucas Andrade Souza não recebe acesso. A observação fica registrada no cadastro dele.",
        ),
      ).toBeInTheDocument();
      for (const key of lists) {
        expect(queryClient.getQueryState(key)?.isInvalidated, String(key)).toBe(true);
      }
      expect(queryClient.getQueryData(getGetMemberRegistrationQueryKey(REGISTRATION_ID))).toEqual(
        expect.objectContaining({ registrationStatus: MemberRegistrationStatus.rejected }),
      );
    });

    it("shows the rejecting state on its own button", async () => {
      const user = userEvent.setup();
      const deferred = createDeferred();
      server.use(rejectMemberRegistrationHandler({ delay: deferred.promise }));
      await renderReadyDialog();
      await user.type(noteField(), "Dados incompletos.");

      await user.click(rejectButton());

      const busyButton = await screen.findByRole("button", { name: "Recusando…" });
      expect(busyButton).toHaveAttribute("aria-disabled", "true");
      expect(approveButton()).toBeDisabled();

      deferred.resolve();
      await screen.findByText("Cadastro recusado");
    });
  });

  describe("errors of the action", () => {
    async function approveWith(user: UserEvent) {
      await user.type(mainFunctionField(), "Monitoria em sala");
      await user.click(approveButton());
    }

    it("keeps the dialog open and locks the actions when someone else already decided (409)", async () => {
      const user = userEvent.setup();
      server.use(
        approveMemberRegistrationHandler({
          error: reviewError(409, "REGISTRATION_NOT_PENDING"),
        }),
      );
      const { queryClient, onClose, onReviewed } = await renderReadyDialog();
      const listKey = getListMemberRegistrationsQueryKey({ status: "pending" });
      queryClient.setQueryData(listKey, { data: [] });
      const detailKey = getGetMemberRegistrationQueryKey(REGISTRATION_ID);

      await approveWith(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Este cadastro já foi validado por outra pessoa da coordenação. Feche e confira a lista atualizada.",
      );
      expect(onClose).not.toHaveBeenCalled();
      expect(onReviewed).not.toHaveBeenCalled();
      expect(approveButton()).toBeDisabled();
      expect(rejectButton()).toBeDisabled();
      expect(backButton()).toBeEnabled();
      expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(false);
      expect(screen.queryByText("Cadastro aprovado")).not.toBeInTheDocument();
    });

    it("also locks the actions when the 409 comes from a rejection", async () => {
      const user = userEvent.setup();
      server.use(
        rejectMemberRegistrationHandler({ error: reviewError(409, "REGISTRATION_NOT_PENDING") }),
      );
      const { onClose } = await renderReadyDialog();
      await user.type(noteField(), "Dados incompletos.");

      await user.click(rejectButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "já foi validado por outra pessoa",
      );
      expect(onClose).not.toHaveBeenCalled();
      expect(approveButton()).toBeDisabled();
      expect(rejectButton()).toBeDisabled();
    });

    it("moves the focus to the alert", async () => {
      const user = userEvent.setup();
      server.use(
        approveMemberRegistrationHandler({ error: reviewError(409, "REGISTRATION_NOT_PENDING") }),
      );
      await renderReadyDialog();

      await approveWith(user);

      const alert = await screen.findByRole("alert");
      await waitFor(() => expect(alert.parentElement).toHaveFocus());
    });

    it("draws a visible focus ring around the alert that takes the focus", async () => {
      const user = userEvent.setup();
      server.use(
        approveMemberRegistrationHandler({ error: reviewError(409, "REGISTRATION_NOT_PENDING") }),
      );
      await renderReadyDialog();

      await approveWith(user);

      const container = (await screen.findByRole("alert")).parentElement;
      await waitFor(() => expect(container).toHaveFocus());
      // O foco vem do código e a pessoa de teclado precisa vê-lo: nada de `outline-none`.
      expect(container).toHaveAttribute("tabindex", "-1");
      expect(container).toHaveClass(
        "rounded-xl",
        "outline-hidden",
        "focus-visible:ring-3",
        "focus-visible:ring-focus",
      );
      expect(container).not.toHaveClass("outline-none");
    });

    it("does not close on a 404, and keeps what was typed", async () => {
      const user = userEvent.setup();
      server.use(
        approveMemberRegistrationHandler({
          error: reviewError(404, "MEMBER_REGISTRATION_NOT_FOUND"),
        }),
      );
      const { onClose } = await renderReadyDialog();

      await approveWith(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Cadastro não encontrado. Ele pode ter sido removido.",
      );
      expect(onClose).not.toHaveBeenCalled();
      expect(mainFunctionField()).toHaveValue("Monitoria em sala");
      expect(backButton()).toBeEnabled();
    });

    it("marks the department and refreshes the departments on DEPARTMENT_NOT_FOUND", async () => {
      const user = userEvent.setup();
      const onDepartments = vi.fn();
      server.use(
        approveMemberRegistrationHandler({ error: reviewError(400, "DEPARTMENT_NOT_FOUND") }),
      );
      const { onClose } = await renderReadyDialog({ departments: { onCall: onDepartments } });
      expect(onDepartments).toHaveBeenCalledTimes(1);

      await approveWith(user);

      const messages = await screen.findAllByText(
        "Este departamento não existe mais. Escolha outro.",
      );
      // Uma no campo e outra no alerta que recebe o foco (o select não expõe o foco).
      expect(messages).toHaveLength(2);
      await waitFor(() => expect(onDepartments).toHaveBeenCalledTimes(2));
      expect(onClose).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.getByRole("alert").parentElement).toHaveFocus());
    });

    it("marks the profile on INVALID_ROLE", async () => {
      const user = userEvent.setup();
      server.use(approveMemberRegistrationHandler({ error: reviewError(400, "INVALID_ROLE") }));
      const { onClose } = await renderReadyDialog();

      await approveWith(user);

      const messages = await screen.findAllByText(
        "Este perfil não pode ser concedido. Escolha outro.",
      );
      expect(messages).toHaveLength(2);
      expect(onClose).not.toHaveBeenCalled();
    });

    it("marks the field the back refused on VALIDATION_FAILED and focuses it", async () => {
      const user = userEvent.setup();
      server.use(
        approveMemberRegistrationHandler({
          error: reviewError(400, "VALIDATION_FAILED", [
            { field: "joinedAt", message: "joinedAt must be a valid date" },
          ]),
        }),
      );
      const { onClose } = await renderReadyDialog();

      await approveWith(user);

      expect(
        await screen.findByText("Informe uma data entre 01/01/2000 e hoje"),
      ).toBeInTheDocument();
      expect(joinedAtField()).toHaveAttribute("aria-invalid", "true");
      await waitFor(() => expect(joinedAtField()).toHaveFocus());
      expect(onClose).not.toHaveBeenCalled();
    });

    it("marks every field the back refused", async () => {
      const user = userEvent.setup();
      server.use(
        rejectMemberRegistrationHandler({
          error: reviewError(400, "VALIDATION_FAILED", [
            { field: "note", message: "note must be shorter" },
          ]),
        }),
      );
      await renderReadyDialog();
      await user.type(noteField(), "Dados incompletos.");

      await user.click(rejectButton());

      expect(
        await screen.findByText("A observação não foi aceita. Confira o texto e tente de novo."),
      ).toBeInTheDocument();
      await waitFor(() => expect(noteField()).toHaveFocus());
    });

    it("falls back to a general message when the back refuses a field the form does not have", async () => {
      const user = userEvent.setup();
      server.use(
        approveMemberRegistrationHandler({
          error: reviewError(400, "VALIDATION_FAILED", [{ field: "other", message: "invalid" }]),
        }),
      );
      await renderReadyDialog();

      await approveWith(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Algum dado não foi aceito. Confira os campos e tente de novo.",
      );
    });

    it("shows the network message and keeps the dialog open", async () => {
      const user = userEvent.setup();
      server.use(approveMemberRegistrationHandler({ networkError: true }));
      const { onClose } = await renderReadyDialog();

      await approveWith(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível conectar. Verifique a sua conexão e tente de novo.",
      );
      expect(onClose).not.toHaveBeenCalled();
      expect(approveButton()).toBeEnabled();
    });

    it("shows a general message on an unexpected error", async () => {
      const user = userEvent.setup();
      server.use(
        approveMemberRegistrationHandler({ error: reviewError(500, "INTERNAL_SERVER_ERROR") }),
      );
      await renderReadyDialog();

      await approveWith(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível concluir a validação. Tente novamente.",
      );
    });

    it("lets the person try again after a failure", async () => {
      const user = userEvent.setup();
      server.use(approveMemberRegistrationHandler({ networkError: true }));
      const { onClose } = await renderReadyDialog();
      await approveWith(user);
      await screen.findByRole("alert");

      const onCall = vi.fn();
      server.use(approveMemberRegistrationHandler({ onCall }));
      await user.click(approveButton());

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(
        screen.queryByText("Não foi possível conectar. Verifique a sua conexão e tente de novo."),
      ).not.toBeInTheDocument();
    });
  });

  describe("departments", () => {
    it("warns when there is no department and blocks approving a member", async () => {
      const user = userEvent.setup();
      const onApprove = vi.fn();
      const onReject = vi.fn();
      server.use(
        approveMemberRegistrationHandler({ onCall: onApprove }),
        rejectMemberRegistrationHandler({ onCall: onReject }),
      );
      await renderDialog({ departments: { data: [] } });
      await screen.findByText("Nenhum departamento cadastrado");

      expect(
        screen.getByText(
          "A coordenação precisa cadastrar os departamentos antes de aprovar um membro ou diretor. Para aprovar como Coordenadora, o departamento é opcional.",
        ),
      ).toBeInTheDocument();
      expect(approveButton()).toBeDisabled();
      expect(approveButton()).toHaveAccessibleDescription(/Nenhum departamento cadastrado/);

      // Recusar não depende de departamento.
      await user.type(noteField(), "Dados incompletos.");
      await user.click(rejectButton());
      await waitFor(() => expect(onReject).toHaveBeenCalledTimes(1));
      expect(onApprove).not.toHaveBeenCalled();
    });

    it("blocks approving a director too, and allows a coordinator, who goes without department", async () => {
      const user = userEvent.setup();
      const onCall = vi.fn();
      server.use(approveMemberRegistrationHandler({ onCall }));
      await renderDialog({
        departments: { data: [] },
        registration: { registration: buildMemberRegistration({ requestedRole: Role.director }) },
      });
      await screen.findByText("Nenhum departamento cadastrado");
      expect(approveButton()).toBeDisabled();

      await choose(user, roleSelect(), "Coordenadora");

      expect(approveButton()).toBeEnabled();
      expect(approveButton()).not.toHaveAccessibleDescription(/Nenhum departamento cadastrado/);
      await user.type(mainFunctionField(), "Coordenação geral");
      await user.click(approveButton());
      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall.mock.calls[0][1]).toMatchObject({ role: "coordinator", departmentId: null });
    });

    it("does not send the department the member indicated while the list is empty", async () => {
      const user = userEvent.setup();
      const onCall = vi.fn();
      server.use(approveMemberRegistrationHandler({ onCall }));
      await renderDialog({
        departments: { data: [] },
        registration: {
          registration: buildMemberRegistration({
            requestedRole: Role.coordinator,
            department: TECHNOLOGY,
          }),
        },
      });
      await screen.findByText("Nenhum departamento cadastrado");

      await user.type(mainFunctionField(), "Coordenação geral");
      await user.click(approveButton());

      await waitFor(() => expect(onCall).toHaveBeenCalledTimes(1));
      expect(onCall.mock.calls[0][1]).toMatchObject({ departmentId: null });
    });

    it("keeps the department locked and the approval blocked while the list loads", async () => {
      const deferred = createDeferred();
      await renderDialog({ departments: { delay: deferred.promise } });
      await screen.findByRole("textbox", { name: /Função principal/ });

      expect(departmentSelect()).toBeDisabled();
      expect(departmentSelect()).toHaveTextContent("Carregando departamentos…");
      expect(approveButton()).toBeDisabled();
      expect(rejectButton()).toBeEnabled();

      deferred.resolve();

      await waitFor(() => expect(departmentSelect()).toBeEnabled());
      expect(departmentSelect()).toHaveTextContent("Tecnologia");
      expect(approveButton()).toBeEnabled();
    });

    it("offers to try again when the list cannot be loaded", async () => {
      const user = userEvent.setup();
      const onCall = vi.fn();
      await renderDialog({
        departments: { error: reviewError(500, "INTERNAL_SERVER_ERROR"), onCall },
      });
      await screen.findByText("Não foi possível carregar os departamentos.");
      expect(departmentSelect()).toBeDisabled();
      expect(approveButton()).toBeDisabled();
      expect(approveButton()).toHaveAccessibleDescription(
        "Não foi possível carregar os departamentos.",
      );

      server.use(listDepartmentsHandler({ onCall }));
      await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

      await waitFor(() => expect(departmentSelect()).toBeEnabled());
      expect(onCall).toHaveBeenCalledTimes(2);
      expect(
        screen.queryByText("Não foi possível carregar os departamentos."),
      ).not.toBeInTheDocument();
      expect(approveButton()).toBeEnabled();
    });
  });

  describe("permission", () => {
    it.each([Role.director, Role.member])(
      "renders nothing and requests nothing for a %s",
      async (role) => {
        const onRegistration = vi.fn();
        const onDepartments = vi.fn();
        const { queryClient } = await renderDialog({
          user: buildMeUser({ role }),
          registration: { onCall: onRegistration },
          departments: { onCall: onDepartments },
        });
        await waitFor(() =>
          expect(queryClient.getQueryState(getMeQueryKey())?.status).toBe("success"),
        );
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(onRegistration).not.toHaveBeenCalled();
        expect(onDepartments).not.toHaveBeenCalled();
      },
    );

    it.each([Role.coordinator, Role.superadmin])("opens for a %s", async (role) => {
      await renderReadyDialog({ user: buildMeUser({ role }) });

      expect(dialog()).toBeInTheDocument();
    });

    it("renders nothing, and requests nothing, while the session is loading", async () => {
      const session = createDeferred();
      const onRegistration = vi.fn();
      server.use(
        http.get("*/auth/me", async () => {
          await session.promise;
          return HttpResponse.json(buildMeUser());
        }),
        getMemberRegistrationHandler({ onCall: onRegistration }),
        listDepartmentsHandler(),
      );
      await renderWithProviders(
        <AuthProvider>
          <ValidateRegistrationDialog registrationId={REGISTRATION_ID} onClose={vi.fn()} />
        </AuthProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(onRegistration).not.toHaveBeenCalled();

      session.resolve();
      expect(await screen.findByRole("dialog", { name: TITLE })).toBeInTheDocument();
    });
  });

  describe("closing", () => {
    it("Voltar, the close button and Escape close without sending anything", async () => {
      const user = userEvent.setup();
      const onApprove = vi.fn();
      const onReject = vi.fn();
      server.use(
        approveMemberRegistrationHandler({ onCall: onApprove }),
        rejectMemberRegistrationHandler({ onCall: onReject }),
      );
      const { onClose } = await renderReadyDialog();

      await user.click(backButton());
      expect(onClose).toHaveBeenCalledTimes(1);
      await user.click(closeButton());
      expect(onClose).toHaveBeenCalledTimes(2);
      await user.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledTimes(3);

      expect(onApprove).not.toHaveBeenCalled();
      expect(onReject).not.toHaveBeenCalled();
    });

    it("does not approve or reject with Enter in a field", async () => {
      const user = userEvent.setup();
      const onApprove = vi.fn();
      server.use(approveMemberRegistrationHandler({ onCall: onApprove }));
      await renderReadyDialog();

      await user.type(mainFunctionField(), "Monitoria em sala{Enter}");

      expect(onApprove).not.toHaveBeenCalled();
    });
  });

  describe("loading the registration", () => {
    it("shows the loading state with only Voltar", async () => {
      const deferred = createDeferred();
      await renderDialog({ registration: { delay: deferred.promise } });

      expect(await screen.findByRole("status")).toHaveTextContent("Carregando cadastro…");
      expect(backButton()).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Recusar" })).not.toBeInTheDocument();

      deferred.resolve();
      await screen.findByRole("textbox", { name: /Função principal/ });
      expect(screen.queryByText("Carregando cadastro…")).not.toBeInTheDocument();
    });

    it("explains a registration that does not exist, with only Voltar", async () => {
      await renderDialog({
        registration: { error: reviewError(404, "MEMBER_REGISTRATION_NOT_FOUND") },
      });

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Cadastro não encontrado. Ele pode ter sido removido.",
      );
      expect(backButton()).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();
    });

    it("offers to try again when the registration cannot be loaded", async () => {
      const user = userEvent.setup();
      await renderDialog({ registration: { error: reviewError(500, "INTERNAL_SERVER_ERROR") } });
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar o cadastro. Verifique a sua conexão e tente de novo.",
      );
      expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();

      server.use(getMemberRegistrationHandler());
      await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

      expect(await screen.findByRole("textbox", { name: /Função principal/ })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("closes from Voltar while it loads", async () => {
      const user = userEvent.setup();
      const deferred = createDeferred();
      const { onClose } = await renderDialog({ registration: { delay: deferred.promise } });
      await screen.findByRole("status");

      await user.click(backButton());

      expect(onClose).toHaveBeenCalledTimes(1);
      deferred.resolve();
    });
  });

  describe("a registration that was already decided", () => {
    it.each([
      [MemberRegistrationStatus.approved, "Este cadastro já foi aprovado."],
      [MemberRegistrationStatus.rejected, "Este cadastro já foi recusado."],
    ])("shows a %s registration for reading, with no actions", async (status, message) => {
      const registration = buildMemberRegistration({ registrationStatus: status });
      await renderDialog({ registration: { registration } });

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(valueOf("Nome completo")).toBe("Lucas Andrade Souza");
      expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Recusar" })).not.toBeInTheDocument();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(screen.queryByText("A validar")).not.toBeInTheDocument();
      expect(backButton()).toBeInTheDocument();
    });

    it("turns into the decided view when the cached registration is replaced by the answer", async () => {
      const user = userEvent.setup();
      server.use(approveMemberRegistrationHandler());
      const { onClose } = await renderReadyDialog();

      await user.type(mainFunctionField(), "Monitoria em sala");
      await user.click(approveButton());

      // O onClose do teste não desmonta o diálogo: a resposta no cache o deixa em modo leitura.
      expect(await screen.findByText("Este cadastro já foi aprovado.")).toBeInTheDocument();
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();
    });
  });

  describe("the registration of the response", () => {
    it("uses the answer of the back in the toast, not what was typed", async () => {
      const user = userEvent.setup();
      server.use(
        approveMemberRegistrationHandler({
          response: buildApprovedRegistration(REGISTRATION_ID, {
            role: Role.coordinator,
            departmentId: null,
            mainFunction: "Coordenação geral",
            joinedAt: "2026-09-18",
          }),
        }),
      );
      await renderReadyDialog();

      await user.type(mainFunctionField(), "Monitoria em sala");
      await user.click(approveButton());

      expect(
        await screen.findByText(
          /agora tem acesso como Coordenadora e já pode entrar com o RA 202600117\./,
        ),
      ).toBeInTheDocument();
    });
  });
});
