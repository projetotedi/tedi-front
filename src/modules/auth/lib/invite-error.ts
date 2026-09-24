import { GATEWAY_STATUS_CODES, readApiErrorShape } from "./api-error";

export type InviteErrorKey = "invalidInvite" | "raInUse" | "emailInUse" | "network" | "unknown";

export type InviteConflictField = "ra" | "email";

export function toInviteErrorKey(error: unknown): InviteErrorKey {
  const { statusCode, error: code } = readApiErrorShape(error);

  if (code === "INVALID_INVITE") return "invalidInvite";
  if (code === "RA_ALREADY_IN_USE") return "raInUse";
  if (code === "EMAIL_ALREADY_IN_USE") return "emailInUse";
  if (error instanceof TypeError) return "network";
  if (typeof statusCode === "number" && GATEWAY_STATUS_CODES.has(statusCode)) return "network";
  return "unknown";
}

export function toAcceptFieldError(key: InviteErrorKey): InviteConflictField | null {
  if (key === "raInUse") return "ra";
  if (key === "emailInUse") return "email";
  return null;
}
