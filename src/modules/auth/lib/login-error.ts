/** Sufixo da chave de i18n `login.errors.<key>` do namespace `auth`. */
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

/**
 * Traduz o erro do `POST /auth/login` na mensagem que a pessoa vai ler.
 *
 * `ApiError` vive em `api/http-client.ts` e módulo não pode importá-lo (depcruise), então a
 * checagem é estrutural sobre `statusCode` e `error` (o código do `ApiErrorDto`). A distinção
 * é pelo código, não pelo status: no back, `INVALID_CREDENTIALS` e `ACCESS_DISABLED` são ambos
 * 401, e o limitador responde 429 com `TOO_MANY_ATTEMPTS`.
 *
 * Falha de rede não chega como `ApiError`: o `fetch` rejeita com `TypeError` (sem resposta).
 */
export function toLoginErrorKey(error: unknown): LoginErrorKey {
  const { statusCode, error: code } = (
    typeof error === "object" && error !== null ? error : {}
  ) as ApiErrorShape;

  if (statusCode === 429 || code === "TOO_MANY_ATTEMPTS") return "tooManyAttempts";
  if (code === "ACCESS_DISABLED") return "accessDisabled";
  if (code === "INVALID_CREDENTIALS") return "invalidCredentials";
  if (error instanceof TypeError) return "network";
  return "unknown";
}
