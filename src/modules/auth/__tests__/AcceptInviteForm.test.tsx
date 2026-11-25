import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AcceptInviteDto } from "@api/generated/model";

import { SLOW_NOTICE_DELAY_MS } from "../hooks/useSlowRequestNotice";
import {
  acceptInviteHandler,
  buildInvite,
  DEPARTMENTS,
  getInviteHandler,
  meHandler,
  validationFailed,
} from "./handlers";
import {
  academicHeading,
  addressField,
  backButton,
  birthDateField,
  chooseOption,
  cityField,
  classNameField,
  completeRegistration,
  confirmationField,
  continueButton,
  courseField,
  cpfField,
  createDeferred,
  departmentTrigger,
  fillAcademicStep,
  fillPasswords,
  fillPersonalStep,
  goToPasswordStep,
  goToPersonalStep,
  institutionalEmailField,
  nameField,
  NAME,
  NO_BREAK_SPACE,
  openAccessInvite,
  passwordField,
  passwordHeading,
  pasteInto,
  PASSWORD,
  personalEmailField,
  personalHeading,
  phoneField,
  RA,
  raField,
  REGISTRATION,
  semesterField,
  stateTrigger,
  submitButton,
  volunteerTermUrlField,
} from "./invite-page-utils";
import { server, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

const SLOW_NOTICE = "Conectando ao servidor, isso pode levar até um minuto";
const SENT_TITLE = "Cadastro enviado!";
const CPF_INVALID = "Informe um CPF válido, com 11 números";
const BIRTH_DATE_INVALID = "Informe uma data de nascimento válida, entre 01/01/1900 e hoje";

const summaryStrip = () =>
  screen.getByText(
    (_content, element) => element?.tagName === "P" && element.textContent?.includes(NAME) === true,
  );

const invalid = (field: HTMLElement) => expect(field).toHaveAttribute("aria-invalid", "true");
const notInvalid = (field: HTMLElement) =>
  expect(field).not.toHaveAttribute("aria-invalid", "true");

/** Os campos de texto são inputs: o cursor (selectionStart) só existe neles. */
function asInput(element: HTMLElement) {
  return element as HTMLInputElement;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("AcceptInviteForm academic step", () => {
  it("validates only the fields of the current step", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    await user.click(continueButton());

    expect(await screen.findByText("Informe o seu RA")).toBeInTheDocument();
    expect(screen.getByText("Informe o seu e-mail institucional")).toBeInTheDocument();
    expect(screen.getByText("Informe o seu curso")).toBeInTheDocument();
    expect(screen.getByText("Informe o seu período")).toBeInTheDocument();
    expect(screen.getByText("Informe a sua turma")).toBeInTheDocument();
    expect(screen.queryByText("Informe o seu nome completo")).not.toBeInTheDocument();
    expect(screen.queryByText("Informe o seu CPF")).not.toBeInTheDocument();
    for (const field of [
      raField(),
      institutionalEmailField(),
      courseField(),
      semesterField(),
      classNameField(),
    ]) {
      invalid(field);
    }
    notInvalid(volunteerTermUrlField());
    expect(raField()).toHaveAccessibleDescription("Informe o seu RA");
    await waitFor(() => expect(raField()).toHaveFocus());
    expect(screen.getByRole("list", { name: "Etapa 1 de 3" })).toBeVisible();
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    ["ra", raField, "Informe o seu RA"],
    ["institutionalEmail", institutionalEmailField, "Informe o seu e-mail institucional"],
    ["course", courseField, "Informe o seu curso"],
    ["semester", semesterField, "Informe o seu período"],
    ["className", classNameField, "Informe a sua turma"],
  ] as const)(
    "does not advance from the academic step while the %s is empty",
    async (key, field, message) => {
      const user = userEvent.setup();
      let posts = 0;
      server.use(
        meHandler({ user: null }),
        getInviteHandler(),
        acceptInviteHandler({ onCall: () => (posts += 1) }),
      );
      await openAccessInvite();

      await fillAcademicStep(user, { [key]: "" });
      await user.click(continueButton());

      expect(await screen.findByText(message)).toBeInTheDocument();
      invalid(field());
      expect(field()).toHaveAccessibleDescription(message);
      await waitFor(() => expect(field()).toHaveFocus());
      expect(screen.getByRole("list", { name: "Etapa 1 de 3" })).toBeVisible();
      expect(
        screen.queryByRole("heading", { level: 2, name: "Dados pessoais" }),
      ).not.toBeInTheDocument();
      expect(posts).toBe(0);
    },
  );

  it.each(["lucas", "lucas@", "lucas@instituicao"])(
    "rejects the institutional e-mail %j and keeps the person on the academic step",
    async (email) => {
      const user = userEvent.setup();
      server.use(meHandler({ user: null }), getInviteHandler());
      await openAccessInvite();

      await fillAcademicStep(user, { institutionalEmail: email });
      await user.click(continueButton());

      expect(await screen.findByText("Informe um e-mail institucional válido")).toBeInTheDocument();
      invalid(institutionalEmailField());
      notInvalid(raField());
      await waitFor(() => expect(institutionalEmailField()).toHaveFocus());
      expect(screen.queryByLabelText("Nome completo")).not.toBeInTheDocument();
    },
  );

  it.each(["0", "21", "abc", "3.5", "-1"])(
    "rejects the semester %j with the range message",
    async (semester) => {
      const user = userEvent.setup();
      server.use(meHandler({ user: null }), getInviteHandler());
      await openAccessInvite();

      await fillAcademicStep(user, { semester });
      await user.click(continueButton());

      expect(await screen.findByText("Informe um período de 1 a 20")).toBeInTheDocument();
      invalid(semesterField());
      await waitFor(() => expect(semesterField()).toHaveFocus());
    },
  );

  it.each(["1", "20"])("accepts the semester %s, the ends of the range", async (semester) => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    await goToPersonalStep(user, { semester });

    expect(screen.queryByLabelText("Período")).not.toBeInTheDocument();
  });

  it("explains the range of the semester and asks for a number", async () => {
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    expect(semesterField()).toHaveAccessibleDescription("Use um número de 1 a 20.");
    expect(semesterField()).toHaveAttribute("inputmode", "numeric");
  });

  it.each(["http://drive.google.com/file/d/termo/view", "drive.google.com/file/d/termo/view"])(
    "rejects the volunteer term link %j: only https is accepted",
    async (link) => {
      const user = userEvent.setup();
      server.use(meHandler({ user: null }), getInviteHandler());
      await openAccessInvite();

      await fillAcademicStep(user, { volunteerTermUrl: link });
      await user.click(continueButton());

      expect(
        await screen.findByText("Informe um link que comece com https://"),
      ).toBeInTheDocument();
      invalid(volunteerTermUrlField());
      await waitFor(() => expect(volunteerTermUrlField()).toHaveFocus());
    },
  );

  it("takes the volunteer term as optional and explains what is stored", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    expect(volunteerTermUrlField()).toHaveAccessibleDescription(
      "Link do Google Drive com o termo assinado. O sistema guarda só o link.",
    );

    await goToPersonalStep(user);

    expect(screen.queryByText("Informe um link que comece com https://")).not.toBeInTheDocument();
  });

  it("clears an error as soon as the field is fixed, without pressing Continue again", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await user.click(continueButton());
    await screen.findByText("Informe o seu RA");

    await pasteInto(user, raField(), RA);

    await waitFor(() => notInvalid(raField()));
    expect(screen.queryByText("Informe o seu RA")).not.toBeInTheDocument();
    invalid(institutionalEmailField());
  });

  it("advances to the personal step with Enter instead of sending the registration", async () => {
    const user = userEvent.setup();
    let posts = 0;
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ onCall: () => (posts += 1) }),
    );
    await openAccessInvite();

    await fillAcademicStep(user);
    await user.type(classNameField(), "{Enter}");

    expect(await screen.findByRole("heading", { level: 2, name: "Dados pessoais" })).toBeVisible();
    expect(posts).toBe(0);
  });

  it("does not advance with Enter while the academic step is invalid", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    await user.type(raField(), `${RA}{Enter}`);

    expect(await screen.findByText("Informe o seu e-mail institucional")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 2, name: "Dados pessoais" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
  });
});

