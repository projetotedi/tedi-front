import { GATEWAY_STATUS_CODES, readApiErrorShape } from "./api-error";

export type LoginErrorKey =
  | "invalidCredentials"
  | "accessDisabled"
  | "tooManyAttempts"
  | "network"
  | "unknown";

/**
 * Distingue pelo código, e não pelo status: `INVALID_CREDENTIALS` e `ACCESS_DISABLED` são ambos 401.
 */
export function toLoginErrorKey(error: unknown): LoginErrorKey {
  const { statusCode, error: code } = readApiErrorShape(error);

  if (statusCode === 429 || code === "TOO_MANY_ATTEMPTS") return "tooManyAttempts";
  if (code === "ACCESS_DISABLED") return "accessDisabled";
  if (code === "INVALID_CREDENTIALS") return "invalidCredentials";
  if (error instanceof TypeError) return "network";
  if (typeof statusCode === "number" && GATEWAY_STATUS_CODES.has(statusCode)) return "network";
  return "unknown";
}
