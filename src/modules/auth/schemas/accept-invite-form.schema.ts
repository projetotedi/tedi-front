import * as zod from "zod";

import { BrazilianState } from "@api/generated/model";
import {
  acceptInviteBodyRegistrationOneAddressMax,
  acceptInviteBodyRegistrationOneCityMax,
  acceptInviteBodyRegistrationOneClassNameMax,
  acceptInviteBodyRegistrationOneCourseMax,
  acceptInviteBodyRegistrationOneInstitutionalEmailMax,
  acceptInviteBodyRegistrationOneNameMax,
  acceptInviteBodyRegistrationOnePersonalEmailMax,
  acceptInviteBodyRegistrationOneRaMax,
  acceptInviteBodyRegistrationOneSemesterMax,
  acceptInviteBodyRegistrationOneVolunteerTermUrlMax,
} from "@api/generated/zod/auth/auth";

import { isValidBirthDate } from "../lib/birth-date";
import { isValidCpf, onlyDigits } from "../lib/cpf";
import { passwordFields, passwordMismatch, passwordsMatch } from "./password.schema";

/**
 * Schema próprio do formulário de cadastro por convite, e não o `AcceptInviteBody` gerado: o
 * formulário difere do DTO (CPF e telefone com máscara, período digitado como texto e enviado como
 * inteiro, confirmação de senha que não vai à rede, mensagens em chaves de i18n) e o schema gerado
 * não valida e-mail, CPF, telefone nem HTTPS. Os limites de tamanho vêm do gerado, de onde o
 * `toAcceptInviteDto` e o teste de contrato conferem que o corpo montado continua valendo.
 *
 * A entrada (`AcceptInviteFormInput`) é só texto, o que os campos seguram; a saída
 * (`AcceptInviteFormOutput`) já tem os tipos do DTO: textos aparados, CPF e telefone só com
 * dígitos, período inteiro e opcional vazio como `undefined`.
 */

/** O contrato só dá o máximo do período como constante; o mínimo (1) está no `@minimum` do DTO. */
const SEMESTER_MIN = 1;

/** Limites do contrato. Também são os valores de interpolação das mensagens ("no máximo {{nameMax}}"). */
export const REGISTRATION_LIMITS = {
  nameMax: acceptInviteBodyRegistrationOneNameMax,
  raMax: acceptInviteBodyRegistrationOneRaMax,
  institutionalEmailMax: acceptInviteBodyRegistrationOneInstitutionalEmailMax,
  courseMax: acceptInviteBodyRegistrationOneCourseMax,
  semesterMin: SEMESTER_MIN,
  semesterMax: acceptInviteBodyRegistrationOneSemesterMax,
  classNameMax: acceptInviteBodyRegistrationOneClassNameMax,
  volunteerTermUrlMax: acceptInviteBodyRegistrationOneVolunteerTermUrlMax,
  personalEmailMax: acceptInviteBodyRegistrationOnePersonalEmailMax,
  addressMax: acceptInviteBodyRegistrationOneAddressMax,
  cityMax: acceptInviteBodyRegistrationOneCityMax,
} as const;

const WHOLE_NUMBER = /^\d+$/;
const PHONE_DIGITS = /^\d{10,11}$/;

function emptyToUndefined<Value extends string>(value: Value | ""): Value | undefined {
  return value === "" ? undefined : value;
}

/** Texto obrigatório: aparado, não vazio (`abort`: sem uma segunda mensagem em cima de "obrigatório") e com máximo. */
function requiredText(requiredMessage: string, max: number, maxMessage: string) {
  return zod
    .string()
    .trim()
    .min(1, { message: requiredMessage, abort: true })
    .max(max, { message: maxMessage });
}

/** Texto opcional: vazio vira `undefined`, e a chave do corpo fica de fora. */
function optionalText(max: number, maxMessage: string) {
  return zod.string().trim().max(max, { message: maxMessage }).transform(emptyToUndefined);
}

/** E-mail obrigatório. O máximo do contrato entra na mesma mensagem de "inválido". */
function requiredEmail(requiredMessage: string, max: number, invalidMessage: string) {
  return zod
    .string()
    .trim()
    .min(1, { message: requiredMessage, abort: true })
    .max(max, { message: invalidMessage })
    .pipe(zod.email({ message: invalidMessage }));
}

function isEmptyOrHttpsUrl(value: string): boolean {
  if (value === "") return true;
  if (/\s/.test(value)) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.includes(".");
  } catch {
    return false;
  }
}

const semester = zod
  .string()
  .trim()
  .min(1, { message: "invite.validation.semesterRequired", abort: true })
  .regex(WHOLE_NUMBER, { message: "invite.validation.semesterInvalid", abort: true })
  .transform(Number)
  .pipe(
    zod
      .number()
      .min(SEMESTER_MIN, { message: "invite.validation.semesterInvalid" })
      .max(acceptInviteBodyRegistrationOneSemesterMax, {
        message: "invite.validation.semesterInvalid",
      }),
  );

