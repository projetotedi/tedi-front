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
 * O proxy não alcançou a API: 502 Bad Gateway, 503 Service Unavailable e 504 Gateway Timeout.
 * É o que o Render costuma devolver enquanto hiberna e acorda. O 500 fica de fora: é falha da
 * própria API, e não falta de conexão com ela.
 */
const GATEWAY_STATUS_CODES: ReadonlySet<number> = new Set([502, 503, 504]);

/**
 * Traduz o erro do `POST /auth/login` na mensagem que a pessoa vai ler.
 *
 * `ApiError` vive em `api/http-client.ts` e módulo não pode importá-lo (depcruise), então a
 * checagem é estrutural sobre `statusCode` e `error` (o código do `ApiErrorDto`). A distinção
 * é pelo código, não pelo status: no back, `INVALID_CREDENTIALS` e `ACCESS_DISABLED` são ambos
 * 401, e o limitador responde 429 com `TOO_MANY_ATTEMPTS`. Um código conhecido vale mesmo que o
 * status seja de gateway.
 *
 * "Não foi possível conectar" (`network`) cobre dois casos: o `fetch` rejeitando com `TypeError`
 * (sem resposta, ex.: sem internet) e o proxy respondendo 502, 503 ou 504 (API acordando).
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
