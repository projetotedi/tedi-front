import type { ApiFieldErrorDto } from "@api/generated/model";

import type { DeactivateMemberFieldName, MemberFormFieldName } from "../schemas/member.schema";

const GATEWAY_STATUS_CODES: ReadonlySet<number> = new Set([502, 503, 504]);

interface ApiErrorShape {
  statusCode?: unknown;
  error?: unknown;
  details?: unknown;
}

/** What a refused edit tells the person, above the form (`member.edit.actionErrors`). */
export type UpdateMemberErrorKind =
  | "forbidden"
  | "notFound"
  | "noMemberProfile"
  | "registrationNotApproved"
  | "memberInactive"
  | "invalidData"
  | "network"
  | "unknown";

/** What a refused deactivation tells the person, above the buttons (`member.deactivate.actionErrors`). */
export type DeactivateMemberErrorKind =
  | "ownAccount"
  | "lastCoordinator"
  | "alreadyInactive"
  | "noMemberProfile"
  | "registrationNotApproved"
  | "forbidden"
  | "notFound"
  | "invalidData"
  | "network"
  | "unknown";

type ServerFieldErrors<Name extends string> = { name: Name; message: string }[];

export type UpdateMemberError =
  | { kind: "fields"; fields: ServerFieldErrors<MemberFormFieldName> }
  | { kind: UpdateMemberErrorKind };

export type DeactivateMemberError =
  | { kind: "fields"; fields: ServerFieldErrors<DeactivateMemberFieldName> }
  | { kind: DeactivateMemberErrorKind };

/** The fields of `UpdateMemberDto` and the message each one shows when the API refuses it. */
const UPDATE_FIELD_MESSAGES: Readonly<Record<MemberFormFieldName, string>> = {
  name: "nameInvalid",
  birthDate: "birthDateInvalid",
  phone: "phoneInvalid",
  email: "emailInvalid",
  cpf: "cpfInvalid",
  address: "addressMax",
  city: "cityMax",
  state: "stateInvalid",
  ra: "raInvalid",
  institutionalEmail: "institutionalEmailInvalid",
  course: "courseInvalid",
  semester: "semesterInvalid",
  className: "classNameInvalid",
  departmentId: "departmentInvalid",
  mainFunction: "mainFunctionInvalid",
  joinedAt: "joinedAtInvalid",
  volunteerTermUrl: "volunteerTermUrlInvalid",
};

const DEACTIVATE_FIELD_MESSAGES: Readonly<Record<DeactivateMemberFieldName, string>> = {
  exitDate: "exitDateInvalid",
  reason: "reasonRequired",
  note: "noteMax",
};

function readApiError(error: unknown): ApiErrorShape {
  return typeof error === "object" && error !== null ? error : {};
}

function isFieldDetail(detail: unknown): detail is ApiFieldErrorDto {
  if (typeof detail !== "object" || detail === null) return false;
  return typeof (detail as Partial<ApiFieldErrorDto>).field === "string";
}

/** The fields a 400 `VALIDATION_FAILED` names, in the order of the form, with their messages. */
function toFieldErrors<Name extends string>(
  details: unknown,
  messages: Readonly<Record<Name, string>>,
): ServerFieldErrors<Name> {
  const reported = new Set(
    (Array.isArray(details) ? details.filter(isFieldDetail) : []).map((detail) => detail.field),
  );
  return (Object.keys(messages) as Name[])
    .filter((name) => reported.has(name))
    .map((name) => ({ name, message: messages[name] }));
}

function isNetworkError(error: unknown, statusCode: unknown): boolean {
  if (error instanceof TypeError) return true;
  return typeof statusCode === "number" && GATEWAY_STATUS_CODES.has(statusCode);
}

/**
 * The error of `PATCH /members/:id` as Editar membro shows it: the RA or the e-mail taken (409), the
 * department that is gone or out of the scope of a director and the 400 of a field go to the field;
 * the rest is a message above the form.
 */
export function toUpdateMemberError(error: unknown): UpdateMemberError {
  const { statusCode, error: code, details } = readApiError(error);

  if (statusCode === 409 && code === "RA_ALREADY_IN_USE") {
    return { kind: "fields", fields: [{ name: "ra", message: "raInUse" }] };
  }
  if (statusCode === 409 && code === "EMAIL_ALREADY_IN_USE") {
    return { kind: "fields", fields: [{ name: "email", message: "emailInUse" }] };
  }
  if (statusCode === 400 && code === "DEPARTMENT_NOT_FOUND") {
    return { kind: "fields", fields: [{ name: "departmentId", message: "departmentNotFound" }] };
  }
  if (statusCode === 403 && code === "DEPARTMENT_SCOPE") {
    return { kind: "fields", fields: [{ name: "departmentId", message: "departmentScope" }] };
  }
  if (statusCode === 400 && code === "VALIDATION_FAILED") {
    const fields = toFieldErrors(details, UPDATE_FIELD_MESSAGES);
    return fields.length > 0 ? { kind: "fields", fields } : { kind: "invalidData" };
  }
  if (statusCode === 403 && (code === "FORBIDDEN" || code === "FORBIDDEN_SCOPE")) {
    return { kind: "forbidden" };
  }
  if (statusCode === 404 && code === "MEMBER_NOT_FOUND") return { kind: "notFound" };
  if (statusCode === 409 && code === "NO_MEMBER_PROFILE") return { kind: "noMemberProfile" };
  if (statusCode === 409 && code === "REGISTRATION_NOT_APPROVED") {
    return { kind: "registrationNotApproved" };
  }
  if (statusCode === 409 && code === "MEMBER_INACTIVE") return { kind: "memberInactive" };
  if (isNetworkError(error, statusCode)) return { kind: "network" };
  return { kind: "unknown" };
}

/**
 * The error of `PATCH /members/:id/deactivate` as Inativar membro shows it: an exit date before the
 * member joined and the 400 of a field go to the field; the rest is a message above the buttons.
 */
export function toDeactivateMemberError(error: unknown): DeactivateMemberError {
  const { statusCode, error: code, details } = readApiError(error);

  if (statusCode === 400 && code === "EXIT_DATE_BEFORE_JOINED_AT") {
    return { kind: "fields", fields: [{ name: "exitDate", message: "exitDateBeforeJoinedAt" }] };
  }
  if (statusCode === 400 && code === "VALIDATION_FAILED") {
    const fields = toFieldErrors(details, DEACTIVATE_FIELD_MESSAGES);
    return fields.length > 0 ? { kind: "fields", fields } : { kind: "invalidData" };
  }
  if (statusCode === 403 && code === "OWN_ACCOUNT") return { kind: "ownAccount" };
  if (statusCode === 403 && code === "FORBIDDEN") return { kind: "forbidden" };
  if (statusCode === 404 && code === "MEMBER_NOT_FOUND") return { kind: "notFound" };
  if (statusCode === 409 && code === "LAST_COORDINATOR") return { kind: "lastCoordinator" };
  if (statusCode === 409 && code === "MEMBER_INACTIVE") return { kind: "alreadyInactive" };
  if (statusCode === 409 && code === "NO_MEMBER_PROFILE") return { kind: "noMemberProfile" };
  if (statusCode === 409 && code === "REGISTRATION_NOT_APPROVED") {
    return { kind: "registrationNotApproved" };
  }
  if (isNetworkError(error, statusCode)) return { kind: "network" };
  return { kind: "unknown" };
}
