/**
 * Erros de `GET /auth/invites/:token` e `POST /auth/invites/accept` que a tela trata. Os quatro
 * últimos viram a chave de i18n `invite.errors.<key>` (ou `resetPassword.errors.<key>`);
 * `invalidInvite` não é uma mensagem: troca a tela inteira pelo aviso de link inválido.
 */
export type InviteErrorKey = "invalidInvite" | "raInUse" | "emailInUse" | "network" | "unknown";

/** Campos do formulário de aceite que podem receber um erro da API. */
export type InviteConflictField = "ra" | "email";

interface ApiErrorShape {
  statusCode?: unknown;
  error?: unknown;
}

/**
 * O proxy não alcançou a API: 502, 503 e 504 (o Render costuma devolvê-los enquanto hiberna e
 * acorda). Duplicado de `login-error.ts` de propósito, para não mexer num arquivo coberto por outro
 * PR: unificar num `lib/api-error.ts` quando os dois estiverem na `develop`.
 */
const GATEWAY_STATUS_CODES: ReadonlySet<number> = new Set([502, 503, 504]);

/**
 * Traduz o erro da API do convite na situação que a tela vai mostrar.
 *
 * `ApiError` vive em `api/http-client.ts` e módulo não pode importá-lo (depcruise), então a
 * checagem é estrutural sobre `statusCode` e `error` (o código do `ApiErrorDto`). A distinção é
 * pelo código, não pelo status: `RA_ALREADY_IN_USE` e `EMAIL_ALREADY_IN_USE` são 409 e
 * `INVALID_INVITE` é 400. Um código conhecido vale mesmo que o status seja de gateway.
 *
 * "Não foi possível conectar" (`network`) cobre o `fetch` rejeitando com `TypeError` (sem resposta,
 * ex.: sem internet) e o proxy respondendo 502, 503 ou 504 (API acordando).
 */
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

/** Campo do formulário que recebe o erro, ou `null` quando a mensagem é geral (ou a tela toda). */
export function toAcceptFieldError(key: InviteErrorKey): InviteConflictField | null {
  if (key === "raInUse") return "ra";
  if (key === "emailInUse") return "email";
  return null;
}