/** Etapa 1, "Dados acadêmicos". `departmentId` é "" (não informar) ou o id escolhido na lista do convite. */
export const academicStepSchema = zod.object({
  ra: requiredText(
    "invite.validation.raRequired",
    acceptInviteBodyRegistrationOneRaMax,
    "invite.validation.raMax",
  ),
  institutionalEmail: requiredEmail(
    "invite.validation.institutionalEmailRequired",
    acceptInviteBodyRegistrationOneInstitutionalEmailMax,
    "invite.validation.institutionalEmailInvalid",
  ),
  course: requiredText(
    "invite.validation.courseRequired",
    acceptInviteBodyRegistrationOneCourseMax,
    "invite.validation.courseMax",
  ),
  semester,
  className: requiredText(
    "invite.validation.classNameRequired",
    acceptInviteBodyRegistrationOneClassNameMax,
    "invite.validation.classNameMax",
  ),
  departmentId: zod.string().transform(emptyToUndefined),
  volunteerTermUrl: zod
    .string()
    .trim()
    .max(acceptInviteBodyRegistrationOneVolunteerTermUrlMax, {
      message: "invite.validation.volunteerTermUrlMax",
    })
    .refine(isEmptyOrHttpsUrl, { message: "invite.validation.volunteerTermUrlInvalid" })
    .transform(emptyToUndefined),
});

/** Etapa 2, "Dados pessoais". `birthDate` é o valor do `<input type="date">`; CPF e telefone chegam com máscara. */
export const personalStepSchema = zod.object({
  name: requiredText(
    "invite.validation.nameRequired",
    acceptInviteBodyRegistrationOneNameMax,
    "invite.validation.nameMax",
  ),
  birthDate: zod
    .string()
    .min(1, { message: "invite.validation.birthDateRequired", abort: true })
    .refine((value) => isValidBirthDate(value), { message: "invite.validation.birthDateInvalid" }),
  cpf: zod
    .string()
    .trim()
    .min(1, { message: "invite.validation.cpfRequired", abort: true })
    .refine(isValidCpf, { message: "invite.validation.cpfInvalid" })
    .transform(onlyDigits),
  phone: zod
    .string()
    .trim()
    .min(1, { message: "invite.validation.phoneRequired", abort: true })
    .refine((value) => PHONE_DIGITS.test(onlyDigits(value)), {
      message: "invite.validation.phoneInvalid",
    })
    .transform(onlyDigits),
  personalEmail: requiredEmail(
    "invite.validation.personalEmailRequired",
    acceptInviteBodyRegistrationOnePersonalEmailMax,
    "invite.validation.personalEmailInvalid",
  ),
  address: optionalText(acceptInviteBodyRegistrationOneAddressMax, "invite.validation.addressMax"),
  city: optionalText(acceptInviteBodyRegistrationOneCityMax, "invite.validation.cityMax"),
  state: zod
    .union([zod.literal(""), zod.enum(BrazilianState)], {
      error: "invite.validation.stateInvalid",
    })
    .transform(emptyToUndefined),
});

export const acceptInviteFormSchema = zod
  .object({
    ...academicStepSchema.shape,
    ...personalStepSchema.shape,
    ...passwordFields,
  })
  .refine(passwordsMatch, passwordMismatch);

export type AcceptInviteFormInput = zod.input<typeof acceptInviteFormSchema>;
export type AcceptInviteFormOutput = zod.output<typeof acceptInviteFormSchema>;
export type AcceptInviteFieldName = keyof AcceptInviteFormInput;

export type InviteStep = 1 | 2 | 3;

// Os campos de cada etapa vêm do schema dela: o `trigger` do formulário valida só estes.
export const STEP_ONE_FIELDS = [
  "ra",
  "institutionalEmail",
  "course",
  "semester",
  "className",
  "departmentId",
  "volunteerTermUrl",
] as const satisfies readonly (keyof typeof academicStepSchema.shape)[];

export const STEP_TWO_FIELDS = [
  "name",
  "birthDate",
  "cpf",
  "phone",
  "personalEmail",
  "address",
  "city",
  "state",
] as const satisfies readonly (keyof typeof personalStepSchema.shape)[];

export const STEP_THREE_FIELDS = [
  "password",
  "passwordConfirmation",
] as const satisfies readonly (keyof typeof passwordFields)[];

/** Ordem em que os campos aparecem na tela: a dos erros do servidor e a do primeiro foco. */
export const FORM_FIELD_ORDER: readonly AcceptInviteFieldName[] = [
  ...STEP_ONE_FIELDS,
  ...STEP_TWO_FIELDS,
  ...STEP_THREE_FIELDS,
];

/** Em que etapa cada campo mora: um erro do servidor leva à etapa mais antiga que tem campo com erro. */
export const STEP_OF_FIELD = {
  ra: 1,
  institutionalEmail: 1,
  course: 1,
  semester: 1,
  className: 1,
  departmentId: 1,
  volunteerTermUrl: 1,
  name: 2,
  birthDate: 2,
  cpf: 2,
  phone: 2,
  personalEmail: 2,
  address: 2,
  city: 2,
  state: 2,
  password: 3,
  passwordConfirmation: 3,
} as const satisfies Record<AcceptInviteFieldName, InviteStep>;
