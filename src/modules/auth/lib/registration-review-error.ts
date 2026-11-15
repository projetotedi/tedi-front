import { GATEWAY_STATUS_CODES, readApiErrorShape } from "./api-error";

/** Campo do formulário de validação que o back pode recusar. */
export type RegistrationReviewField =
  | "role"
  | "departmentId"
  | "mainFunction"
  | "joinedAt"
  | "note";

/**
 * Chave de `registrationReview.validation.*` com o texto do erro de um campo que o back recusou.
 * As mensagens da validação do próprio formulário (`roleRequired`, `noteRequired`...) moram no
 * mesmo grupo de textos e vêm do schema.
 */
export type RegistrationReviewFieldMessage =
  | "roleInvalid"
  | "departmentNotFound"
  | "departmentRequired"
  | "mainFunctionInvalid"
  | "joinedAtInvalid"
  | "noteInvalid";

export interface RegistrationReviewFieldError {
  name: RegistrationReviewField;
  message: RegistrationReviewFieldMessage;
}

/** Chave de `registrationReview.errors.*` com o texto do erro que não é de um campo. */
export type RegistrationReviewErrorKind =
  | "notPending"
  | "notFound"
  | "invalidData"
  | "network"
  | "unknown";

export type RegistrationReviewError =
  | { kind: "fields"; fields: RegistrationReviewFieldError[] }
  | { kind: RegistrationReviewErrorKind };

const NOT_FOUND_CODE = "MEMBER_REGISTRATION_NOT_FOUND";

/**
 * Ordem em que os campos aparecem no formulário. O erro do back sai nessa ordem, e o diálogo a usa
 * para achar o primeiro campo com problema, o que recebe o foco.
 */
export const REGISTRATION_REVIEW_FIELD_ORDER: readonly RegistrationReviewField[] = [
  "role",
  "departmentId",
  "mainFunction",
  "joinedAt",
  "note",
];

/** Texto do `VALIDATION_FAILED` de cada campo (o back não diz o motivo, só o campo). */
const VALIDATION_MESSAGES: Readonly<
  Record<RegistrationReviewField, RegistrationReviewFieldMessage>
> = {
  role: "roleInvalid",
  departmentId: "departmentRequired",
  mainFunction: "mainFunctionInvalid",
  joinedAt: "joinedAtInvalid",
  note: "noteInvalid",
};

/**
 * Lê `details[].field` do `VALIDATION_FAILED` por checagem estrutural: o `ApiErrorShape` de
 * `api-error.ts` só conhece `statusCode` e `error`.
 */
function readReportedFields(error: unknown): Set<string> {
  const details =
    typeof error === "object" && error !== null ? (error as { details?: unknown }).details : null;
  const fields = new Set<string>();
  if (!Array.isArray(details)) return fields;

  for (const detail of details) {
    if (typeof detail !== "object" || detail === null) continue;
    const { field } = detail as { field?: unknown };
    if (typeof field === "string") fields.add(field);
  }
  return fields;
}

function toValidationError(error: unknown): RegistrationReviewError {
  const reported = readReportedFields(error);
  const fields = REGISTRATION_REVIEW_FIELD_ORDER.filter((name) => reported.has(name)).map(
    (name) => ({
      name,
      message: VALIDATION_MESSAGES[name],
    }),
  );
  return fields.length > 0 ? { kind: "fields", fields } : { kind: "invalidData" };
}

/** Se o back respondeu que o cadastro não existe (também vale para um id malformado). */
export function isRegistrationNotFound(error: unknown): boolean {
  const { statusCode, error: code } = readApiErrorShape(error);
  return statusCode === 404 && code === NOT_FOUND_CODE;
}

/**
 * Traduz o erro de aprovar ou recusar. Distingue pelo código junto com o status, como o back:
 * `DEPARTMENT_NOT_FOUND`, `INVALID_ROLE` e `VALIDATION_FAILED` são todos 400.
 */
export function toRegistrationReviewError(error: unknown): RegistrationReviewError {
  const { statusCode, error: code } = readApiErrorShape(error);

  if (statusCode === 409 && code === "REGISTRATION_NOT_PENDING") return { kind: "notPending" };
  if (isRegistrationNotFound(error)) return { kind: "notFound" };
  if (statusCode === 400 && code === "INVALID_ROLE") {
    return { kind: "fields", fields: [{ name: "role", message: "roleInvalid" }] };
  }
  if (statusCode === 400 && code === "DEPARTMENT_NOT_FOUND") {
    return { kind: "fields", fields: [{ name: "departmentId", message: "departmentNotFound" }] };
  }
  if (statusCode === 400 && code === "VALIDATION_FAILED") return toValidationError(error);
  if (error instanceof TypeError) return { kind: "network" };
  if (typeof statusCode === "number" && GATEWAY_STATUS_CODES.has(statusCode)) {
    return { kind: "network" };
  }
  return { kind: "unknown" };
}
