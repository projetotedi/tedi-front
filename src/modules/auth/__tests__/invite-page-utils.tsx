import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";

import { AuthProvider } from "../AuthProvider";
import { InvitePage } from "../pages/InvitePage";
import { renderWithProviders } from "./test-utils";

/**
 * Apoio dos testes da `InvitePage` (a página) e do `AcceptInviteForm` (o formulário em etapas):
 * render, os valores de um cadastro completo e os passos para preenchê-lo. Os campos de texto são
 * preenchidos por colagem (`user.paste`): o formulário tem 12 campos de texto e digitar tecla a
 * tecla multiplicaria o tempo de cada teste. A digitação tecla a tecla, onde importa (as máscaras),
 * tem teste próprio.
 */

export const TOKEN = "abc";
export const NAME = "Lucas Andrade Souza";
export const RA = "202600117";
export const INSTITUTIONAL_EMAIL = "lucas@instituicao.edu.br";
export const COURSE = "Sistemas de Informação";
export const SEMESTER = "3";
export const CLASS_NAME = "SI-2024-N";
export const BIRTH_DATE = "1999-07-22";
export const CPF = "529.982.247-25";
export const PHONE = "(11) 98123-4567";
export const PERSONAL_EMAIL = "lucas@example.com";
export const PASSWORD = "senha-segura-1";

/** O `registration` que o cadastro padrão manda (só os obrigatórios, CPF e telefone já só com dígitos). */
export const REGISTRATION = {
  name: NAME,
  ra: RA,
  personalEmail: PERSONAL_EMAIL,
  birthDate: BIRTH_DATE,
  cpf: "52998224725",
  phone: "11981234567",
  institutionalEmail: INSTITUTIONAL_EMAIL,
  course: COURSE,
  semester: 3,
  className: CLASS_NAME,
};

export const NO_BREAK_SPACE = String.fromCharCode(160);

export function renderInvitePage(route: string) {
  return renderWithProviders(
    <AuthProvider>
      <Routes>
        <Route path="/invite" element={<InvitePage />} />
        <Route path="/reset-password" element={<InvitePage />} />
        <Route path="*" element={<p>Destino do redirecionamento</p>} />
      </Routes>
    </AuthProvider>,
    { route },
  );
}

export function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// Espera o primeiro campo, e não o título: o título já existe (sr-only) na tela de carregamento.
export async function openAccessInvite(route = `/invite?token=${TOKEN}`) {
  const view = await renderInvitePage(route);
  await screen.findByLabelText("RA");
  return view;
}

// Etapa 1
export const raField = () => screen.getByLabelText("RA");
export const institutionalEmailField = () => screen.getByLabelText("E-mail institucional");
export const courseField = () => screen.getByLabelText("Curso da faculdade");
export const semesterField = () => screen.getByLabelText("Período");
export const classNameField = () => screen.getByLabelText("Turma da faculdade");
export const departmentTrigger = () => screen.getByRole("button", { name: /Departamento/ });
export const volunteerTermUrlField = () => screen.getByLabelText("Link do termo de voluntariado");

// Etapa 2
export const nameField = () => screen.getByLabelText("Nome completo");
export const birthDateField = () => screen.getByLabelText("Data de nascimento");
export const cpfField = () => screen.getByLabelText("CPF");
export const phoneField = () => screen.getByLabelText("Telefone");
export const personalEmailField = () => screen.getByLabelText("E-mail pessoal");
export const addressField = () => screen.getByLabelText("Endereço");
export const cityField = () => screen.getByLabelText("Cidade");
export const stateTrigger = () => screen.getByRole("button", { name: /Estado \(UF\)/ });

// Etapa 3 e link de redefinição
export const passwordField = () => screen.getByLabelText("Senha");
export const confirmationField = () => screen.getByLabelText("Confirmar senha");
export const newPasswordField = () => screen.getByLabelText("Nova senha");
export const newPasswordConfirmationField = () => screen.getByLabelText("Confirmar nova senha");

export const continueButton = () => screen.getByRole("button", { name: "Continuar" });
export const backButton = () => screen.getByRole("button", { name: "Voltar" });
export const submitButton = () => screen.getByRole("button", { name: "Enviar cadastro" });

