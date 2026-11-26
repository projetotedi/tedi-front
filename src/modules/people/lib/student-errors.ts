import type { ApiFieldErrorDto } from "@api/generated/model";

import type { StudentFormValues } from "../schemas/student.schema";

const GATEWAY_STATUS_CODES: ReadonlySet<number> = new Set([502, 503, 504]);

/** What a refused save, archive or reactivation tells the person, above the buttons. */
export type StudentActionErrorKind =
  | "archived"
  | "notFound"
  | "hasActiveEnrollments"
  | "network"
  | "unknown";

export type StudentFieldName = keyof StudentFormValues | "reason";

export type StudentActionError =
  | { kind: "fields"; fields: { name: StudentFieldName; message: string }[] }
  | { kind: StudentActionErrorKind };

interface ApiErrorShape {
  statusCode?: unknown;
  error?: unknown;
  details?: unknown;
}

/** The fields of the contract and the message each one shows on the form. */
const FIELD_MESSAGES: Readonly<Record<string, { name: StudentFieldName; message: string }>> = {
  name: { name: "name", message: "nameServerInvalid" },
  birthDate: { name: "birthDate", message: "birthDateInvalid" },
  phone: { name: "phone", message: "phoneInvalid" },
  email: { name: "email", message: "emailInvalid" },
  education: { name: "education", message: "serverInvalid" },
  howFoundUs: { name: "howFoundUs", message: "serverInvalid" },
  emergencyContactName: { name: "emergencyContactName", message: "serverInvalid" },
  emergencyContactPhone: { name: "emergencyContactPhone", message: "phoneInvalid" },
  accessibilityNeed: { name: "accessibilityNeed", message: "serverInvalid" },
  supportResource: { name: "supportResource", message: "serverInvalid" },
  classNeeds: { name: "classNeeds", message: "serverInvalid" },
  reason: { name: "reason", message: "reasonTooLong" },
};

function isFieldDetail(detail: unknown): detail is ApiFieldErrorDto {
  if (typeof detail !== "object" || detail === null) return false;
  const { field } = detail as Partial<ApiFieldErrorDto>;
  return typeof field === "string";
}

/**
 * The error of `createStudent`, `updateStudent`, `archiveStudent` or `unarchiveStudent` as the
 * dialogs show it: the e-mail taken (409 `EMAIL_ALREADY_IN_USE`) and the 400 of a field go to the
 * field; the rest is a message above the buttons.
 */
export function toStudentActionError(error: unknown): StudentActionError {
  const shape: ApiErrorShape = typeof error === "object" && error !== null ? error : {};

  if (shape.statusCode === 409 && shape.error === "EMAIL_ALREADY_IN_USE") {
    return { kind: "fields", fields: [{ name: "email", message: "emailInUse" }] };
  }
  if (shape.statusCode === 400 && shape.error === "VALIDATION_FAILED") {
    const details = Array.isArray(shape.details) ? shape.details.filter(isFieldDetail) : [];
    const fields = [
      ...new Map(
        details
          .map((detail) => FIELD_MESSAGES[detail.field])
          .filter((entry) => entry !== undefined)
          .map((entry) => [entry.name, entry] as const),
      ).values(),
    ];
    return fields.length > 0 ? { kind: "fields", fields } : { kind: "unknown" };
  }
  if (shape.statusCode === 409 && shape.error === "STUDENT_ARCHIVED") return { kind: "archived" };
  if (shape.statusCode === 409 && shape.error === "STUDENT_HAS_ACTIVE_ENROLLMENTS") {
    return { kind: "hasActiveEnrollments" };
  }
  if (shape.statusCode === 404 && shape.error === "STUDENT_NOT_FOUND") return { kind: "notFound" };
  if (error instanceof TypeError) return { kind: "network" };
  if (typeof shape.statusCode === "number" && GATEWAY_STATUS_CODES.has(shape.statusCode)) {
    return { kind: "network" };
  }
  return { kind: "unknown" };
}