describe("AcceptInviteForm department", () => {
  it("offers the departments of the invite after the option to leave it out", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ invite: buildInvite({ departments: DEPARTMENTS }) }),
    );
    await openAccessInvite();

    expect(departmentTrigger()).toBeVisible();
    expect(departmentTrigger()).toHaveTextContent("Selecione o departamento");

    await user.click(departmentTrigger());

    const options = within(await screen.findByRole("listbox")).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Não informar",
      "Pedagogia",
      "Tecnologia",
    ]);
  });

  it("is optional: the person can go on without choosing one", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ invite: buildInvite({ departments: DEPARTMENTS }) }),
    );
    await openAccessInvite();

    await goToPersonalStep(user);

    expect(screen.queryByText("Escolha um departamento da lista")).not.toBeInTheDocument();
  });

  it("shows the chosen department on the trigger and keeps it when going back", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ invite: buildInvite({ departments: DEPARTMENTS }) }),
    );
    await openAccessInvite();

    await chooseOption(user, departmentTrigger(), "Tecnologia");

    expect(departmentTrigger()).toHaveTextContent("Tecnologia");

    await goToPersonalStep(user);
    await user.click(backButton());
    await academicHeading();

    expect(departmentTrigger()).toHaveTextContent("Tecnologia");
  });

  it("goes back to no department with the option 'Não informar', and does not send one", async () => {
    const user = userEvent.setup();
    const accepted: AcceptInviteDto[] = [];
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ invite: buildInvite({ departments: DEPARTMENTS }) }),
      acceptInviteHandler({ onCall: (body) => accepted.push(body) }),
    );
    await openAccessInvite();

    await chooseOption(user, departmentTrigger(), "Tecnologia");
    await chooseOption(user, departmentTrigger(), "Não informar");

    expect(departmentTrigger()).toHaveTextContent("Selecione o departamento");

    await goToPersonalStep(user);
    await fillPersonalStep(user);
    await user.click(continueButton());
    await passwordHeading();
    await fillPasswords(user);
    await user.click(submitButton());

    await screen.findByRole("heading", { name: SENT_TITLE });
    expect(accepted).toHaveLength(1);
    expect(accepted[0].registration).not.toHaveProperty("departmentId");
  });

  it("hides the field when the invite offers no department", async () => {
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ invite: buildInvite({ departments: [] }) }),
    );
    await openAccessInvite();

    expect(screen.queryByRole("button", { name: /Departamento/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Departamento")).not.toBeInTheDocument();
    expect(courseField()).toBeVisible();
  });

  it("finishes a registration without department when the invite offers none", async () => {
    const user = userEvent.setup();
    const accepted: AcceptInviteDto[] = [];
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ invite: buildInvite({ departments: [] }) }),
      acceptInviteHandler({ onCall: (body) => accepted.push(body) }),
    );
    await openAccessInvite();

    await completeRegistration(user);

    await screen.findByRole("heading", { name: SENT_TITLE });
    expect(accepted[0].registration).not.toHaveProperty("departmentId");
  });
});

