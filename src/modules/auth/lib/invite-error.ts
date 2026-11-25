import { FORM_FIELD_ORDER, type AcceptInviteFieldName } from "../schemas/accept-invite-form.schema";
import { GATEWAY_STATUS_CODES, readApiErrorShape } from "./api-error";

export type InviteErrorKey =
  | "invalidInvite"
  | "raInUse"
  | "emailInUse"
  | "departmentNotFound"
  | "invalidData"
  | "network"
  | "unknown";

export function toInviteErrorKey(error: unknown): InviteErrorKey {
  const { statusCode, error: code } = readApiErrorShape(error);

  if (code === "INVALID_INVITE") return "invalidInvite";
  if (code === "RA_ALREADY_IN_USE") return "raInUse";
  if (code === "EMAIL_ALREADY_IN_USE") return "emailInUse";
  if (code === "DEPARTMENT_NOT_FOUND") return "departmentNotFound";
  if (code === "VALIDATION_FAILED") return "invalidData";
  if (error instanceof TypeError) return "network";
  if (typeof statusCode === "number" && GATEWAY_STATUS_CODES.has(statusCode)) return "network";
  return "unknown";
}

/** Um erro do servidor ligado a um campo: o nome dele no formulário e a chave do texto (namespace `auth`). */
export interface RegistrationFieldError {
  field: AcceptInviteFieldName;
  message: string;
}

function fieldError(field: AcceptInviteFieldName, messageKey: string): RegistrationFieldError {
  return { field, message: `invite.${messageKey}` };
}

function registrationField(
  field: AcceptInviteFieldName,
  messageKey: string,
): [string, RegistrationFieldError] {
  return [`registration.${field}`, fieldError(field, messageKey)];
}

/**
 * Campos que o back nomeia no 400 VALIDATION_FAILED, em notação de ponto: `registration.<campo>` e
 * a `password` do topo do corpo. O texto é um só por campo, o que cobre qualquer regra que o back
 * aplique a ele. Um `Map`, e não um objeto: o nome do campo vem do servidor e não pode cair em
 * `constructor` ou `__proto__`.
 */
const SERVER_FIELDS: ReadonlyMap<string, RegistrationFieldError> = new Map([
  ["password", fieldError("password", "validation.passwordMin")],
  registrationField("name", "validation.nameRequired"),
  registrationField("ra", "validation.raRequired"),
  registrationField("personalEmail", "validation.personalEmailInvalid"),
  registrationField("birthDate", "validation.birthDateInvalid"),
  registrationField("cpf", "validation.cpfInvalid"),
  registrationField("phone", "validation.phoneInvalid"),
  registrationField("address", "validation.addressMax"),
  registrationField("city", "validation.cityMax"),
  registrationField("state", "validation.stateInvalid"),
  registrationField("institutionalEmail", "validation.institutionalEmailInvalid"),
  registrationField("course", "validation.courseRequired"),
  registrationField("semester", "validation.semesterInvalid"),
  registrationField("className", "validation.classNameRequired"),
  registrationField("departmentId", "validation.departmentInvalid"),
  registrationField("volunteerTermUrl", "validation.volunteerTermUrlInvalid"),
]);

function readDetailField(detail: unknown): string | null {
  if (typeof detail !== "object" || detail === null) return null;
  const { field } = detail as { field?: unknown };
  return typeof field === "string" ? field : null;
}

function validationFieldErrors(details: unknown): RegistrationFieldError[] {
  if (!Array.isArray(details)) return [];

  const byField = new Map<AcceptInviteFieldName, RegistrationFieldError>();
  for (const detail of details) {
    const field = readDetailField(detail);
    const error = field === null ? undefined : SERVER_FIELDS.get(field);
    if (error && !byField.has(error.field)) byField.set(error.field, error);
  }

  return FORM_FIELD_ORDER.flatMap((field) => byField.get(field) ?? []);
}

/**
 * Os campos que o erro do aceite aponta, na ordem em que aparecem no formulário:
 * - 409 RA_ALREADY_IN_USE: o RA;
 * - 409 EMAIL_ALREADY_IN_USE: o e-mail pessoal (o back compara o `personalEmail`);
 * - 400 DEPARTMENT_NOT_FOUND: o departamento;
 * - 400 VALIDATION_FAILED: cada `registration.<campo>` (e `password`) de `details`, sem repetir.
 *
 * Vazio quando o erro não aponta campo algum: erro de rede, convite inválido, `registration` sozinho
 * (o objeto inteiro faltando) ou um campo que o formulário não tem. Quem chama mostra o aviso geral.
 */
export function toRegistrationFieldErrors(error: unknown): RegistrationFieldError[] {
  const key = toInviteErrorKey(error);

  if (key === "raInUse") return [fieldError("ra", "errors.raInUse")];
  if (key === "emailInUse") return [fieldError("personalEmail", "errors.emailInUse")];
  if (key === "departmentNotFound") {
    return [fieldError("departmentId", "errors.departmentNotFound")];
  }
  if (key !== "invalidData") return [];

  return validationFieldErrors(readApiErrorShape(error).details);
}
