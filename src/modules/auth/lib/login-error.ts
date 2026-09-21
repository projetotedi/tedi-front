export type LoginErrorKey =
  | "invalidCredentials"
  | "accessDisabled"
  | "tooManyAttempts"
  | "network"
  | "unknown";

interface ApiErrorShape {
  statusCode?: unknown;
  error?: unknown;
}

const GATEWAY_STATUS_CODES: ReadonlySet<number> = new Set([502, 503, 504]);

/**
 * Checagem estrutural (o módulo não importa `ApiError`). Distingue pelo código, e não pelo status:
 * `INVALID_CREDENTIALS` e `ACCESS_DISABLED` são ambos 401.
 */
export function toLoginErrorKey(error: unknown): LoginErrorKey {
  const { statusCode, error: code } = (
    typeof error === "object" && error !== null ? error : {}
  ) as ApiErrorShape;

  if (statusCode === 429 || code === "TOO_MANY_ATTEMPTS") return "tooManyAttempts";
  if (code === "ACCESS_DISABLED") return "accessDisabled";
  if (code === "INVALID_CREDENTIALS") return "invalidCredentials";
  if (error instanceof TypeError) return "network";
  if (typeof statusCode === "number" && GATEWAY_STATUS_CODES.has(statusCode)) return "network";
  return "unknown";
}