describe("AcceptInviteForm personal step", () => {
  it("shows the personal fields, with only the contract's required ones marked", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    await goToPersonalStep(user);

    expect(screen.getByRole("heading", { level: 2, name: "Dados pessoais" })).toBeVisible();
    expect(
      screen.getByText(
        "Etapa 2 de 3 · Agora, seus dados pessoais. A coordenação confere o cadastro antes de liberar o acesso.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("list", { name: "Etapa 2 de 3" })).toBeVisible();
    for (const field of [
      nameField(),
      birthDateField(),
      cpfField(),
      phoneField(),
      personalEmailField(),
    ]) {
      expect(field).toBeVisible();
      expect(field).toBeRequired();
    }
    for (const field of [addressField(), cityField()]) {
      expect(field).toBeVisible();
      expect(field).not.toBeRequired();
    }
    expect(stateTrigger()).toBeVisible();
    expect(birthDateField()).toHaveAttribute("type", "date");
    expect(personalEmailField()).toHaveAttribute("type", "email");
    expect(cpfField()).toHaveAttribute("placeholder", "456.789.123-00");
    expect(phoneField()).toHaveAttribute("placeholder", "(11) 98123-4567");
    expect(screen.getByText("* Campos obrigatórios")).toBeVisible();
    expect(backButton()).toBeVisible();
    expect(continueButton()).toBeVisible();
    expect(screen.queryByLabelText("RA")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("E-mail institucional")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
  });

  it("arrives at the personal step without an error on the fields that were still empty", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    await goToPersonalStep(user);

    for (const field of [nameField(), birthDateField(), cpfField(), phoneField()]) {
      notInvalid(field);
    }
    expect(screen.queryByText("Informe o seu nome completo")).not.toBeInTheDocument();
  });

  it("validates only the fields of the personal step and focuses the first", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPersonalStep(user);

    await user.click(continueButton());

    expect(await screen.findByText("Informe o seu nome completo")).toBeInTheDocument();
    expect(screen.getByText("Informe a sua data de nascimento")).toBeInTheDocument();
    expect(screen.getByText("Informe o seu CPF")).toBeInTheDocument();
    expect(screen.getByText("Informe o seu telefone")).toBeInTheDocument();
    expect(screen.getByText("Informe o seu e-mail pessoal")).toBeInTheDocument();
    for (const field of [
      nameField(),
      birthDateField(),
      cpfField(),
      phoneField(),
      personalEmailField(),
    ]) {
      invalid(field);
    }
    for (const field of [addressField(), cityField()]) notInvalid(field);
    await waitFor(() => expect(nameField()).toHaveFocus());
    expect(screen.getByRole("list", { name: "Etapa 2 de 3" })).toBeVisible();
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
  });

  it.each(["", "   "])(
    "does not advance from the personal step while the name is empty or only spaces (%j)",
    async (name) => {
      const user = userEvent.setup();
      let posts = 0;
      server.use(
        meHandler({ user: null }),
        getInviteHandler(),
        acceptInviteHandler({ onCall: () => (posts += 1) }),
      );
      await openAccessInvite();
      await goToPersonalStep(user);

      await fillPersonalStep(user, { name: "" });
      if (name) await pasteInto(user, nameField(), name);
      await user.click(continueButton());

      expect(await screen.findByText("Informe o seu nome completo")).toBeInTheDocument();
      invalid(nameField());
      expect(nameField()).toHaveAccessibleDescription("Informe o seu nome completo");
      await waitFor(() => expect(nameField()).toHaveFocus());
      expect(screen.getByRole("list", { name: "Etapa 2 de 3" })).toBeVisible();
      expect(posts).toBe(0);
    },
  );

  it("clears the name error as soon as the name is typed", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPersonalStep(user);
    await user.click(continueButton());
    await screen.findByText("Informe o seu nome completo");

    await pasteInto(user, nameField(), NAME);

    await waitFor(() => notInvalid(nameField()));
    expect(screen.queryByText("Informe o seu nome completo")).not.toBeInTheDocument();
  });

  it.each(["lucas", "lucas@", "lucas@example"])("rejects the personal e-mail %j", async (email) => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPersonalStep(user);

    await fillPersonalStep(user, { personalEmail: email });
    await user.click(continueButton());

    expect(await screen.findByText("Informe um e-mail pessoal válido")).toBeInTheDocument();
    invalid(personalEmailField());
    await waitFor(() => expect(personalEmailField()).toHaveFocus());
    expect(screen.getByRole("list", { name: "Etapa 2 de 3" })).toBeVisible();
  });

  it.each(["2999-01-01", "1899-12-31"])(
    "rejects the birth date %s, out of the range the API accepts",
    async (birthDate) => {
      const user = userEvent.setup();
      server.use(meHandler({ user: null }), getInviteHandler());
      await openAccessInvite();
      await goToPersonalStep(user);

      await fillPersonalStep(user, { birthDate });
      await user.click(continueButton());

      expect(await screen.findByText(BIRTH_DATE_INVALID)).toBeInTheDocument();
      invalid(birthDateField());
      await waitFor(() => expect(birthDateField()).toHaveFocus());
      expect(screen.getByRole("list", { name: "Etapa 2 de 3" })).toBeVisible();
    },
  );

  it("takes address, city and state as optional", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPersonalStep(user);

    await fillPersonalStep(user);
    await user.click(continueButton());

    await passwordHeading();
  });

  it("lists the 27 states after the option to leave it out, and shows the chosen one", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPersonalStep(user);

    expect(stateTrigger()).toHaveTextContent("Selecione o estado");

    await user.click(stateTrigger());
    const options = within(await screen.findByRole("listbox")).getAllByRole("option");

    expect(options).toHaveLength(28);
    expect(options[0]).toHaveTextContent("Não informar");
    expect(options[1]).toHaveTextContent("AC");
    expect(options[27]).toHaveTextContent("TO");
    const codes = options.slice(1).map((option) => option.textContent);
    expect(codes).toEqual([...codes].sort());
    expect(codes.slice(0, 4)).toEqual(["AC", "AL", "AM", "AP"]);

    await user.click(screen.getByRole("option", { name: "SP" }));

    expect(stateTrigger()).toHaveTextContent("SP");
  });

  it("rejects text longer than the contract allows for the optional fields", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPersonalStep(user);

    await fillPersonalStep(user, { address: "a".repeat(201), city: "c".repeat(101) });
    await user.click(continueButton());

    expect(
      await screen.findByText("O endereço deve ter no máximo 200 caracteres"),
    ).toBeInTheDocument();
    expect(screen.getByText("A cidade deve ter no máximo 100 caracteres")).toBeInTheDocument();
    invalid(addressField());
    invalid(cityField());
    await waitFor(() => expect(addressField()).toHaveFocus());
  });
});

