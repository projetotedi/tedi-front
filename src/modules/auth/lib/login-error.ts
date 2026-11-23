import { GATEWAY_STATUS_CODES, readApiErrorShape } from "./api-error";

export type LoginErrorKey =
  | "invalidCredentials"
  | "accessDisabled"
  | "registrationPending"
  | "registrationRejected"
  | "tooManyAttempts"
  | "network"
  | "unknown";

/**
 * Distingue pelo código, e não pelo status: `INVALID_CREDENTIALS`, `ACCESS_DISABLED`,
 * `REGISTRATION_PENDING` e `REGISTRATION_REJECTED` são todos 401. Os dois últimos só vêm com a
 * senha certa (o back confere a senha antes), então dizer o estado do cadastro não revela nada
 * a quem não a sabe.
 */
export function toLoginErrorKey(error: unknown): LoginErrorKey {
  const { statusCode, error: code } = readApiErrorShape(error);

  if (statusCode === 429 || code === "TOO_MANY_ATTEMPTS") return "tooManyAttempts";
  if (code === "ACCESS_DISABLED") return "accessDisabled";
  if (code === "REGISTRATION_PENDING") return "registrationPending";
  if (code === "REGISTRATION_REJECTED") return "registrationRejected";
  if (code === "INVALID_CREDENTIALS") return "invalidCredentials";
  if (error instanceof TypeError) return "network";
  if (typeof statusCode === "number" && GATEWAY_STATUS_CODES.has(statusCode)) return "network";
  return "unknown";
}
