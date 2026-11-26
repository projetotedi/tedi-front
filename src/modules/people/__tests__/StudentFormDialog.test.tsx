import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccessibilityNeed } from "@api/generated/model";
import {
  renderWithProviders,
  server,
  setupAuthTestServer,
} from "@modules/auth/__tests__/test-utils";

import { StudentFormDialog } from "../components/StudentFormDialog";
// Registers the "people" namespace.
import "../index";
import {
  buildStudentDetail,
  createStudentHandler,
  getStudentHandler,
  STUDENT_ID,
  updateStudentHandler,
} from "./handlers";

setupAuthTestServer();

type User = ReturnType<typeof userEvent.setup>;

afterEach(() => {
  vi.restoreAllMocks();
});

const nameField = () => screen.getByRole("textbox", { name: /Nome completo/ });
const phoneField = () => screen.getByRole("textbox", { name: /^Telefone$/ });
const emailField = () => screen.getByRole("textbox", { name: /E-mail/ });
const birthDateGroup = () => screen.getByRole("group", { name: /Data de nascimento/ });

async function typeBirthDate(user: User, digits: string) {
  await user.click(within(birthDateGroup()).getAllByRole("spinbutton")[0]);
  await user.keyboard(digits);
}

function mockMobile() {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        matches: query.includes("max-width"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

async function renderCreate() {
  const onClose = vi.fn();
  const view = await renderWithProviders(<StudentFormDialog mode="create" onClose={onClose} />);
  await screen.findByRole("dialog", { name: "Novo aluno" });
  return { ...view, onClose };
}

describe("StudentFormDialog", () => {
  describe("Novo aluno", () => {
    it("does not send without the name and the birth date, and shows the error on each field", async () => {
      const user = userEvent.setup();
      const onCall = vi.fn();
      server.use(createStudentHandler({ onCall }));
      await renderCreate();

      await user.click(screen.getByRole("button", { name: "Salvar aluno" }));

      expect(await screen.findByText("Informe o nome completo.")).toBeInTheDocument();
      expect(screen.getByText("Informe a data de nascimento.")).toBeInTheDocument();
      expect(nameField()).toHaveFocus();
      expect(onCall).not.toHaveBeenCalled();
    });

    it("shows the age beside the birth date", async () => {
      const user = userEvent.setup();
      await renderCreate();

      await typeBirthDate(user, "14031959");

      expect(await screen.findByText(/\d+ anos/)).toBeInTheDocument();
    });

    it("masks the phone and sends it in digits, the empty fields as null, and closes with the toast", async () => {
      const user = userEvent.setup();
      const onCall = vi.fn();
      server.use(createStudentHandler({ onCall }));
      const { onClose } = await renderCreate();

      await user.type(nameField(), "  Maria da Silva Santos ");
      await typeBirthDate(user, "14031959");
      await user.type(phoneField(), "11988881234");
      expect(phoneField()).toHaveValue("(11) 98888-1234");
      await user.click(screen.getByRole("button", { name: "Salvar aluno" }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(onCall).toHaveBeenCalledWith({
        body: {
          name: "Maria da Silva Santos",
          birthDate: "1959-03-14",
          phone: "11988881234",
          email: null,
          education: null,
          hasSmartphone: null,
          hasComputer: null,
          howFoundUs: null,
          emergencyContactName: null,
          emergencyContactPhone: null,
          accessibilityNeed: AccessibilityNeed.none,
          supportResource: null,
          classNeeds: null,
        },
      });
      expect(await screen.findByText("Aluno cadastrado")).toBeInTheDocument();
    });

    it("shows the e-mail taken on the field (409 EMAIL_ALREADY_IN_USE)", async () => {
      const user = userEvent.setup();
      server.use(
        createStudentHandler({ error: { statusCode: 409, error: "EMAIL_ALREADY_IN_USE" } }),
      );
      const { onClose } = await renderCreate();

      await user.type(nameField(), "Maria");
      await typeBirthDate(user, "14031959");
      await user.type(emailField(), "maria@example.com");
      await user.click(screen.getByRole("button", { name: "Salvar aluno" }));

      expect(
        await screen.findByText("Este e-mail já está em uso por outra pessoa."),
      ).toBeInTheDocument();
      expect(emailField()).toHaveFocus();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("has the hint not to write a diagnosis", async () => {
      await renderCreate();

      expect(
        screen.getByText("Registre a necessidade em aula, nunca o diagnóstico."),
      ).toBeInTheDocument();
    });

    it("takes the whole screen on the phone, with titled groups and only Salvar aluno", async () => {
      mockMobile();
      await renderCreate();

      const dialog = screen.getByRole("dialog", { name: "Novo aluno" });
      for (const name of ["Dados pessoais", "Uso de tecnologia", "Contato de emergência"]) {
        expect(within(dialog).getByRole("group", { name })).toBeInTheDocument();
      }
      expect(
        within(dialog).getByRole("radiogroup", { name: "Tem smartphone" }),
      ).toBeInTheDocument();
      expect(within(dialog).queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Salvar aluno" })).toBeInTheDocument();
    });
  });

  describe("Editar dados do aluno", () => {
    async function renderEdit() {
      const onClose = vi.fn();
      const onCall = vi.fn();
      server.use(getStudentHandler(), updateStudentHandler({ onCall }));
      await renderWithProviders(
        <StudentFormDialog mode="edit" studentId={STUDENT_ID} onClose={onClose} />,
      );
      await screen.findByRole("dialog", { name: "Editar dados do aluno" });
      await waitFor(() => expect(nameField()).toHaveValue(buildStudentDetail().name));
      return { onClose, onCall };
    }

    it("opens filled in, with the phone masked", async () => {
      await renderEdit();

      expect(phoneField()).toHaveValue("(11) 98765-4321");
      expect(emailField()).toHaveValue("maria.santos@example.com");
    });

    it("sends only what changed", async () => {
      const user = userEvent.setup();
      const { onClose, onCall } = await renderEdit();

      await user.clear(emailField());
      await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(onCall).toHaveBeenCalledWith({ id: STUDENT_ID, body: { email: null } });
      expect(await screen.findByText("Dados do aluno atualizados")).toBeInTheDocument();
    });

    it("makes no request when nothing changed", async () => {
      const user = userEvent.setup();
      const { onClose, onCall } = await renderEdit();

      await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(onCall).not.toHaveBeenCalled();
    });
  });
});