export const personalHeading = () =>
  screen.findByRole("heading", { level: 2, name: "Dados pessoais" });
export const academicHeading = () =>
  screen.findByRole("heading", { level: 2, name: "Dados acadêmicos" });
export const passwordHeading = () =>
  screen.findByRole("heading", { level: 2, name: "Crie sua senha" });

export async function pasteInto(user: UserEvent, element: HTMLElement, value: string) {
  await user.click(element);
  await user.paste(value);
}

export interface AcademicValues {
  ra: string;
  institutionalEmail: string;
  course: string;
  semester: string;
  className: string;
  volunteerTermUrl: string;
}

const DEFAULT_ACADEMIC: AcademicValues = {
  ra: RA,
  institutionalEmail: INSTITUTIONAL_EMAIL,
  course: COURSE,
  semester: SEMESTER,
  className: CLASS_NAME,
  volunteerTermUrl: "",
};

/** Preenche a etapa 1 (o link do termo é opcional e fica vazio). Um valor `""` deixa o campo vazio. */
export async function fillAcademicStep(user: UserEvent, values: Partial<AcademicValues> = {}) {
  const merged = { ...DEFAULT_ACADEMIC, ...values };
  const fields: [() => HTMLElement, string][] = [
    [raField, merged.ra],
    [institutionalEmailField, merged.institutionalEmail],
    [courseField, merged.course],
    [semesterField, merged.semester],
    [classNameField, merged.className],
    [volunteerTermUrlField, merged.volunteerTermUrl],
  ];
  for (const [field, value] of fields) {
    if (value) await pasteInto(user, field(), value);
  }
}

export interface PersonalValues {
  name: string;
  birthDate: string;
  cpf: string;
  phone: string;
  personalEmail: string;
  address: string;
  city: string;
}

const DEFAULT_PERSONAL: PersonalValues = {
  name: NAME,
  birthDate: BIRTH_DATE,
  cpf: CPF,
  phone: PHONE,
  personalEmail: PERSONAL_EMAIL,
  address: "",
  city: "",
};

/** Preenche a etapa 2 (endereço e cidade são opcionais e ficam vazios). Um valor `""` deixa o campo vazio. */
export async function fillPersonalStep(user: UserEvent, values: Partial<PersonalValues> = {}) {
  const merged = { ...DEFAULT_PERSONAL, ...values };
  const fields: [() => HTMLElement, string][] = [
    [nameField, merged.name],
    [birthDateField, merged.birthDate],
    [cpfField, merged.cpf],
    [phoneField, merged.phone],
    [personalEmailField, merged.personalEmail],
    [addressField, merged.address],
    [cityField, merged.city],
  ];
  for (const [field, value] of fields) {
    if (value) await pasteInto(user, field(), value);
  }
}

/** Abre a lista de um `Select` do cadastro e escolhe uma opção pelo nome. */
export async function chooseOption(user: UserEvent, trigger: HTMLElement, option: string) {
  await user.click(trigger);
  await user.click(await screen.findByRole("option", { name: option }));
}

export async function goToPersonalStep(user: UserEvent, values: Partial<AcademicValues> = {}) {
  await fillAcademicStep(user, values);
  await user.click(continueButton());
  await personalHeading();
}

export async function goToPasswordStep(user: UserEvent) {
  await goToPersonalStep(user);
  await fillPersonalStep(user);
  await user.click(continueButton());
  await passwordHeading();
}

export async function fillPasswords(user: UserEvent, password = PASSWORD, confirmation = password) {
  await pasteInto(user, passwordField(), password);
  await pasteInto(user, confirmationField(), confirmation);
}

// Os campos do link de redefinição têm outros rótulos ("Nova senha"); não há checkbox de consentimento.
export async function fillNewPasswords(
  user: UserEvent,
  password = PASSWORD,
  confirmation = password,
) {
  await pasteInto(user, newPasswordField(), password);
  await pasteInto(user, newPasswordConfirmationField(), confirmation);
}

export async function completeRegistration(user: UserEvent) {
  await goToPasswordStep(user);
  await fillPasswords(user);
  await user.click(submitButton());
}