describe("AcceptInviteForm CPF and phone", () => {
  it("applies the CPF mask while the digits are typed", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPersonalStep(user);

    await user.click(cpfField());
    await user.keyboard("5299");
    expect(cpfField()).toHaveValue("529.9");

    await user.keyboard("82247");
    expect(cpfField()).toHaveValue("529.982.247");

    await user.keyboard("25");
    expect(cpfField()).toHaveValue("529.982.247-25");
  });

  it("takes a pasted CPF with or without punctuation and stops at 11 digits", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPersonalStep(user);

    await pasteInto(user, cpfField(), "52998224725");
    expect(cpfField()).toHaveValue("529.982.247-25");

    await user.clear(cpfField());
    await pasteInto(user, cpfField(), " 529.982.247-25 ");
    expect(cpfField()).toHaveValue("529.982.247-25");

    await user.type(cpfField(), "9999");
    expect(cpfField()).toHaveValue("529.982.247-25");
  });

  it("ignores letters typed in the CPF and in the phone", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPersonalStep(user);

    await user.type(cpfField(), "a5b2c");
    await user.type(phoneField(), "x1y1z");

    expect(cpfField()).toHaveValue("52");
    expect(phoneField()).toHaveValue("(11");
  });

  it("applies the phone mask to a mobile and to a landline number", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPersonalStep(user);

    await user.type(phoneField(), "1198123");
    expect(phoneField()).toHaveValue("(11) 9812-3");

    await user.type(phoneField(), "4567");
    expect(phoneField()).toHaveValue("(11) 98123-4567");

    await user.clear(phoneField());
    await user.type(phoneField(), "1123456789");
    expect(phoneField()).toHaveValue("(11) 2345-6789");
  });

  it("reads a pasted number with the Brazil country code as a national number", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPersonalStep(user);

    await pasteInto(user, phoneField(), "+55 11 98123-4567");

    expect(phoneField()).toHaveValue("(11) 98123-4567");
  });

  it("keeps the area code 55 when one more digit is typed, and sends that phone to the API", async () => {
    const user = userEvent.setup();
    const accepted: AcceptInviteDto[] = [];
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ onCall: (body) => accepted.push(body) }),
    );
    await openAccessInvite();
    await goToPersonalStep(user);
    await fillPersonalStep(user, { phone: "55991234567" });
    expect(phoneField()).toHaveValue("(55) 99123-4567");

    // Um dígito a mais no fim: o excesso é descartado e o 55 continua sendo o DDD, não o DDI.
    await user.type(phoneField(), "8");

    expect(phoneField()).toHaveValue("(55) 99123-4567");

    await user.click(continueButton());
    await passwordHeading();
    await fillPasswords(user);
    await user.click(submitButton());

    await screen.findByRole("heading", { name: SENT_TITLE });
    expect(accepted).toHaveLength(1);
    expect(accepted[0].registration?.phone).toBe("55991234567");
  });

  it("keeps the area code 55 and the cursor when the extra digit is typed in the middle", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPersonalStep(user);
    await pasteInto(user, phoneField(), "55991234567");

    await user.type(phoneField(), "8", { initialSelectionStart: 7, initialSelectionEnd: 7 });

    expect(phoneField()).toHaveValue("(55) 99812-3456");
    expect(asInput(phoneField()).selectionStart).toBe(8);
  });

  it.each(["+55 55 99123-4567", "5555991234567"])(
    "reads the pasted %s as the phone with the area code 55",
    async (pasted) => {
      const user = userEvent.setup();
      server.use(meHandler({ user: null }), getInviteHandler());
      await openAccessInvite();
      await goToPersonalStep(user);

      await pasteInto(user, phoneField(), pasted);

      expect(phoneField()).toHaveValue("(55) 99123-4567");
    },
  );

  it("keeps the cursor after the digit being typed when the mask rewrites the CPF", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPersonalStep(user);
    await pasteInto(user, cpfField(), "52998224725");

    await user.type(cpfField(), "1", { initialSelectionStart: 3, initialSelectionEnd: 3 });

    expect(cpfField()).toHaveValue("529.198.224-72");
    expect(asInput(cpfField()).selectionStart).toBe(5);
    expect(asInput(cpfField()).selectionEnd).toBe(5);

    await user.keyboard("7");

    expect(cpfField()).toHaveValue("529.179.822-47");
    expect(asInput(cpfField()).selectionStart).toBe(6);
  });

  it("keeps the cursor in place when the mask rewrites the phone after a deletion", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPersonalStep(user);
    await pasteInto(user, phoneField(), "11981234567");

    // Apaga o "5" depois do hífen: o número passa a ter 10 dígitos e o hífen muda de lugar.
    await user.type(phoneField(), "{Backspace}", {
      initialSelectionStart: 13,
      initialSelectionEnd: 13,
    });

    expect(phoneField()).toHaveValue("(11) 9812-3467");
    expect(asInput(phoneField()).selectionStart).toBe(12);
  });

  it("does not reuse an old cursor position on the next keystroke after a rejected character", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPersonalStep(user);
    await user.type(cpfField(), "5299822");

    // Uma letra no meio é descartada pela máscara e o texto não muda.
    await user.type(cpfField(), "x", { initialSelectionStart: 3, initialSelectionEnd: 3 });
    expect(cpfField()).toHaveValue("529.982.2");

    // A pessoa volta ao fim e segue digitando: os dígitos têm de cair no fim.
    await user.type(cpfField(), "47");

    expect(cpfField()).toHaveValue("529.982.247");
    expect(asInput(cpfField()).selectionStart).toBe("529.982.247".length);
  });

  it("does not move the cursor when the person types at the end", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPersonalStep(user);

    await user.type(cpfField(), "5299822");

    expect(cpfField()).toHaveValue("529.982.2");
    expect(asInput(cpfField()).selectionStart).toBe("529.982.2".length);
  });

  it("does not send while the CPF has 10 digits", async () => {
    const user = userEvent.setup();
    let posts = 0;
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ onCall: () => (posts += 1) }),
    );
    await openAccessInvite();
    await goToPersonalStep(user);

    await fillPersonalStep(user, { cpf: "5299822472" });
    await user.click(continueButton());

    expect(await screen.findByText(CPF_INVALID)).toBeInTheDocument();
    expect(cpfField()).toHaveValue("529.982.247-2");
    invalid(cpfField());
    expect(cpfField()).toHaveAccessibleDescription(CPF_INVALID);
    await waitFor(() => expect(cpfField()).toHaveFocus());
    expect(screen.getByRole("list", { name: "Etapa 2 de 3" })).toBeVisible();
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    expect(posts).toBe(0);
  });

  it.each([
    ["with a wrong check digit", "52998224726"],
    ["with repeated digits", "11111111111"],
    ["with zeros", "00000000000"],
  ])("rejects a CPF %s", async (_label, cpf) => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPersonalStep(user);

    await fillPersonalStep(user, { cpf });
    await user.click(continueButton());

    expect(await screen.findByText(CPF_INVALID)).toBeInTheDocument();
    invalid(cpfField());
    expect(screen.getByRole("list", { name: "Etapa 2 de 3" })).toBeVisible();
  });

  it("clears the CPF error when the last digit is fixed", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPersonalStep(user);
    await fillPersonalStep(user, { cpf: "5299822472" });
    await user.click(continueButton());
    await screen.findByText(CPF_INVALID);

    await user.type(cpfField(), "5");

    await waitFor(() => notInvalid(cpfField()));
    expect(screen.queryByText(CPF_INVALID)).not.toBeInTheDocument();
  });

  it("rejects a phone with fewer than 10 digits", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPersonalStep(user);

    await fillPersonalStep(user, { phone: "119812345" });
    await user.click(continueButton());

    expect(
      await screen.findByText("Informe o telefone com DDD, com 10 ou 11 números"),
    ).toBeInTheDocument();
    invalid(phoneField());
    await waitFor(() => expect(phoneField()).toHaveFocus());
    expect(screen.getByRole("list", { name: "Etapa 2 de 3" })).toBeVisible();
  });

  it("cuts the digits that do not fit, so a longer number is still a valid phone", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPersonalStep(user);

    await fillPersonalStep(user, { phone: "1198123456789" });

    expect(phoneField()).toHaveValue("(11) 98123-4567");

    await user.click(continueButton());

    await passwordHeading();
  });

  it("accepts a landline with 10 digits", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPersonalStep(user);

    await fillPersonalStep(user, { phone: "1123456789" });
    await user.click(continueButton());

    await passwordHeading();
  });

  it("sends the CPF and the phone with only their digits", async () => {
    const user = userEvent.setup();
    const accepted: AcceptInviteDto[] = [];
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ onCall: (body) => accepted.push(body) }),
    );
    await openAccessInvite();

    await completeRegistration(user);

    await screen.findByRole("heading", { name: SENT_TITLE });
    expect(accepted[0].registration?.cpf).toBe("52998224725");
    expect(accepted[0].registration?.phone).toBe("11981234567");
  });
});

