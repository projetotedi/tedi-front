export type InviteErrorKey = "invalidInvite" | "raInUse" | "emailInUse" | "network" | "unknown";

export type InviteConflictField = "ra" | "email";

interface ApiErrorShape {
  statusCode?: unknown;
  error?: unknown;
}

// TODO: unificar com `login-error.ts` em `lib/api-error.ts` quando os dois estiverem na `develop`.
const GATEWAY_STATUS_CODES: ReadonlySet<number> = new Set([502, 503, 504]);

// Checagem estrutural: o módulo não pode importar `ApiError` (depcruise).
export function toInviteErrorKey(error: unknown): InviteErrorKey {
  const { statusCode, error: code } = (
    typeof error === "object" && error !== null ? error : {}
  ) as ApiErrorShape;

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