describe("AcceptInviteForm password step", () => {
  it("shows the typed name and RA above the password fields", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    await goToPasswordStep(user);

    const summary = summaryStrip();
    const heading = screen.getByRole("heading", { level: 2, name: "Crie sua senha" });
    expect(summary).toHaveTextContent(
      `${NAME} · RA ${RA} — é com este RA e a senha abaixo que você entra no sistema.`,
    );
    expect(summary.textContent).toContain(`RA${NO_BREAK_SPACE}${RA}`);
    expect(
      summary.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(heading).toHaveAccessibleDescription(expect.stringContaining(`${NAME} · RA`));
    expect(
      screen.getByText(
        "Etapa 3 de 3 · Último passo: crie a senha que você vai usar para entrar no sistema.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("list", { name: "Etapa 3 de 3" })).toBeVisible();
    expect(passwordField()).toHaveAccessibleDescription("Mínimo de 8 caracteres.");
    expect(confirmationField()).toHaveAccessibleDescription("Digite a mesma senha de novo.");
    expect(passwordField()).toBeRequired();
    expect(confirmationField()).toBeRequired();
    notInvalid(passwordField());
    expect(backButton()).toBeVisible();
    expect(submitButton()).toBeVisible();
    expect(screen.queryByLabelText("Nome completo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("RA")).not.toBeInTheDocument();
  });

  it("does not call the API when the password is too short", async () => {
    const user = userEvent.setup();
    let posts = 0;
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ onCall: () => (posts += 1) }),
    );
    await openAccessInvite();
    await goToPasswordStep(user);

    await fillPasswords(user, "1234567");
    await user.click(submitButton());

    expect(await screen.findByText("A senha deve ter no mínimo 8 caracteres")).toBeInTheDocument();
    invalid(passwordField());
    expect(passwordField()).toHaveAccessibleDescription("A senha deve ter no mínimo 8 caracteres");
    notInvalid(confirmationField());
    await waitFor(() => expect(passwordField()).toHaveFocus());
    expect(posts).toBe(0);
    expect(screen.queryByRole("heading", { name: SENT_TITLE })).not.toBeInTheDocument();
  });

  it("does not call the API when the confirmation does not match the password", async () => {
    const user = userEvent.setup();
    let posts = 0;
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ onCall: () => (posts += 1) }),
    );
    await openAccessInvite();
    await goToPasswordStep(user);

    await fillPasswords(user, "12345678", "12345679");
    await user.click(submitButton());

    expect(await screen.findByText("As senhas não são iguais")).toBeInTheDocument();
    invalid(confirmationField());
    expect(confirmationField()).toHaveAccessibleDescription("As senhas não são iguais");
    notInvalid(passwordField());
    await waitFor(() => expect(confirmationField()).toHaveFocus());
    expect(posts).toBe(0);
  });

  it("does not ask for privacy consent on the password step", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    await goToPasswordStep(user);

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/aviso de privacidade/)).not.toBeInTheDocument();
  });

  it("clears the mismatch error once the password is corrected to match", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPasswordStep(user);
    await fillPasswords(user, "12345678", "12345679");
    await user.click(submitButton());
    await screen.findByText("As senhas não são iguais");

    await user.clear(passwordField());
    await user.type(passwordField(), "12345679");

    await waitFor(() =>
      expect(screen.queryByText("As senhas não são iguais")).not.toBeInTheDocument(),
    );
    notInvalid(confirmationField());
  });

  it("shows and hides each password on its own eye button", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await goToPasswordStep(user);
    expect(passwordField()).toHaveAttribute("type", "password");
    expect(confirmationField()).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));

    expect(passwordField()).toHaveAttribute("type", "text");
    expect(confirmationField()).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Ocultar senha" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mostrar confirmação da senha" }));

    expect(confirmationField()).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "Ocultar confirmação da senha" }),
    ).toBeInTheDocument();
  });
});

describe("AcceptInviteForm going between the steps", () => {
  it("keeps every typed value when going from step 3 back to step 1 and forward again", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ invite: buildInvite({ departments: DEPARTMENTS }) }),
    );
    await openAccessInvite();
    await chooseOption(user, departmentTrigger(), "Pedagogia");
    await goToPersonalStep(user);
    await fillPersonalStep(user, { address: "Rua A, 1" });
    await chooseOption(user, stateTrigger(), "RJ");
    await user.click(continueButton());
    await passwordHeading();
    await fillPasswords(user);

    await user.click(backButton());

    expect(await screen.findByRole("list", { name: "Etapa 2 de 3" })).toBeVisible();
    expect(nameField()).toHaveValue(NAME);
    expect(birthDateField()).toHaveValue("1999-07-22");
    expect(cpfField()).toHaveValue("529.982.247-25");
    expect(phoneField()).toHaveValue("(11) 98123-4567");
    expect(personalEmailField()).toHaveValue("lucas@example.com");
    expect(addressField()).toHaveValue("Rua A, 1");
    expect(stateTrigger()).toHaveTextContent("RJ");
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();

    await user.click(backButton());

    expect(await screen.findByRole("list", { name: "Etapa 1 de 3" })).toBeVisible();
    expect(raField()).toHaveValue(RA);
    expect(institutionalEmailField()).toHaveValue(REGISTRATION.institutionalEmail);
    expect(courseField()).toHaveValue(REGISTRATION.course);
    expect(semesterField()).toHaveValue("3");
    expect(classNameField()).toHaveValue(REGISTRATION.className);
    expect(departmentTrigger()).toHaveTextContent("Pedagogia");

    await user.click(continueButton());
    await personalHeading();
    expect(nameField()).toHaveValue(NAME);

    await user.click(continueButton());
    await passwordHeading();
    expect(passwordField()).toHaveValue(PASSWORD);
    expect(confirmationField()).toHaveValue(PASSWORD);
  });

  it("moves focus to the step heading and announces each step change", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    const announcement = screen.getByRole("status");
    expect(announcement).toBeEmptyDOMElement();
    expect(announcement).toHaveAttribute("aria-live", "polite");
    expect(document.body).toHaveFocus();

    await goToPersonalStep(user);

    const personal = screen.getByRole("heading", { level: 2, name: "Dados pessoais" });
    await waitFor(() => expect(personal).toHaveFocus());
    expect(screen.getByText("Etapa 2 de 3: Dados pessoais")).toBe(announcement);

    await fillPersonalStep(user);
    await user.click(continueButton());

    const password = await passwordHeading();
    await waitFor(() => expect(password).toHaveFocus());
    expect(screen.getByText("Etapa 3 de 3: Crie sua senha")).toBe(announcement);

    await user.click(backButton());

    const personalAgain = await personalHeading();
    await waitFor(() => expect(personalAgain).toHaveFocus());
    expect(screen.getByText("Etapa 2 de 3: Dados pessoais")).toBe(announcement);
  });

  it("marks the finished steps as completed in the three-step stepper", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    const { container } = await openAccessInvite();
    const stepItems = () =>
      within(screen.getByRole("list", { name: /^Etapa \d de 3$/ })).getAllByRole("listitem");
    const circles = () =>
      Array.from(container.querySelectorAll("ol > li > span:first-child")).map(
        (circle) => circle.textContent,
      );

    expect(stepItems()).toHaveLength(3);
    expect(stepItems()[0]).toHaveTextContent("Dados acadêmicos");
    expect(stepItems()[1]).toHaveTextContent("Dados pessoais");
    expect(stepItems()[2]).toHaveTextContent("Crie sua senha");
    expect(circles()).toEqual(["1", "2", "3"]);
    expect(stepItems()[0]).toHaveAttribute("aria-current", "step");
    expect(screen.queryByText("concluída")).not.toBeInTheDocument();

    await goToPersonalStep(user);

    expect(circles()).toEqual(["✓", "2", "3"]);
    expect(stepItems()[0]).toHaveTextContent("concluída");
    expect(stepItems()[0]).not.toHaveAttribute("aria-current");
    expect(stepItems()[1]).toHaveAttribute("aria-current", "step");
    expect(stepItems()[1]).not.toHaveTextContent("concluída");

    await fillPersonalStep(user);
    await user.click(continueButton());
    await passwordHeading();

    expect(circles()).toEqual(["✓", "✓", "3"]);
    expect(stepItems()[0]).toHaveTextContent("concluída");
    expect(stepItems()[1]).toHaveTextContent("concluída");
    expect(stepItems()[1]).not.toHaveAttribute("aria-current");
    expect(stepItems()[2]).toHaveAttribute("aria-current", "step");
    expect(stepItems()[2]).not.toHaveTextContent("concluída");

    await user.click(backButton());
    await personalHeading();

    expect(circles()).toEqual(["✓", "2", "3"]);
  });

  it("does not validate the next step when Continue is double-clicked", async () => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();
    await fillAcademicStep(user);

    await user.dblClick(continueButton());

    await personalHeading();
    expect(screen.queryByText("Informe o seu nome completo")).not.toBeInTheDocument();
    notInvalid(nameField());
  });

  it("does not call the API while moving through steps 1 and 2, with Enter or Continue", async () => {
    const user = userEvent.setup();
    let posts = 0;
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ onCall: () => (posts += 1) }),
    );
    await openAccessInvite();

    await fillAcademicStep(user);
    await user.type(classNameField(), "{Enter}");
    await personalHeading();
    await fillPersonalStep(user);
    await user.type(personalEmailField(), "{Enter}");
    await passwordHeading();

    await user.click(backButton());
    await personalHeading();
    await user.click(backButton());
    await academicHeading();
    await user.click(continueButton());
    await personalHeading();
    await user.click(continueButton());
    await passwordHeading();

    expect(posts).toBe(0);
    expect(screen.queryByRole("heading", { name: SENT_TITLE })).not.toBeInTheDocument();
  });
});

describe("AcceptInviteForm errors from the API", () => {
  it("goes back to step 1 with the RA-in-use error and the focus on the RA field", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ error: { statusCode: 409, error: "RA_ALREADY_IN_USE" } }),
    );
    const { router } = await openAccessInvite();

    await completeRegistration(user);

    await waitFor(() => invalid(raField()));
    expect(raField()).toHaveAccessibleDescription("Este RA já está em uso");
    await waitFor(() => expect(raField()).toHaveFocus());
    expect(raField()).toHaveValue(RA);
    expect(institutionalEmailField()).toHaveValue(REGISTRATION.institutionalEmail);
    notInvalid(institutionalEmailField());
    expect(screen.getByRole("list", { name: "Etapa 1 de 3" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Dados acadêmicos" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: SENT_TITLE })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/invite");
    expect(raField()).toBeEnabled();
  });

  it("goes back to step 2 with the e-mail-in-use error on the personal e-mail", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ error: { statusCode: 409, error: "EMAIL_ALREADY_IN_USE" } }),
    );
    await openAccessInvite();

    await completeRegistration(user);

    await waitFor(() => invalid(personalEmailField()));
    expect(personalEmailField()).toHaveAccessibleDescription("Este e-mail pessoal já está em uso");
    await waitFor(() => expect(personalEmailField()).toHaveFocus());
    expect(screen.getByRole("list", { name: "Etapa 2 de 3" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Dados pessoais" })).toBeVisible();
    expect(personalEmailField()).toHaveValue(REGISTRATION.personalEmail);
    expect(nameField()).toHaveValue(NAME);
    notInvalid(nameField());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await user.click(continueButton());

    await passwordHeading();
    expect(passwordField()).toHaveValue(PASSWORD);
  });

  it("shows the 400 registration.cpf error on the CPF field, going back from step 3 to step 2", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ error: validationFailed("registration.cpf") }),
    );
    await openAccessInvite();

    await completeRegistration(user);

    await waitFor(() => invalid(cpfField()));
    expect(cpfField()).toHaveAccessibleDescription(CPF_INVALID);
    await waitFor(() => expect(cpfField()).toHaveFocus());
    expect(screen.getByRole("list", { name: "Etapa 2 de 3" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Dados pessoais" })).toBeVisible();
    expect(cpfField()).toHaveValue("529.982.247-25");
    notInvalid(nameField());
    notInvalid(phoneField());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: SENT_TITLE })).not.toBeInTheDocument();
  });

  it.each([
    ["registration.course", courseField, "Informe o seu curso"],
    ["registration.semester", semesterField, "Informe um período de 1 a 20"],
    ["registration.className", classNameField, "Informe a sua turma"],
    [
      "registration.institutionalEmail",
      institutionalEmailField,
      "Informe um e-mail institucional válido",
    ],
    [
      "registration.volunteerTermUrl",
      volunteerTermUrlField,
      "Informe um link que comece com https://",
    ],
    ["registration.ra", raField, "Informe o seu RA"],
  ])("shows the 400 %s error on its field of step 1", async (serverField, field, message) => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ error: validationFailed(serverField) }),
    );
    await openAccessInvite();

    await completeRegistration(user);

    await waitFor(() => invalid(field()));
    expect(field()).toHaveAccessibleDescription(message);
    await waitFor(() => expect(field()).toHaveFocus());
    expect(screen.getByRole("list", { name: "Etapa 1 de 3" })).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    ["registration.name", nameField, "Informe o seu nome completo"],
    ["registration.birthDate", birthDateField, BIRTH_DATE_INVALID],
    ["registration.phone", phoneField, "Informe o telefone com DDD, com 10 ou 11 números"],
    ["registration.personalEmail", personalEmailField, "Informe um e-mail pessoal válido"],
    ["registration.address", addressField, "O endereço deve ter no máximo 200 caracteres"],
    ["registration.city", cityField, "A cidade deve ter no máximo 100 caracteres"],
  ])("shows the 400 %s error on its field of step 2", async (serverField, field, message) => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ error: validationFailed(serverField) }),
    );
    await openAccessInvite();

    await completeRegistration(user);

    await waitFor(() => invalid(field()));
    expect(field()).toHaveAccessibleDescription(message);
    await waitFor(() => expect(field()).toHaveFocus());
    expect(screen.getByRole("list", { name: "Etapa 2 de 3" })).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the 400 registration.state error on the state field and focuses its button", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ error: validationFailed("registration.state") }),
    );
    await openAccessInvite();
    await goToPersonalStep(user);
    await fillPersonalStep(user);
    await chooseOption(user, stateTrigger(), "SP");
    await user.click(continueButton());
    await passwordHeading();
    await fillPasswords(user);
    await user.click(submitButton());

    await waitFor(() => expect(stateTrigger()).toHaveFocus());
    expect(stateTrigger()).toHaveAccessibleDescription("Escolha um estado da lista");
    expect(screen.getByRole("list", { name: "Etapa 2 de 3" })).toBeVisible();
  });

  it("goes to the oldest step with an error and marks the fields of the later ones too", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ error: validationFailed("registration.cpf", "registration.course") }),
    );
    await openAccessInvite();

    await completeRegistration(user);

    await waitFor(() => expect(courseField()).toHaveFocus());
    invalid(courseField());
    expect(courseField()).toHaveAccessibleDescription("Informe o seu curso");
    expect(screen.getByRole("list", { name: "Etapa 1 de 3" })).toBeVisible();

    await user.click(continueButton());
    await personalHeading();

    invalid(cpfField());
    expect(cpfField()).toHaveAccessibleDescription(CPF_INVALID);
  });

  it("shows the department error and focuses the department button when it is no longer valid", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ invite: buildInvite({ departments: DEPARTMENTS }) }),
      acceptInviteHandler({ error: { statusCode: 400, error: "DEPARTMENT_NOT_FOUND" } }),
    );
    await openAccessInvite();
    await chooseOption(user, departmentTrigger(), "Tecnologia");
    await goToPersonalStep(user);
    await fillPersonalStep(user);
    await user.click(continueButton());
    await passwordHeading();
    await fillPasswords(user);

    await user.click(submitButton());

    await waitFor(() => expect(departmentTrigger()).toHaveFocus());
    expect(departmentTrigger()).toHaveAccessibleDescription(
      "Este departamento não está mais disponível. Escolha outro.",
    );
    expect(screen.getByRole("list", { name: "Etapa 1 de 3" })).toBeVisible();
    expect(raField()).toHaveValue(RA);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("lets the person fix the department by choosing another one", async () => {
    const user = userEvent.setup();
    const accepted: AcceptInviteDto[] = [];
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ invite: buildInvite({ departments: DEPARTMENTS }) }),
      acceptInviteHandler({ error: { statusCode: 400, error: "DEPARTMENT_NOT_FOUND" } }),
    );
    await openAccessInvite();
    await chooseOption(user, departmentTrigger(), "Tecnologia");
    await goToPersonalStep(user);
    await fillPersonalStep(user);
    await user.click(continueButton());
    await passwordHeading();
    await fillPasswords(user);
    await user.click(submitButton());
    await waitFor(() => expect(departmentTrigger()).toHaveFocus());

    server.use(acceptInviteHandler({ onCall: (body) => accepted.push(body) }));
    await chooseOption(user, departmentTrigger(), "Pedagogia");

    await waitFor(() =>
      expect(departmentTrigger()).not.toHaveAccessibleDescription(
        "Este departamento não está mais disponível. Escolha outro.",
      ),
    );
    await user.click(continueButton());
    await personalHeading();
    await user.click(continueButton());
    await passwordHeading();
    await user.click(submitButton());

    await screen.findByRole("heading", { name: SENT_TITLE });
    expect(accepted[0].registration?.departmentId).toBe(DEPARTMENTS[0].id);
  });

  it("shows a general message on step 3 when the 400 does not name a field of the form", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ error: validationFailed("registration") }),
    );
    await openAccessInvite();

    await completeRegistration(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Algum dado não foi aceito pelo servidor. Volte às etapas anteriores, confira as informações e tente de novo.",
    );
    await waitFor(() => expect(passwordField()).toHaveFocus());
    expect(passwordField()).toBeEnabled();
    expect(passwordField()).toHaveValue(PASSWORD);
    expect(screen.getByRole("list", { name: "Etapa 3 de 3" })).toBeVisible();
    expect(submitButton()).toBeEnabled();
  });

  it("shows the general message too when the 400 names only a field the form does not have", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ error: validationFailed("registration.nickname") }),
    );
    await openAccessInvite();

    await completeRegistration(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("Algum dado não foi aceito");
    expect(screen.getByRole("list", { name: "Etapa 3 de 3" })).toBeVisible();
  });

  it("keeps the person on step 3 when the 400 is about the password", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ error: validationFailed("password") }),
    );
    await openAccessInvite();

    await completeRegistration(user);

    await waitFor(() => invalid(passwordField()));
    expect(passwordField()).toHaveAccessibleDescription("A senha deve ter no mínimo 8 caracteres");
    await waitFor(() => expect(passwordField()).toHaveFocus());
    expect(screen.getByRole("list", { name: "Etapa 3 de 3" })).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears the RA-in-use error when the RA is edited and lets the person try again", async () => {
    const user = userEvent.setup();
    const accepted: AcceptInviteDto[] = [];
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ error: { statusCode: 409, error: "RA_ALREADY_IN_USE" } }),
    );
    await openAccessInvite();
    await completeRegistration(user);
    await waitFor(() => invalid(raField()));

    await user.type(raField(), "9");

    await waitFor(() => notInvalid(raField()));
    expect(screen.queryByText("Este RA já está em uso")).not.toBeInTheDocument();

    server.use(acceptInviteHandler({ onCall: (body) => accepted.push(body) }));
    await user.click(continueButton());
    await personalHeading();
    expect(nameField()).toHaveValue(NAME);
    await user.click(continueButton());
    await passwordHeading();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(submitButton());

    await screen.findByRole("heading", { name: SENT_TITLE });
    expect(accepted).toHaveLength(1);
    expect(accepted[0].registration).toMatchObject({ ra: `${RA}9` });
    expect(screen.getByText(/RA \(2026001179\)/)).toBeVisible();
  });

  it.each([
    ["the network fails", { networkError: true }],
    ["the gateway answers 503", { error: { statusCode: 503, error: "SERVICE_UNAVAILABLE" } }],
  ])("shows the network message and keeps the data when %s", async (_label, options) => {
    const user = userEvent.setup();
    server.use(meHandler({ user: null }), getInviteHandler(), acceptInviteHandler(options));
    await openAccessInvite();

    await completeRegistration(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível conectar");
    await waitFor(() => expect(passwordField()).toHaveFocus());
    expect(passwordField()).toBeEnabled();
    expect(passwordField()).toHaveValue(PASSWORD);
    expect(passwordField()).toHaveAccessibleDescription(
      expect.stringContaining("Não foi possível conectar"),
    );
    expect(submitButton()).toBeEnabled();
  });

  it("shows a fallback message on an unexpected server error", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" } }),
    );
    await openAccessInvite();

    await completeRegistration(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível enviar o cadastro. Tente novamente.",
    );
  });

  it("does not bring an error of the failed attempt back after going back and forward again", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" } }),
    );
    await openAccessInvite();
    await completeRegistration(user);
    await screen.findByRole("alert");

    await user.click(backButton());
    await user.click(await screen.findByRole("button", { name: "Continuar" }));
    await passwordHeading();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("AcceptInviteForm while sending", () => {
  it("disables the form and does not send a second POST on a double click", async () => {
    const user = userEvent.setup();
    const deferred = createDeferred();
    let posts = 0;
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({ delay: deferred.promise, onCall: () => (posts += 1) }),
    );
    const { container } = await openAccessInvite();
    await goToPasswordStep(user);
    await fillPasswords(user);

    const button = submitButton();
    await user.dblClick(button);
    await user.click(button);

    expect(await screen.findByRole("button", { name: "Enviando…" })).toBe(button);
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button.querySelector("[data-slot='spinner']")).toBeInTheDocument();
    expect(container.querySelector("form")).toHaveAttribute("aria-busy", "true");
    expect(passwordField()).toBeDisabled();
    expect(confirmationField()).toBeDisabled();
    expect(backButton()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mostrar senha" })).toBeDisabled();
    await waitFor(() => expect(posts).toBeGreaterThan(0));
    expect(posts).toBe(1);

    deferred.resolve();
    await screen.findByRole("heading", { name: SENT_TITLE });
    expect(posts).toBe(1);
  });

  it("shows the slow-connection notice after 3s and hides it on response", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const deferred = createDeferred();
    server.use(
      meHandler({ user: null }),
      getInviteHandler(),
      acceptInviteHandler({
        delay: deferred.promise,
        error: { statusCode: 500, error: "INTERNAL_SERVER_ERROR" },
      }),
    );
    const { container } = await openAccessInvite();
    await goToPasswordStep(user);
    const region = container.querySelector<HTMLElement>("div[role='status']");
    expect(region).toBeEmptyDOMElement();

    await fillPasswords(user);
    await user.click(submitButton());
    await screen.findByRole("button", { name: "Enviando…" });
    act(() => {
      vi.advanceTimersByTime(SLOW_NOTICE_DELAY_MS);
    });

    await waitFor(() => expect(region).toHaveTextContent(SLOW_NOTICE));
    expect(container.querySelector("div[role='status']")).toBe(region);

    deferred.resolve();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível enviar o cadastro. Tente novamente.",
    );
    await waitFor(() => expect(region).toBeEmptyDOMElement());
  });
});

describe("AcceptInviteForm accessibility", () => {
  // Exceção consciente à regra "asserção por papel, não por classe": o jsdom não carrega CSS, então
  // alvo de 44px e fonte de 16px só são verificáveis pelas classes do Tailwind.
  it("renders 44px targets and 16px text on the three steps", async () => {
    const user = userEvent.setup();
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ invite: buildInvite({ departments: DEPARTMENTS }) }),
    );
    await openAccessInvite();

    for (const field of [
      raField(),
      institutionalEmailField(),
      courseField(),
      semesterField(),
      classNameField(),
      volunteerTermUrlField(),
    ]) {
      expect(field).toHaveClass("min-h-11", "text-base");
    }
    expect(departmentTrigger()).toHaveClass("min-h-11", "text-base");
    expect(continueButton()).toHaveClass("min-h-11", "text-base");
    expect(screen.getByRole("heading", { level: 2, name: "Dados acadêmicos" })).toHaveClass(
      "text-base",
    );
    expect(screen.getByText(/^Etapa 1 de 3 · /)).toHaveClass("text-base");
    expect(screen.getByText("Você foi convidado como Membro")).toHaveClass("text-base");

    await goToPersonalStep(user);

    for (const field of [
      nameField(),
      birthDateField(),
      cpfField(),
      phoneField(),
      personalEmailField(),
      addressField(),
      cityField(),
    ]) {
      expect(field).toHaveClass("min-h-11", "text-base");
    }
    expect(stateTrigger()).toHaveClass("min-h-11", "text-base");
    expect(backButton()).toHaveClass("min-h-11", "text-base");
    expect(continueButton()).toHaveClass("min-h-11", "text-base");
    expect(screen.getByRole("heading", { level: 2, name: "Dados pessoais" })).toHaveClass(
      "text-base",
    );
    expect(screen.getByText(/^Etapa 2 de 3 · /)).toHaveClass("text-base");

    await fillPersonalStep(user);
    await user.click(continueButton());
    await passwordHeading();

    for (const field of [passwordField(), confirmationField()]) {
      expect(field).toHaveClass("min-h-11", "text-base");
    }
    for (const eye of [
      screen.getByRole("button", { name: "Mostrar senha" }),
      screen.getByRole("button", { name: "Mostrar confirmação da senha" }),
    ]) {
      expect(eye).toHaveClass("min-h-11", "min-w-11");
    }
    expect(backButton()).toHaveClass("min-h-11", "text-base");
    expect(submitButton()).toHaveClass("min-h-11", "text-base");
    expect(screen.getByRole("heading", { level: 2, name: "Crie sua senha" })).toHaveClass(
      "text-base",
    );
    expect(summaryStrip()).toHaveClass("text-base");
    expect(screen.getByText(/^Etapa 3 de 3 · /)).toHaveClass("text-base");
  });

  it("keeps the hints of the fields at 14px, the same size as the other forms", async () => {
    server.use(meHandler({ user: null }), getInviteHandler());
    await openAccessInvite();

    expect(screen.getByText("Você vai entrar no sistema com este RA.")).toHaveClass("text-sm");
    expect(screen.getByText("Use um número de 1 a 20.")).toHaveClass("text-sm");
  });

  it("is operable by keyboard only, from step 1 to the registration-sent screen", async () => {
    const user = userEvent.setup();
    const accepted: AcceptInviteDto[] = [];
    server.use(
      meHandler({ user: null }),
      getInviteHandler({ invite: buildInvite({ departments: DEPARTMENTS }) }),
      acceptInviteHandler({ onCall: (body) => accepted.push(body) }),
    );
    await openAccessInvite();

    const typeInto = async (field: () => HTMLElement, value: string) => {
      await user.tab();
      expect(field()).toHaveFocus();
      await user.paste(value);
    };

    await typeInto(raField, RA);
    await typeInto(institutionalEmailField, REGISTRATION.institutionalEmail);
    await typeInto(courseField, REGISTRATION.course);
    await typeInto(semesterField, "3");
    await typeInto(classNameField, REGISTRATION.className);
    await user.tab();
    expect(departmentTrigger()).toHaveFocus();
    await user.keyboard("{Enter}");
    await screen.findByRole("listbox");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(departmentTrigger()).toHaveTextContent("Pedagogia");
    // O React Aria devolve o foco ao botão num quadro depois de fechar a lista. Sem esperar, o Tab
    // sai do `body` e cai no primeiro campo da página (acontece com a máquina carregada).
    await waitFor(() => expect(departmentTrigger()).toHaveFocus());
    await user.tab();
    expect(volunteerTermUrlField()).toHaveFocus();
    await user.tab();
    expect(continueButton()).toHaveFocus();
    await user.keyboard("{Enter}");

    const personal = await personalHeading();
    await waitFor(() => expect(personal).toHaveFocus());
    await typeInto(nameField, NAME);
    await user.tab();
    expect(birthDateField()).toHaveFocus();
    await user.paste("1999-07-22");
    await typeInto(cpfField, "52998224725");
    await typeInto(phoneField, "11981234567");
    await typeInto(personalEmailField, REGISTRATION.personalEmail);
    await user.tab();
    expect(addressField()).toHaveFocus();
    await user.tab();
    expect(cityField()).toHaveFocus();
    await user.tab();
    expect(stateTrigger()).toHaveFocus();
    await user.tab();
    expect(backButton()).toHaveFocus();
    await user.tab();
    expect(continueButton()).toHaveFocus();
    await user.keyboard("{Enter}");

    const password = await passwordHeading();
    await waitFor(() => expect(password).toHaveFocus());
    await user.tab();
    expect(passwordField()).toHaveFocus();
    await user.paste(PASSWORD);
    await user.tab();
    expect(screen.getByRole("button", { name: "Mostrar senha" })).toHaveFocus();
    await user.tab();
    expect(confirmationField()).toHaveFocus();
    await user.paste(PASSWORD);
    await user.tab();
    expect(screen.getByRole("button", { name: "Mostrar confirmação da senha" })).toHaveFocus();
    await user.tab();
    expect(backButton()).toHaveFocus();
    await user.tab();
    expect(submitButton()).toHaveFocus();
    await user.keyboard("{Enter}");

    await screen.findByRole("heading", { name: SENT_TITLE });
    expect(accepted).toHaveLength(1);
    expect(accepted[0].registration).toMatchObject({
      ra: RA,
      departmentId: DEPARTMENTS[0].id,
      cpf: "52998224725",
    });
  });
});
